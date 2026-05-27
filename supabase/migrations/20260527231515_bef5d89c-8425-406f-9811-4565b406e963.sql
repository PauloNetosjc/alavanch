CREATE OR REPLACE FUNCTION public.validar_solicitacao_assinatura_completa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_requer_loja boolean := false;
BEGIN
  -- Fluxo manual: bypassa validação de assinatura digital completa
  IF NEW.status IN ('assinado_manual','concluido_manual','cancelado_manual') THEN
    RETURN NEW;
  END IF;

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
$function$;