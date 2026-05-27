ALTER TABLE public.solicitacoes_assinatura
  ADD COLUMN IF NOT EXISTS cliente_nome text,
  ADD COLUMN IF NOT EXISTS cliente_documento text,
  ADD COLUMN IF NOT EXISTS cliente_ip text,
  ADD COLUMN IF NOT EXISTS cliente_user_agent text,
  ADD COLUMN IF NOT EXISTS cliente_localizacao jsonb,
  ADD COLUMN IF NOT EXISTS assinatura_cliente_url text,
  ADD COLUMN IF NOT EXISTS doc_foto_url text,
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS loja_assinatura_nome text,
  ADD COLUMN IF NOT EXISTS loja_assinatura_email text,
  ADD COLUMN IF NOT EXISTS loja_assinatura_cargo text,
  ADD COLUMN IF NOT EXISTS loja_ip text,
  ADD COLUMN IF NOT EXISTS loja_user_agent text,
  ADD COLUMN IF NOT EXISTS assinatura_loja_url text,
  ADD COLUMN IF NOT EXISTS final_pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS final_pdf_url text;

ALTER TABLE public.assinatura_evidencias
  ADD COLUMN IF NOT EXISTS localizacao jsonb;

CREATE OR REPLACE FUNCTION public.auto_criar_solic_contrato(p_pedido_id uuid, p_contrato_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ped record;
  v_ct record;
  v_tipo uuid;
  v_existing uuid;
  v_solic_id uuid;
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
    ORDER BY created_at DESC
    LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

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

  RETURN v_solic_id;
END;
$function$;

DROP POLICY IF EXISTS "sa_select_anon" ON public.solicitacoes_assinatura;
CREATE POLICY "sa_select_anon" ON public.solicitacoes_assinatura
FOR SELECT TO anon
USING (
  token IS NOT NULL
  AND expira_em > now()
  AND cliente_assinado_em IS NULL
  AND status IN ('aguardando_cliente','rascunho','assinado_loja')
);

DROP POLICY IF EXISTS "sa_update_anon" ON public.solicitacoes_assinatura;
CREATE POLICY "sa_update_anon" ON public.solicitacoes_assinatura
FOR UPDATE TO anon
USING (
  token IS NOT NULL
  AND expira_em > now()
  AND cliente_assinado_em IS NULL
  AND status IN ('aguardando_cliente','rascunho','assinado_loja')
)
WITH CHECK (
  token IS NOT NULL
  AND status IN ('aguardando_loja','concluido','recusado')
);

DROP POLICY IF EXISTS "ap_select_anon" ON public.assinatura_participantes;
CREATE POLICY "ap_select_anon" ON public.assinatura_participantes
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.solicitacoes_assinatura s
    WHERE s.id = solicitacao_id
      AND s.token IS NOT NULL
      AND s.expira_em > now()
      AND s.cliente_assinado_em IS NULL
      AND s.status IN ('aguardando_cliente','rascunho','assinado_loja')
  )
);

DROP POLICY IF EXISTS "ap_insert_anon" ON public.assinatura_participantes;
CREATE POLICY "ap_insert_anon" ON public.assinatura_participantes
FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.solicitacoes_assinatura s
    WHERE s.id = solicitacao_id
      AND s.expira_em > now()
      AND s.cliente_assinado_em IS NULL
      AND s.status IN ('aguardando_cliente','rascunho','assinado_loja')
  )
);

DROP POLICY IF EXISTS "ae_insert_anon" ON public.assinatura_evidencias;
CREATE POLICY "ae_insert_anon" ON public.assinatura_evidencias
FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.solicitacoes_assinatura s
    WHERE s.id = solicitacao_id
      AND s.expira_em > now()
      AND s.cliente_assinado_em IS NULL
      AND s.status IN ('aguardando_cliente','rascunho','assinado_loja')
  )
);

DROP POLICY IF EXISTS "aev_insert_anon" ON public.assinatura_eventos;
CREATE POLICY "aev_insert_anon" ON public.assinatura_eventos
FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.solicitacoes_assinatura s
    WHERE s.id = solicitacao_id
      AND s.expira_em > now()
      AND s.cliente_assinado_em IS NULL
      AND s.status IN ('aguardando_cliente','rascunho','assinado_loja')
  )
);