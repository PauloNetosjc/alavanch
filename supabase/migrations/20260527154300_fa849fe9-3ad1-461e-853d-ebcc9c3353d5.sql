CREATE OR REPLACE FUNCTION public.sincronizar_status_assinatura_por_evidencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solic record;
  v_requer_loja boolean := false;
  v_cliente_assinado timestamptz;
  v_loja_assinado timestamptz;
  v_novo_status public.assinatura_status;
BEGIN
  SELECT s.*, td.requer_assinatura_loja
    INTO v_solic
  FROM public.solicitacoes_assinatura s
  LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
  WHERE s.id = NEW.solicitacao_id;

  IF v_solic.id IS NULL OR v_solic.status IN ('concluido','cancelado','recusado','expirado') THEN
    RETURN NEW;
  END IF;

  v_requer_loja := COALESCE(v_solic.requer_assinatura_loja, false);

  SELECT max(p.assinado_em)
    INTO v_cliente_assinado
  FROM public.assinatura_participantes p
  WHERE p.solicitacao_id = NEW.solicitacao_id
    AND p.tipo = 'cliente'
    AND p.status = 'assinado';

  SELECT max(p.assinado_em)
    INTO v_loja_assinado
  FROM public.assinatura_participantes p
  WHERE p.solicitacao_id = NEW.solicitacao_id
    AND p.tipo = 'loja'
    AND p.status = 'assinado';

  IF v_cliente_assinado IS NULL THEN
    IF v_requer_loja AND v_loja_assinado IS NOT NULL THEN
      UPDATE public.solicitacoes_assinatura
         SET status = 'assinado_loja',
             loja_assinado_em = COALESCE(loja_assinado_em, v_loja_assinado),
             concluido_em = NULL
       WHERE id = NEW.solicitacao_id
         AND status NOT IN ('concluido','cancelado','recusado','expirado');
    END IF;
    RETURN NEW;
  END IF;

  IF v_requer_loja AND v_loja_assinado IS NULL THEN
    v_novo_status := 'aguardando_loja';
  ELSE
    v_novo_status := 'concluido';
  END IF;

  UPDATE public.solicitacoes_assinatura
     SET status = v_novo_status,
         cliente_assinado_em = COALESCE(cliente_assinado_em, v_cliente_assinado, now()),
         loja_assinado_em = CASE WHEN v_loja_assinado IS NOT NULL THEN COALESCE(loja_assinado_em, v_loja_assinado) ELSE loja_assinado_em END,
         concluido_em = CASE WHEN v_novo_status = 'concluido' THEN COALESCE(concluido_em, now()) ELSE NULL END
   WHERE id = NEW.solicitacao_id
     AND status NOT IN ('concluido','cancelado','recusado','expirado');

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sincronizar_contrato_assinado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requer_loja boolean := false;
BEGIN
  IF NEW.contrato_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(td.requer_assinatura_loja, false)
    INTO v_requer_loja
  FROM public.tipos_documento td
  WHERE td.id = NEW.tipo_documento_id;

  IF NEW.status = 'concluido'
     AND NEW.cliente_assinado_em IS NOT NULL
     AND (NOT v_requer_loja OR NEW.loja_assinado_em IS NOT NULL)
     AND (TG_OP = 'INSERT'
          OR OLD.status IS DISTINCT FROM NEW.status
          OR OLD.cliente_assinado_em IS DISTINCT FROM NEW.cliente_assinado_em
          OR OLD.loja_assinado_em IS DISTINCT FROM NEW.loja_assinado_em) THEN
    UPDATE public.contratos
       SET status = 'assinado',
           assinado_em = COALESCE(assinado_em, NEW.concluido_em, NEW.cliente_assinado_em, now()),
           assinatura_nome = COALESCE(assinatura_nome, (
             SELECT p.nome FROM public.assinatura_participantes p
             WHERE p.solicitacao_id = NEW.id AND p.tipo = 'cliente' AND p.status = 'assinado'
             ORDER BY p.assinado_em DESC NULLS LAST LIMIT 1
           )),
           assinatura_cpf = COALESCE(assinatura_cpf, (
             SELECT p.documento FROM public.assinatura_participantes p
             WHERE p.solicitacao_id = NEW.id AND p.tipo = 'cliente' AND p.status = 'assinado'
             ORDER BY p.assinado_em DESC NULLS LAST LIMIT 1
           )),
           metodo_assinatura = COALESCE(metodo_assinatura, 'digital')
     WHERE id = NEW.contrato_id
       AND status <> 'assinado';
  ELSIF NEW.status IN ('aguardando_cliente','assinado_loja','aguardando_loja','assinado_cliente') THEN
    UPDATE public.contratos
       SET status = 'aguardando_assinatura',
           assinado_em = NULL,
           assinatura_nome = NULL,
           assinatura_cpf = NULL
     WHERE id = NEW.contrato_id
       AND status = 'assinado'
       AND NOT EXISTS (
         SELECT 1
         FROM public.solicitacoes_assinatura s
         LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
         WHERE s.contrato_id = NEW.contrato_id
           AND s.status = 'concluido'
           AND s.cliente_assinado_em IS NOT NULL
           AND (COALESCE(td.requer_assinatura_loja, false) = false OR s.loja_assinado_em IS NOT NULL)
       );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contrato_assinado ON public.solicitacoes_assinatura;
CREATE TRIGGER trg_sync_contrato_assinado
AFTER INSERT OR UPDATE OF status, cliente_assinado_em, loja_assinado_em ON public.solicitacoes_assinatura
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_contrato_assinado();

UPDATE public.solicitacoes_assinatura s
   SET status = 'assinado_loja',
       concluido_em = NULL
  FROM public.tipos_documento td
 WHERE td.id = s.tipo_documento_id
   AND COALESCE(td.requer_assinatura_loja, false) = true
   AND s.status = 'concluido'
   AND s.loja_assinado_em IS NOT NULL
   AND s.cliente_assinado_em IS NULL;

UPDATE public.contratos c
   SET status = 'aguardando_assinatura',
       assinado_em = NULL,
       assinatura_nome = NULL,
       assinatura_cpf = NULL
 WHERE status = 'assinado'
   AND EXISTS (
     SELECT 1
     FROM public.solicitacoes_assinatura s
     LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
     WHERE s.contrato_id = c.id
       AND s.loja_assinado_em IS NOT NULL
       AND s.cliente_assinado_em IS NULL
       AND COALESCE(td.requer_assinatura_loja, false) = true
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