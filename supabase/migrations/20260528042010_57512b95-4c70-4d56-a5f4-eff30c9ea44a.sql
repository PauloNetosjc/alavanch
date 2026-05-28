
-- =====================================================================
-- FASE 1 — MOTOR DE TAREFAS NATIVAS DO PEDIDO
-- =====================================================================

-- 1) tarefas_nativas_modelos -------------------------------------------
CREATE TABLE public.tarefas_nativas_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  setor text,
  cargo_id uuid REFERENCES public.rh_cargos(id) ON DELETE SET NULL,
  responsavel_padrao_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  gatilho text NOT NULL,
  gatilho_offset_dias int NOT NULL DEFAULT 0,
  gatilho_offset_direcao text NOT NULL DEFAULT 'no_dia'
    CHECK (gatilho_offset_direcao IN ('antes','depois','no_dia')),
  gatilho_referencia text,
  prazo_qtd int NOT NULL DEFAULT 1,
  prazo_unidade text NOT NULL DEFAULT 'dias'
    CHECK (prazo_unidade IN ('dias','horas')),
  prazo_tipo text NOT NULL DEFAULT 'corrido'
    CHECK (prazo_tipo IN ('corrido','util')),
  pre_alerta_dias int NOT NULL DEFAULT 1,
  prioridade text NOT NULL DEFAULT 'media'
    CHECK (prioridade IN ('baixa','media','alta','critica')),
  ordem int NOT NULL DEFAULT 0,
  depende_de uuid REFERENCES public.tarefas_nativas_modelos(id) ON DELETE SET NULL,
  bloquear_proxima boolean NOT NULL DEFAULT false,
  exige_anexo boolean NOT NULL DEFAULT false,
  exige_aprovacao boolean NOT NULL DEFAULT false,
  exibir_meus_chamados boolean NOT NULL DEFAULT true,
  exibir_controle_prazos boolean NOT NULL DEFAULT true,
  exibir_kanban boolean NOT NULL DEFAULT false,
  pipeline text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tarefas_modelos_gatilho ON public.tarefas_nativas_modelos(gatilho) WHERE ativo;
CREATE INDEX idx_tarefas_modelos_ativo   ON public.tarefas_nativas_modelos(ativo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_nativas_modelos TO authenticated;
GRANT ALL ON public.tarefas_nativas_modelos TO service_role;

ALTER TABLE public.tarefas_nativas_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY tnm_select ON public.tarefas_nativas_modelos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tnm_admin ON public.tarefas_nativas_modelos
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'gerente')
    OR public.has_permission(auth.uid(),'tarefas_pedido_admin','administrar')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'gerente')
    OR public.has_permission(auth.uid(),'tarefas_pedido_admin','administrar')
  );

CREATE TRIGGER trg_tnm_updated_at
  BEFORE UPDATE ON public.tarefas_nativas_modelos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) tarefas_pedido ----------------------------------------------------
