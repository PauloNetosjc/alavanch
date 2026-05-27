DROP POLICY IF EXISTS "sa_select_anon" ON public.solicitacoes_assinatura;
CREATE POLICY "sa_select_anon" ON public.solicitacoes_assinatura
FOR SELECT TO anon
USING (
  token IS NOT NULL
  AND expira_em > now()
  AND cliente_assinado_em IS NULL
  AND status IN ('aguardando_cliente','aguardando_loja','rascunho','assinado_loja')
);

DROP POLICY IF EXISTS "td_select_anon_assinatura" ON public.tipos_documento;
CREATE POLICY "td_select_anon_assinatura" ON public.tipos_documento
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.solicitacoes_assinatura s
    WHERE s.tipo_documento_id = tipos_documento.id
      AND s.token IS NOT NULL
      AND s.expira_em > now()
      AND s.cliente_assinado_em IS NULL
      AND s.status IN ('aguardando_cliente','aguardando_loja','rascunho','assinado_loja')
  )
);