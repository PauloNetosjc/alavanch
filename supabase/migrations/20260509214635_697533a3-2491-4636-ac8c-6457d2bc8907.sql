
-- =============================================================
-- Auto-criar Solicitação de Assinatura do Contrato ao criar Pedido
-- =============================================================

CREATE OR REPLACE FUNCTION public.auto_criar_solic_contrato(p_pedido_id uuid, p_contrato_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ped record;
  v_ct  record;
  v_tipo uuid;
  v_existing uuid;
  v_solic_id uuid;
  v_origin text;
BEGIN
  SELECT id, orcamento_id, cliente_id, loja_id INTO v_ped FROM public.pedidos WHERE id = p_pedido_id;
  IF v_ped.id IS NULL THEN RETURN NULL; END IF;

  IF p_contrato_id IS NULL THEN
    SELECT * INTO v_ct FROM public.contratos
      WHERE orcamento_id = v_ped.orcamento_id
      ORDER BY created_at DESC LIMIT 1;
  ELSE
    SELECT * INTO v_ct FROM public.contratos WHERE id = p_contrato_id;
  END IF;

  IF v_ct.id IS NULL OR v_ct.status <> 'aguardando_assinatura' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_existing FROM public.solicitacoes_assinatura
    WHERE pedido_id = v_ped.id AND contrato_id = v_ct.id
    LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT id INTO v_tipo FROM public.tipos_documento WHERE slug = 'contrato' LIMIT 1;
  IF v_tipo IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.solicitacoes_assinatura (
    pedido_id, tipo_documento_id, cliente_id, loja_id, contrato_id,
    file_name, file_url, status, observacao
  ) VALUES (
    v_ped.id, v_tipo, v_ped.cliente_id, v_ped.loja_id, v_ct.id,
    'Contrato ' || v_ct.numero,
    '/contratos/' || v_ct.id::text || '/visualizar',
    'aguardando_cliente',
    'Solicitação criada automaticamente ao gerar o pedido.'
  ) RETURNING id INTO v_solic_id;

  INSERT INTO public.assinatura_eventos (solicitacao_id, tipo_evento, status_anterior, status_novo, descricao)
  VALUES (v_solic_id, 'criado_auto', NULL, 'aguardando_cliente', 'Solicitação criada automaticamente do contrato ' || v_ct.numero);

  RETURN v_solic_id;
END;
$$;

-- Trigger ao criar pedido
CREATE OR REPLACE FUNCTION public.trg_pedido_after_insert_solic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.auto_criar_solic_contrato(NEW.id, NULL);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_pedido_solic_auto ON public.pedidos;
CREATE TRIGGER trg_pedido_solic_auto
AFTER INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.trg_pedido_after_insert_solic();

-- Trigger ao criar/atualizar contrato (caso pedido seja criado depois)
CREATE OR REPLACE FUNCTION public.trg_contrato_after_solic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ped uuid;
BEGIN
  IF NEW.status <> 'aguardando_assinatura' THEN RETURN NEW; END IF;
  SELECT id INTO v_ped FROM public.pedidos WHERE orcamento_id = NEW.orcamento_id ORDER BY created_at DESC LIMIT 1;
  IF v_ped IS NOT NULL THEN
    PERFORM public.auto_criar_solic_contrato(v_ped, NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_contrato_solic_auto ON public.contratos;
CREATE TRIGGER trg_contrato_solic_auto
AFTER INSERT OR UPDATE OF status ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.trg_contrato_after_solic();

-- =============================================================
-- Quando solicitação for concluída, marcar contrato como assinado
-- =============================================================
CREATE OR REPLACE FUNCTION public.sincronizar_contrato_assinado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'concluido' AND NEW.contrato_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.contratos
       SET status = 'assinado',
           assinado_em = COALESCE(assinado_em, now()),
           metodo_assinatura = COALESCE(metodo_assinatura, 'digital')
     WHERE id = NEW.contrato_id AND status <> 'assinado';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_contrato_assinado ON public.solicitacoes_assinatura;
CREATE TRIGGER trg_sync_contrato_assinado
AFTER INSERT OR UPDATE OF status ON public.solicitacoes_assinatura
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_contrato_assinado();

-- =============================================================
-- Backfill: para pedidos existentes com contrato aguardando assinatura
-- =============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id AS pedido_id, c.id AS contrato_id
      FROM public.pedidos p
      JOIN public.contratos c ON c.orcamento_id = p.orcamento_id
     WHERE c.status = 'aguardando_assinatura'
       AND NOT EXISTS (
         SELECT 1 FROM public.solicitacoes_assinatura s
          WHERE s.pedido_id = p.id AND s.contrato_id = c.id
       )
  LOOP
    PERFORM public.auto_criar_solic_contrato(r.pedido_id, r.contrato_id);
  END LOOP;
END $$;
