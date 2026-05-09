CREATE POLICY "templates_anon_via_assinatura"
ON public.contratos_template
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.solicitacoes_assinatura s
    JOIN public.contratos c ON c.id = s.contrato_id
    WHERE c.template_id = contratos_template.id
      AND s.token IS NOT NULL
  )
);