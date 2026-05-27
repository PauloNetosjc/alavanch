
-- 1. Função idempotente que garante participantes obrigatórios de uma solicitação
CREATE OR REPLACE FUNCTION public.ensure_participants_for_solicitation(p_solic uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requer_loja boolean;
BEGIN
  IF p_solic IS NULL THEN RETURN; END IF;

  -- Backfill: tokens ausentes em participantes já existentes (64 hex chars)
  UPDATE public.assinatura_participantes
     SET token = replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')
   WHERE solicitacao_id = p_solic AND (token IS NULL OR token = '');

  SELECT COALESCE(td.requer_assinatura_loja, false) INTO v_requer_loja
    FROM public.solicitacoes_assinatura s
    LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
   WHERE s.id = p_solic;

  PERFORM public.garantir_participante(p_solic, 'cliente'::public.assinatura_participante_tipo);
  IF v_requer_loja THEN
    PERFORM public.garantir_participante(p_solic, 'loja'::public.assinatura_participante_tipo);
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.ensure_participants_for_solicitation(uuid) TO authenticated, service_role;

-- 2. Trigger AFTER INSERT em solicitacoes_assinatura
CREATE OR REPLACE FUNCTION public.trg_solic_assinatura_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_participants_for_solicitation(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_solic_assinatura_ensure_parts ON public.solicitacoes_assinatura;
CREATE TRIGGER trg_solic_assinatura_ensure_parts
AFTER INSERT ON public.solicitacoes_assinatura
FOR EACH ROW EXECUTE FUNCTION public.trg_solic_assinatura_after_insert();

-- 3. auto_criar_solic_contrato reutiliza solicitação ATIVA existente
CREATE OR REPLACE FUNCTION public.auto_criar_solic_contrato(p_pedido_id uuid, p_contrato_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ped record; v_ct record; v_tipo uuid; v_existing uuid; v_solic_id uuid;
BEGIN
  SELECT id, orcamento_id, cliente_id, loja_id INTO v_ped FROM public.pedidos WHERE id = p_pedido_id;
  IF v_ped.id IS NULL THEN RETURN NULL; END IF;

  IF p_contrato_id IS NULL THEN
    SELECT * INTO v_ct FROM public.contratos WHERE orcamento_id = v_ped.orcamento_id ORDER BY created_at DESC LIMIT 1;
  ELSE
    SELECT * INTO v_ct FROM public.contratos WHERE id = p_contrato_id;
  END IF;

  IF v_ct.id IS NULL OR v_ct.status <> 'aguardando_assinatura' THEN RETURN NULL; END IF;

  SELECT id INTO v_existing FROM public.solicitacoes_assinatura
    WHERE pedido_id = v_ped.id AND contrato_id = v_ct.id
      AND status NOT IN ('cancelado','recusado','expirado')
    ORDER BY created_at DESC LIMIT 1;
  IF v_existing IS NOT NULL THEN
    PERFORM public.ensure_participants_for_solicitation(v_existing);
    RETURN v_existing;
  END IF;

  SELECT id INTO v_tipo FROM public.tipos_documento WHERE slug = 'contrato' LIMIT 1;
  IF v_tipo IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.solicitacoes_assinatura (
    pedido_id, tipo_documento_id, cliente_id, loja_id, contrato_id,
    file_name, status, observacao, expira_em
  ) VALUES (
    v_ped.id, v_tipo, v_ped.cliente_id, v_ped.loja_id, v_ct.id,
    'Contrato ' || v_ct.numero,
    'aguardando_loja',
    'Solicitação criada automaticamente ao gerar o contrato.',
    now() + interval '30 days'
  ) RETURNING id INTO v_solic_id;

  INSERT INTO public.assinatura_eventos (solicitacao_id, tipo_evento, status_anterior, status_novo, descricao)
  VALUES (v_solic_id, 'criado_auto', NULL, 'aguardando_loja', 'Solicitação criada automaticamente para o contrato ' || v_ct.numero);

  PERFORM public.ensure_participants_for_solicitation(v_solic_id);
  RETURN v_solic_id;
END;
$function$;

-- 4. Deduplicação de solicitações ativas duplicadas
DO $$
DECLARE r record; v_keep uuid;
BEGIN
  FOR r IN
    SELECT pedido_id, contrato_id, array_agg(id ORDER BY
      CASE WHEN status = 'assinado_loja' THEN 0
           WHEN status = 'assinado_cliente' THEN 1
           ELSE 2 END, created_at DESC) AS ids
    FROM public.solicitacoes_assinatura
    WHERE contrato_id IS NOT NULL
      AND status NOT IN ('cancelado','recusado','expirado')
    GROUP BY pedido_id, contrato_id
    HAVING count(*) > 1
  LOOP
    v_keep := r.ids[1];
    UPDATE public.solicitacoes_assinatura
       SET status = 'cancelado',
           observacao = COALESCE(observacao,'') || ' [Duplicada — mesclada com ' || v_keep::text || ']'
     WHERE id = ANY(r.ids) AND id <> v_keep;
  END LOOP;
END $$;

-- 5. Backfill: tokens + participantes
DO $$
DECLARE s record;
BEGIN
  UPDATE public.assinatura_participantes
     SET token = replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')
   WHERE token IS NULL OR token = '';

  FOR s IN
    SELECT id FROM public.solicitacoes_assinatura
     WHERE status NOT IN ('cancelado','recusado','expirado')
  LOOP
    PERFORM public.ensure_participants_for_solicitation(s.id);
  END LOOP;
END $$;

-- 6. Recalcular status geral
DO $$
DECLARE s record;
BEGIN
  FOR s IN
    SELECT id FROM public.solicitacoes_assinatura
     WHERE status NOT IN ('cancelado','recusado','expirado')
  LOOP
    PERFORM public.recalcular_status_solicitacao(s.id);
  END LOOP;
END $$;

-- 7. Índice único parcial
CREATE UNIQUE INDEX IF NOT EXISTS uniq_solic_ativa_por_contrato
ON public.solicitacoes_assinatura (pedido_id, contrato_id)
WHERE contrato_id IS NOT NULL
  AND status NOT IN ('cancelado','recusado','expirado');
