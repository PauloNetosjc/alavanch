DROP POLICY IF EXISTS "sa_update_anon" ON public.solicitacoes_assinatura;
CREATE POLICY "sa_update_anon"
ON public.solicitacoes_assinatura
FOR UPDATE
TO anon
USING (
  token IS NOT NULL
  AND status = ANY (ARRAY[
    'aguardando_cliente'::assinatura_status,
    'rascunho'::assinatura_status,
    'assinado_cliente'::assinatura_status,
    'aguardando_loja'::assinatura_status,
    'assinado_loja'::assinatura_status
  ])
  AND expira_em > now()
)
WITH CHECK (
  token IS NOT NULL
  AND expira_em > now()
  AND status = ANY (ARRAY[
    'assinado_cliente'::assinatura_status,
    'aguardando_loja'::assinatura_status,
    'assinado_loja'::assinatura_status,
    'concluido'::assinatura_status,
    'recusado'::assinatura_status
  ])
);

DROP POLICY IF EXISTS "ap_insert_anon" ON public.assinatura_participantes;
CREATE POLICY "ap_insert_anon"
ON public.assinatura_participantes
FOR INSERT
TO anon
WITH CHECK (
  tipo = 'cliente'
  AND EXISTS (
    SELECT 1
    FROM public.solicitacoes_assinatura s
    WHERE s.id = solicitacao_id
      AND s.expira_em > now()
      AND s.status IN ('aguardando_cliente','rascunho','assinado_loja')
  )
);

DROP POLICY IF EXISTS "ae_insert_anon" ON public.assinatura_evidencias;
CREATE POLICY "ae_insert_anon"
ON public.assinatura_evidencias
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.solicitacoes_assinatura s
    LEFT JOIN public.assinatura_participantes p ON p.id = assinatura_evidencias.participante_id
    WHERE s.id = solicitacao_id
      AND s.expira_em > now()
      AND s.status IN ('aguardando_cliente','rascunho','assinado_cliente','assinado_loja')
      AND p.tipo = 'cliente'
  )
);