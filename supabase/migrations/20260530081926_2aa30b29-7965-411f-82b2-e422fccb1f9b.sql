
-- 1) Drop overly broad anon SELECT policies driven by always-set tokens
DROP POLICY IF EXISTS clientes_anon_via_validation ON public.clientes;
DROP POLICY IF EXISTS contratos_validation_anon ON public.contratos;
DROP POLICY IF EXISTS pedidos_anon_via_validation ON public.pedidos;
DROP POLICY IF EXISTS pedido_docs_select_anon_token ON public.pedido_documentos;
DROP POLICY IF EXISTS pedido_docs_update_anon_token ON public.pedido_documentos;

-- 2) Tighten anon SELECT on signature audit trail and signed documents
DROP POLICY IF EXISTS aev_select_anon ON public.assinatura_eventos;
CREATE POLICY aev_select_anon ON public.assinatura_eventos
  FOR SELECT TO anon
  USING (public.solic_anon_writeable(solicitacao_id));

DROP POLICY IF EXISTS da_select_anon ON public.documentos_assinados;
CREATE POLICY da_select_anon ON public.documentos_assinados
  FOR SELECT TO anon
  USING (public.solic_anon_writeable(solicitacao_id));

-- 3) Helper: HR access (admin / diretor / gerente)
CREATE OR REPLACE FUNCTION public.is_rh_manager(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin'::app_role)
      OR public.has_role(_uid, 'diretor'::app_role)
      OR public.has_role(_uid, 'gerente'::app_role)
$$;
REVOKE ALL ON FUNCTION public.is_rh_manager(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_rh_manager(uuid) TO authenticated, service_role;

-- 4) RH tables: restrict to HR managers
DROP POLICY IF EXISTS "rh_funcionarios all" ON public.rh_funcionarios;
CREATE POLICY rh_funcionarios_rh_manage ON public.rh_funcionarios
  FOR ALL TO authenticated
  USING (public.is_rh_manager(auth.uid()) AND (loja_id IS NULL OR public.pode_acessar_loja(loja_id)))
  WITH CHECK (public.is_rh_manager(auth.uid()) AND (loja_id IS NULL OR public.pode_acessar_loja(loja_id)));

DROP POLICY IF EXISTS "rh_documentos all" ON public.rh_documentos;
CREATE POLICY rh_documentos_rh_manage ON public.rh_documentos
  FOR ALL TO authenticated
  USING (public.is_rh_manager(auth.uid()))
  WITH CHECK (public.is_rh_manager(auth.uid()));

DROP POLICY IF EXISTS "rh_pontos auth all" ON public.rh_pontos;
CREATE POLICY rh_pontos_rh_manage ON public.rh_pontos
  FOR ALL TO authenticated
  USING (public.is_rh_manager(auth.uid()))
  WITH CHECK (public.is_rh_manager(auth.uid()));

DROP POLICY IF EXISTS "rh_ferias all" ON public.rh_ferias;
CREATE POLICY rh_ferias_rh_manage ON public.rh_ferias
  FOR ALL TO authenticated
  USING (public.is_rh_manager(auth.uid()))
  WITH CHECK (public.is_rh_manager(auth.uid()));

DROP POLICY IF EXISTS "rh_ocorrencias all" ON public.rh_ocorrencias;
CREATE POLICY rh_ocorrencias_rh_manage ON public.rh_ocorrencias
  FOR ALL TO authenticated
  USING (public.is_rh_manager(auth.uid()))
  WITH CHECK (public.is_rh_manager(auth.uid()));

DROP POLICY IF EXISTS "rh zonas auth all" ON public.rh_zonas_ponto;
CREATE POLICY rh_zonas_select_auth ON public.rh_zonas_ponto
  FOR SELECT TO authenticated USING (true);
CREATE POLICY rh_zonas_write_manage ON public.rh_zonas_ponto
  FOR INSERT TO authenticated WITH CHECK (public.is_rh_manager(auth.uid()));
CREATE POLICY rh_zonas_update_manage ON public.rh_zonas_ponto
  FOR UPDATE TO authenticated
  USING (public.is_rh_manager(auth.uid()))
  WITH CHECK (public.is_rh_manager(auth.uid()));
CREATE POLICY rh_zonas_delete_manage ON public.rh_zonas_ponto
  FOR DELETE TO authenticated USING (public.is_rh_manager(auth.uid()));

-- 5) formas_pagamento: restrict writes to admins; reads to authenticated
DROP POLICY IF EXISTS formas_pagamento_select ON public.formas_pagamento;
DROP POLICY IF EXISTS formas_pagamento_insert ON public.formas_pagamento;
DROP POLICY IF EXISTS formas_pagamento_update ON public.formas_pagamento;
DROP POLICY IF EXISTS formas_pagamento_delete ON public.formas_pagamento;

CREATE POLICY formas_pagamento_select ON public.formas_pagamento
  FOR SELECT TO authenticated USING (true);
CREATE POLICY formas_pagamento_insert ON public.formas_pagamento
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY formas_pagamento_update ON public.formas_pagamento
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY formas_pagamento_delete ON public.formas_pagamento
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 6) Storage: drop broad public read; keep targeted anon-signing policies
DROP POLICY IF EXISTS "Public read pedido buckets" ON storage.objects;
DROP POLICY IF EXISTS "ae_storage_select_public" ON storage.objects;

-- Make signature evidence bucket private
UPDATE storage.buckets SET public = false WHERE id = 'assinaturas-evidencias';

-- Authenticated read for signature evidence (loja access enforced via app/signed URLs)
CREATE POLICY ae_storage_select_auth ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'assinaturas-evidencias');

-- Authenticated read for pedido/contract buckets (replaces broad public read)
CREATE POLICY pedido_buckets_select_auth ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = ANY (ARRAY['orcamento-docs','pedido-docs','order-attachments','contratos-assinatura']));