CREATE TABLE public.tarefas_pedido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  modelo_id uuid REFERENCES public.tarefas_nativas_modelos(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  setor text,
  cargo_id uuid REFERENCES public.rh_cargos(id) ON DELETE SET NULL,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','em_andamento','aguardando_aprovacao','concluida','cancelada','bloqueada')),
  origem text NOT NULL DEFAULT 'automatica'
    CHECK (origem IN ('automatica','manual','dependencia')),
  prazo timestamptz,
  pre_alerta_em timestamptz,
  prioridade text NOT NULL DEFAULT 'media'
    CHECK (prioridade IN ('baixa','media','alta','critica')),
  depende_de uuid REFERENCES public.tarefas_pedido(id) ON DELETE SET NULL,
  bloqueio_proxima boolean NOT NULL DEFAULT false,
  exige_anexo boolean NOT NULL DEFAULT false,
  exige_aprovacao boolean NOT NULL DEFAULT false,
  exibir_meus_chamados boolean NOT NULL DEFAULT true,
  exibir_controle_prazos boolean NOT NULL DEFAULT true,
  exibir_kanban boolean NOT NULL DEFAULT false,
  criado_por uuid,
  concluido_por uuid,
  concluido_em timestamptz,
  observacao_conclusao text,
  kanban_card_id uuid REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_tarefas_pedido_modelo
  ON public.tarefas_pedido(pedido_id, modelo_id)
  WHERE modelo_id IS NOT NULL;

CREATE INDEX idx_tp_pedido        ON public.tarefas_pedido(pedido_id);
CREATE INDEX idx_tp_responsavel   ON public.tarefas_pedido(responsavel_id);
CREATE INDEX idx_tp_cargo         ON public.tarefas_pedido(cargo_id);
CREATE INDEX idx_tp_loja          ON public.tarefas_pedido(loja_id);
CREATE INDEX idx_tp_status        ON public.tarefas_pedido(status);
CREATE INDEX idx_tp_prazo         ON public.tarefas_pedido(prazo) WHERE status NOT IN ('concluida','cancelada');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_pedido TO authenticated;
GRANT ALL ON public.tarefas_pedido TO service_role;

ALTER TABLE public.tarefas_pedido ENABLE ROW LEVEL SECURITY;

-- Leitura: admin/diretor/gerente vê tudo; demais por loja/responsável/cargo.
-- Cargo do usuário é resolvido por rh_funcionarios.email = auth.users.email.
CREATE POLICY tp_select ON public.tarefas_pedido
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'gerente')
    OR (loja_id IS NOT NULL AND public.user_pode_acessar_loja(auth.uid(), loja_id))
    OR responsavel_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR cargo_id IN (
      SELECT f.cargo_id FROM public.rh_funcionarios f
       WHERE f.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY tp_write ON public.tarefas_pedido
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'gerente')
    OR public.has_role(auth.uid(),'financeiro')
    OR public.has_permission(auth.uid(),'tarefas_pedido','editar')
    OR responsavel_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'gerente')
    OR public.has_role(auth.uid(),'financeiro')
    OR public.has_permission(auth.uid(),'tarefas_pedido','editar')
    OR responsavel_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE TRIGGER trg_tp_updated_at
  BEFORE UPDATE ON public.tarefas_pedido
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3) eventos_tarefa ----------------------------------------------------
CREATE TABLE public.eventos_tarefa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas_pedido(id) ON DELETE CASCADE,
  tipo text NOT NULL
    CHECK (tipo IN ('criada','atribuida','status','comentario','anexo','aprovada','reprovada','disparada_dependente')),
  usuario_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  anexo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_et_tarefa ON public.eventos_tarefa(tarefa_id);
CREATE INDEX idx_et_tipo   ON public.eventos_tarefa(tipo);

GRANT SELECT, INSERT ON public.eventos_tarefa TO authenticated;
GRANT ALL ON public.eventos_tarefa TO service_role;

ALTER TABLE public.eventos_tarefa ENABLE ROW LEVEL SECURITY;

CREATE POLICY et_select ON public.eventos_tarefa
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tarefas_pedido t WHERE t.id = eventos_tarefa.tarefa_id)
  );

CREATE POLICY et_insert ON public.eventos_tarefa
  FOR INSERT TO authenticated
  WITH CHECK (true);


-- 4) fn_instanciar_tarefas_nativas ------------------------------------
CREATE OR REPLACE FUNCTION public.fn_instanciar_tarefas_nativas(
  p_pedido_id uuid,
  p_gatilho text
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido record;
  v_modelo record;
  v_prazo timestamptz;
  v_pre   timestamptz;
  v_id    uuid;
  v_count int := 0;
BEGIN
  SELECT id, cliente_id, loja_id INTO v_pedido
    FROM public.pedidos WHERE id = p_pedido_id;
  IF v_pedido.id IS NULL THEN RETURN 0; END IF;

  FOR v_modelo IN
    SELECT * FROM public.tarefas_nativas_modelos
     WHERE ativo = true
       AND gatilho = p_gatilho
       AND (loja_id IS NULL OR loja_id = v_pedido.loja_id)
     ORDER BY ordem, created_at
  LOOP
    IF v_modelo.prazo_unidade = 'horas' THEN
      v_prazo := now() + make_interval(hours => v_modelo.prazo_qtd);
    ELSIF v_modelo.prazo_tipo = 'util' THEN
      v_prazo := (public.add_dias_uteis(CURRENT_DATE, v_modelo.prazo_qtd, v_pedido.loja_id))::timestamptz;
    ELSE
      v_prazo := now() + make_interval(days => v_modelo.prazo_qtd);
    END IF;

    v_pre := v_prazo - make_interval(days => COALESCE(v_modelo.pre_alerta_dias,0));

    INSERT INTO public.tarefas_pedido (
      pedido_id, cliente_id, modelo_id, titulo, descricao, setor,
      cargo_id, responsavel_id, loja_id,
      status, origem, prazo, pre_alerta_em, prioridade,
      exige_anexo, exige_aprovacao,
      exibir_meus_chamados, exibir_controle_prazos, exibir_kanban
    ) VALUES (
      v_pedido.id, v_pedido.cliente_id, v_modelo.id, v_modelo.nome, v_modelo.descricao, v_modelo.setor,
      v_modelo.cargo_id, v_modelo.responsavel_padrao_id, v_pedido.loja_id,
      'pendente', 'automatica', v_prazo, v_pre, v_modelo.prioridade,
      v_modelo.exige_anexo, v_modelo.exige_aprovacao,
      v_modelo.exibir_meus_chamados, v_modelo.exibir_controle_prazos, v_modelo.exibir_kanban
    )
    ON CONFLICT (pedido_id, modelo_id) WHERE modelo_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NOT NULL THEN
      INSERT INTO public.eventos_tarefa (tarefa_id, tipo, payload)
      VALUES (v_id, 'criada', jsonb_build_object('gatilho', p_gatilho, 'modelo_id', v_modelo.id));
      v_count := v_count + 1;
      v_id := NULL;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;


-- 5) Triggers leves ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_tarefa_pedido_status_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid;
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'concluida' AND NEW.concluido_em IS NULL THEN
      NEW.concluido_em := now();
      NEW.concluido_por := COALESCE(NEW.concluido_por, v_uid);
    END IF;
    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, usuario_id, payload)
    VALUES (NEW.id, 'status', v_uid, jsonb_build_object('de', OLD.status, 'para', NEW.status));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_tarefa_pedido_status
  BEFORE UPDATE ON public.tarefas_pedido
  FOR EACH ROW EXECUTE FUNCTION public.trg_tarefa_pedido_status_fn();

