
-- 1) Tabela de cards do Kanban (permite múltiplos cards por pedido no mesmo pipeline)
CREATE TABLE IF NOT EXISTS public.kanban_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  pipeline text NOT NULL,
  estagio_id uuid NOT NULL REFERENCES public.pipeline_estagios(id),
  responsavel_id uuid,
  prazo date,
  sla_dias_uteis int,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  notificacao_atraso_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_pipeline ON public.kanban_cards(pipeline);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_pedido ON public.kanban_cards(pedido_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_estagio ON public.kanban_cards(estagio_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kanban_cards_pedido_estagio ON public.kanban_cards(pedido_id, estagio_id);

ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_cards_select" ON public.kanban_cards;
CREATE POLICY "kanban_cards_select" ON public.kanban_cards FOR SELECT
  USING (public.pode_acessar_loja(public.loja_de_pedido(pedido_id)));

DROP POLICY IF EXISTS "kanban_cards_modify" ON public.kanban_cards;
CREATE POLICY "kanban_cards_modify" ON public.kanban_cards FOR ALL
  USING (public.pode_acessar_loja(public.loja_de_pedido(pedido_id)))
  WITH CHECK (public.pode_acessar_loja(public.loja_de_pedido(pedido_id)));

CREATE TRIGGER trg_kanban_cards_updated
BEFORE UPDATE ON public.kanban_cards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Backfill a partir das colunas existentes em pedidos
INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id, responsavel_id, prazo, iniciado_em)
SELECT p.id, 'operacional', p.estagio_operacional_id, p.estagio_responsavel_id, p.estagio_prazo, COALESCE(p.estagio_iniciado_em, p.created_at)
FROM public.pedidos p WHERE p.estagio_operacional_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id, iniciado_em)
SELECT p.id, 'pos_venda', p.estagio_pos_venda_id, p.created_at
FROM public.pedidos p WHERE p.estagio_pos_venda_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id, iniciado_em)
SELECT p.id, 'revisao', p.estagio_revisao_id, p.created_at
FROM public.pedidos p WHERE p.estagio_revisao_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id, iniciado_em)
SELECT p.id, 'montagem', p.estagio_montagem_id, p.created_at
FROM public.pedidos p WHERE p.estagio_montagem_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id, iniciado_em)
SELECT p.id, 'fabrica', p.estagio_fabrica_id, p.created_at
FROM public.pedidos p WHERE p.estagio_fabrica_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3) Função: obter loja do pedido p/ cálculo de dias úteis
-- (já existe loja_de_pedido)

-- 4) Cria card inicial Pós-Venda (estágio 1) ao criar pedido
CREATE OR REPLACE FUNCTION public.criar_card_posvenda_inicial()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_estagio uuid;
BEGIN
  SELECT id INTO v_estagio FROM public.pipeline_estagios
   WHERE pipeline = 'pos_venda' AND ativo AND ordem = 1
   ORDER BY ordem LIMIT 1;
  IF v_estagio IS NOT NULL THEN
    INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id)
    VALUES (NEW.id, 'pos_venda', v_estagio)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pedido_card_posvenda_inicial ON public.pedidos;
CREATE TRIGGER trg_pedido_card_posvenda_inicial
AFTER INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.criar_card_posvenda_inicial();

