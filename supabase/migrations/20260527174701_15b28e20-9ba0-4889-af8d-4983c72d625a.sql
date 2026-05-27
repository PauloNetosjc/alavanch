CREATE OR REPLACE FUNCTION public.validar_solicitacao_assinatura_completa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requer_loja boolean := false;
BEGIN
  SELECT COALESCE(td.requer_assinatura_loja, false)
    INTO v_requer_loja
  FROM public.tipos_documento td
  WHERE td.id = NEW.tipo_documento_id;

  IF NEW.status = 'concluido'
     AND (
       NEW.cliente_assinado_em IS NULL
       OR (v_requer_loja AND NEW.loja_assinado_em IS NULL)
     ) THEN
    RAISE EXCEPTION 'Assinatura incompleta: cliente e loja precisam assinar antes de concluir.';
  END IF;

  IF (NEW.final_pdf_url IS NOT NULL OR NEW.final_pdf_storage_path IS NOT NULL)
     AND NOT (
       NEW.status = 'concluido'
       AND NEW.cliente_assinado_em IS NOT NULL
       AND (NOT v_requer_loja OR NEW.loja_assinado_em IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'PDF final só pode ser registrado após assinatura completa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_solicitacao_assinatura_completa ON public.solicitacoes_assinatura;
CREATE TRIGGER trg_validar_solicitacao_assinatura_completa
BEFORE INSERT OR UPDATE OF status, cliente_assinado_em, loja_assinado_em, final_pdf_url, final_pdf_storage_path
ON public.solicitacoes_assinatura
FOR EACH ROW
EXECUTE FUNCTION public.validar_solicitacao_assinatura_completa();

DELETE FROM public.documentos_assinados da
USING public.solicitacoes_assinatura s
LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
WHERE da.solicitacao_id = s.id
  AND NOT (
    s.status = 'concluido'
    AND s.cliente_assinado_em IS NOT NULL
    AND (COALESCE(td.requer_assinatura_loja, false) = false OR s.loja_assinado_em IS NOT NULL)
  );

UPDATE public.solicitacoes_assinatura s
   SET final_pdf_url = NULL,
       final_pdf_storage_path = NULL,
       concluido_em = NULL,
       status = CASE
         WHEN COALESCE(td.requer_assinatura_loja, false) = true AND s.loja_assinado_em IS NOT NULL THEN 'assinado_loja'::public.assinatura_status
         WHEN COALESCE(td.requer_assinatura_loja, false) = true THEN 'aguardando_loja'::public.assinatura_status
         WHEN s.cliente_assinado_em IS NOT NULL THEN 'concluido'::public.assinatura_status
         ELSE 'aguardando_cliente'::public.assinatura_status
       END
  FROM public.tipos_documento td
 WHERE td.id = s.tipo_documento_id
   AND (s.final_pdf_url IS NOT NULL OR s.final_pdf_storage_path IS NOT NULL OR s.status = 'concluido')
   AND NOT (
     s.status = 'concluido'
     AND s.cliente_assinado_em IS NOT NULL
     AND (COALESCE(td.requer_assinatura_loja, false) = false OR s.loja_assinado_em IS NOT NULL)
   );

UPDATE public.contratos c
   SET status = 'aguardando_assinatura',
       assinado_em = NULL,
       assinatura_nome = NULL,
       assinatura_cpf = NULL,
       pdf_assinado_url = NULL
 WHERE EXISTS (
   SELECT 1
   FROM public.solicitacoes_assinatura s
   LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
   WHERE s.contrato_id = c.id
     AND s.status NOT IN ('cancelado','recusado','expirado')
     AND NOT (
       s.status = 'concluido'
       AND s.cliente_assinado_em IS NOT NULL
       AND (COALESCE(td.requer_assinatura_loja, false) = false OR s.loja_assinado_em IS NOT NULL)
     )
 )
 AND NOT EXISTS (
   SELECT 1
   FROM public.solicitacoes_assinatura s
   LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
   WHERE s.contrato_id = c.id
     AND s.status = 'concluido'
     AND s.cliente_assinado_em IS NOT NULL
     AND (COALESCE(td.requer_assinatura_loja, false) = false OR s.loja_assinado_em IS NOT NULL)
 );