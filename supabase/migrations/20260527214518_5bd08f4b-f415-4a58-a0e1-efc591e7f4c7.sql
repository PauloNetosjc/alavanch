
-- Helper: a solicitação aceita escritas anônimas enquanto o token estiver válido
CREATE OR REPLACE FUNCTION public.solic_anon_writeable(_solic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.solicitacoes_assinatura s
     WHERE s.id = _solic_id
       AND s.token IS NOT NULL
       AND s.expira_em > now()
       AND s.status <> ALL (ARRAY['cancelado'::assinatura_status, 'expirado'::assinatura_status, 'recusado'::assinatura_status])
  )
$$;

-- 1) solicitacoes_assinatura: permitir UPDATE pelo anon enquanto solicitação está ativa
DROP POLICY IF EXISTS sa_update_anon ON public.solicitacoes_assinatura;
CREATE POLICY sa_update_anon ON public.solicitacoes_assinatura
  FOR UPDATE TO anon
  USING (
    token IS NOT NULL
    AND expira_em > now()
    AND status <> ALL (ARRAY['cancelado'::assinatura_status, 'expirado'::assinatura_status, 'recusado'::assinatura_status])
  )
  WITH CHECK (
    token IS NOT NULL
    AND status <> ALL (ARRAY['cancelado'::assinatura_status, 'expirado'::assinatura_status])
  );

-- SELECT anon precisa funcionar também depois do cliente assinar (para reler estado)
DROP POLICY IF EXISTS sa_select_anon ON public.solicitacoes_assinatura;
CREATE POLICY sa_select_anon ON public.solicitacoes_assinatura
  FOR SELECT TO anon
  USING (
    token IS NOT NULL
    AND expira_em > now()
    AND status <> ALL (ARRAY['cancelado'::assinatura_status, 'expirado'::assinatura_status])
  );

-- 2) assinatura_evidencias: permitir INSERT pelo anon enquanto solicitação está ativa (sem exigir cliente_assinado_em IS NULL)
DROP POLICY IF EXISTS ae_insert_anon ON public.assinatura_evidencias;
CREATE POLICY ae_insert_anon ON public.assinatura_evidencias
  FOR INSERT TO anon
  WITH CHECK (public.solic_anon_writeable(solicitacao_id));

-- 3) assinatura_eventos: idem (existem duas policies redundantes - aev_insert_anon e ev_insert_anon)
DROP POLICY IF EXISTS aev_insert_anon ON public.assinatura_eventos;
CREATE POLICY aev_insert_anon ON public.assinatura_eventos
  FOR INSERT TO anon
  WITH CHECK (public.solic_anon_writeable(solicitacao_id));

DROP POLICY IF EXISTS ev_insert_anon ON public.assinatura_eventos;

-- 4) contratos: permitir UPDATE pelo anon enquanto há solicitação anon ativa associada
DROP POLICY IF EXISTS contratos_update_public_by_token ON public.contratos;
CREATE POLICY contratos_update_public_by_token ON public.contratos
  FOR UPDATE TO anon
  USING (public.contrato_has_active_anon_solic(id))
  WITH CHECK (public.contrato_has_active_anon_solic(id));

-- 5) pedido_documentos: permitir INSERT e UPDATE pelo anon quando o documento pertence a uma solicitação anon ativa
CREATE OR REPLACE FUNCTION public.pedido_doc_anon_writeable(_solic_id uuid, _pedido_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE WHEN _solic_id IS NOT NULL THEN public.solic_anon_writeable(_solic_id)
    ELSE EXISTS (
      SELECT 1 FROM public.solicitacoes_assinatura s
       WHERE s.pedido_id = _pedido_id
         AND s.token IS NOT NULL
         AND s.expira_em > now()
         AND s.status <> ALL (ARRAY['cancelado'::assinatura_status, 'expirado'::assinatura_status, 'recusado'::assinatura_status])
    ) END
$$;

DROP POLICY IF EXISTS pedido_docs_insert_anon_via_solic ON public.pedido_documentos;
CREATE POLICY pedido_docs_insert_anon_via_solic ON public.pedido_documentos
  FOR INSERT TO anon
  WITH CHECK (public.pedido_doc_anon_writeable(solicitacao_id, pedido_id));

DROP POLICY IF EXISTS pedido_docs_update_anon_via_solic ON public.pedido_documentos;
CREATE POLICY pedido_docs_update_anon_via_solic ON public.pedido_documentos
  FOR UPDATE TO anon
  USING (public.pedido_doc_anon_writeable(solicitacao_id, pedido_id))
  WITH CHECK (public.pedido_doc_anon_writeable(solicitacao_id, pedido_id));

GRANT EXECUTE ON FUNCTION public.solic_anon_writeable(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pedido_doc_anon_writeable(uuid, uuid) TO anon, authenticated;