-- 5) Trigger ao assinar contrato: avança Pós-Venda p/ "Emissão de Boletos" (SLA 2 du),
--    cria card "Envio: PJ Inicial+Cesta+Video" (SLA 7 du) e card Revisão "Análise Revisão"
CREATE OR REPLACE FUNCTION public.processar_contrato_assinado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pedido record;
  v_e_boletos uuid;
  v_e_envio uuid;
  v_e_revisao uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'assinado' THEN
    SELECT id, loja_id INTO v_pedido FROM public.pedidos
      WHERE orcamento_id = NEW.orcamento_id ORDER BY created_at DESC LIMIT 1;
    IF v_pedido.id IS NULL THEN RETURN NEW; END IF;

    SELECT id INTO v_e_boletos FROM public.pipeline_estagios WHERE pipeline='pos_venda' AND ordem=2 AND ativo LIMIT 1;
    SELECT id INTO v_e_envio   FROM public.pipeline_estagios WHERE pipeline='pos_venda' AND ordem=4 AND ativo LIMIT 1;
    SELECT id INTO v_e_revisao FROM public.pipeline_estagios WHERE pipeline='revisao'   AND ordem=1 AND ativo LIMIT 1;

    -- avança card pós-venda (qualquer existente do pedido) p/ Emissão Boletos
    IF v_e_boletos IS NOT NULL THEN
      UPDATE public.kanban_cards
         SET estagio_id = v_e_boletos,
             prazo = public.add_dias_uteis(CURRENT_DATE, 2, v_pedido.loja_id),
             sla_dias_uteis = 2,
             iniciado_em = now(),
             notificacao_atraso_em = NULL
       WHERE pedido_id = v_pedido.id AND pipeline = 'pos_venda'
         AND estagio_id IN (SELECT id FROM public.pipeline_estagios WHERE pipeline='pos_venda' AND ordem=1);
      -- se nenhuma linha, cria
      IF NOT FOUND THEN
        INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id, prazo, sla_dias_uteis)
        VALUES (v_pedido.id, 'pos_venda', v_e_boletos, public.add_dias_uteis(CURRENT_DATE, 2, v_pedido.loja_id), 2)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    -- card paralelo: envio PJ inicial (SLA 7 du)
    IF v_e_envio IS NOT NULL THEN
      INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id, prazo, sla_dias_uteis)
      VALUES (v_pedido.id, 'pos_venda', v_e_envio, public.add_dias_uteis(CURRENT_DATE, 7, v_pedido.loja_id), 7)
      ON CONFLICT DO NOTHING;
    END IF;

    -- card no Kanban Revisão
    IF v_e_revisao IS NOT NULL THEN
      INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id)
      VALUES (v_pedido.id, 'revisao', v_e_revisao)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contrato_assinado_kanban ON public.contratos;
CREATE TRIGGER trg_contrato_assinado_kanban
AFTER UPDATE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.processar_contrato_assinado();

-- 6) Função para checar atrasos e gerar notificações (idempotente)
CREATE OR REPLACE FUNCTION public.kanban_processar_atrasos()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_count int := 0;
  v_target uuid;
BEGIN
  FOR r IN
    SELECT kc.id, kc.pedido_id, kc.prazo, kc.estagio_id, kc.responsavel_id,
           p.codigo, p.loja_id,
           pe.nome AS estagio_nome, pe.pipeline
      FROM public.kanban_cards kc
      JOIN public.pedidos p ON p.id = kc.pedido_id
      JOIN public.pipeline_estagios pe ON pe.id = kc.estagio_id
     WHERE kc.prazo IS NOT NULL
       AND kc.prazo < CURRENT_DATE
       AND kc.notificacao_atraso_em IS NULL
  LOOP
    v_target := r.responsavel_id;
    IF v_target IS NULL THEN
      SELECT user_id INTO v_target FROM public.user_roles
        WHERE role IN ('admin','financeiro','diretor') LIMIT 1;
    END IF;
    IF v_target IS NOT NULL THEN
      INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, link, metadata)
      VALUES (v_target, 'kanban',
              'Card em atraso: ' || r.codigo,
              'Pipeline ' || r.pipeline || ' / ' || r.estagio_nome || ' venceu em ' || to_char(r.prazo,'DD/MM/YYYY'),
              '/kanbans?k=' || r.pipeline,
              jsonb_build_object('card_id', r.id, 'pedido_id', r.pedido_id, 'pipeline', r.pipeline));
    END IF;
    UPDATE public.kanban_cards SET notificacao_atraso_em = now() WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.kanban_processar_atrasos() TO authenticated;

-- 7) RPC para concluir card (apenas exclui o card; pedido permanece)
CREATE OR REPLACE FUNCTION public.concluir_kanban_card(_card_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.kanban_cards WHERE id = _card_id;
END $$;

GRANT EXECUTE ON FUNCTION public.concluir_kanban_card(uuid) TO authenticated;