CREATE OR REPLACE FUNCTION public.trg_tarefa_pedido_liberar_dep_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'concluida' THEN
    UPDATE public.tarefas_pedido
       SET status = 'pendente'
     WHERE depende_de = NEW.id AND status = 'bloqueada';
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_tarefa_pedido_liberar_dep
  AFTER UPDATE ON public.tarefas_pedido
  FOR EACH ROW EXECUTE FUNCTION public.trg_tarefa_pedido_liberar_dep_fn();


-- 6) Catálogo de permissões -------------------------------------------
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('tarefas_pedido','visualizar','Visualizar tarefas nativas do pedido','Tarefas'),
  ('tarefas_pedido','criar','Criar tarefas manuais no pedido','Tarefas'),
  ('tarefas_pedido','editar','Editar tarefas do pedido','Tarefas'),
  ('tarefas_pedido','concluir','Concluir tarefas do pedido','Tarefas'),
  ('tarefas_pedido_admin','administrar','Administrar modelos de tarefas nativas','Tarefas')
ON CONFLICT (modulo, acao) DO NOTHING;


-- 7) Seed inicial de modelos ------------------------------------------
INSERT INTO public.tarefas_nativas_modelos
  (nome, descricao, setor, gatilho, prazo_qtd, prazo_unidade, prazo_tipo, prioridade, ordem,
   exibir_meus_chamados, exibir_controle_prazos, exibir_kanban, ativo)
VALUES
  ('Assinar contrato','Coletar assinatura do contrato com o cliente.','Comercial','contrato_criado',1,'dias','util','alta',10,true,true,false,true),
  ('Subir documento do cliente','Anexar documentos do cliente (RG/CPF/Comprovante).','Comercial','pedido_assinado',1,'dias','util','media',20,true,true,false,true),
  ('Enviar projeto inicial para o cliente','Enviar projeto inicial ao cliente para aprovação.','Comercial','pedido_assinado',2,'dias','util','media',30,true,true,false,true),
  ('Fazer revisão de valores do projeto','Revisar valores e itens após revisão de projeto.','Comercial','revisao_projeto_concluida',1,'dias','util','alta',40,true,true,false,true),
  ('Fazer medição técnica','Realizar medição técnica no local do cliente.','Conferência','pedido_assinado',2,'dias','util','alta',50,true,true,false,true),
  ('Preparar projeto final','Preparar o projeto final após medição técnica.','Conferência','medicao_tecnica_concluida',2,'dias','util','alta',60,true,true,false,true),
  ('Preparar e enviar PDF do projeto final','Gerar e enviar PDF do projeto final.','Conferência','revisao_projeto_concluida',1,'dias','util','alta',70,true,true,false,true),
  ('Implantar na fábrica','Implantar o projeto final na fábrica.','Conferência/Fábrica','pdf_projeto_final_assinado',1,'dias','util','critica',80,true,true,false,true);
