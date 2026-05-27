-- 1) Adicionar valor 'assinado_manual' ao enum assinatura_status (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'assinatura_status' AND e.enumlabel = 'assinado_manual'
  ) THEN
    ALTER TYPE public.assinatura_status ADD VALUE 'assinado_manual';
  END IF;
END $$;

-- 2) Colunas em assinatura_evidencias para diferenciar evidências manuais e tipá-las
ALTER TABLE public.assinatura_evidencias
  ADD COLUMN IF NOT EXISTS manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo text;

-- 3) Garantir vínculo opcional de solicitação em pedido_documentos (para a Central)
ALTER TABLE public.pedido_documentos
  ADD COLUMN IF NOT EXISTS solicitacao_id uuid;

-- 4) Ajustar bloqueio do workflow: liberar também por assinatura manual
CREATE OR REPLACE FUNCTION public.bloquear_workflow_sem_assinatura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status_contrato text;
  v_status_solic text;
BEGIN
  IF NEW.workflow_estagio IS DISTINCT FROM OLD.workflow_estagio
     AND NEW.workflow_estagio IS NOT NULL
     AND NEW.workflow_estagio <> 'aguardando'
     AND NEW.orcamento_id IS NOT NULL THEN

    SELECT status INTO v_status_contrato FROM public.contratos
      WHERE orcamento_id = NEW.orcamento_id
      ORDER BY created_at DESC LIMIT 1;

    -- Libera se contrato 'assinado'
    IF v_status_contrato = 'assinado' THEN
      RETURN NEW;
    END IF;

    -- Libera também se houver solicitação concluída OU assinada manualmente para este pedido
    SELECT s.status::text INTO v_status_solic
      FROM public.solicitacoes_assinatura s
     WHERE s.pedido_id = NEW.id
       AND s.status IN ('concluido','assinado_manual')
     ORDER BY s.created_at DESC LIMIT 1;

    IF v_status_solic IS NOT NULL THEN
      RETURN NEW;
    END IF;

    IF v_status_contrato IS NOT NULL AND v_status_contrato <> 'assinado' THEN
      RAISE EXCEPTION 'Não é possível avançar o workflow operacional: contrato ainda não foi assinado (digital ou manual).';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5) Não sobrescrever solicitação marcada como assinado_manual
CREATE OR REPLACE FUNCTION public.recalcular_status_solicitacao(p_solic uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_solic record;
  v_requer_loja boolean;
  v_cliente_assinado timestamptz;
  v_loja_assinado timestamptz;
  v_qtd_recusado int;
  v_novo public.assinatura_status;
BEGIN
  SELECT s.*, COALESCE(td.requer_assinatura_loja,false) AS requer_loja
    INTO v_solic
  FROM public.solicitacoes_assinatura s
  LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
  WHERE s.id = p_solic;

  IF v_solic.id IS NULL THEN RETURN; END IF;
  IF v_solic.status IN ('cancelado','recusado','expirado','assinado_manual') THEN RETURN; END IF;

  v_requer_loja := v_solic.requer_loja;

  SELECT max(assinado_em) INTO v_cliente_assinado
    FROM public.assinatura_participantes
   WHERE solicitacao_id = p_solic AND tipo = 'cliente' AND status = 'assinado';

  SELECT max(assinado_em) INTO v_loja_assinado
    FROM public.assinatura_participantes
   WHERE solicitacao_id = p_solic AND tipo = 'loja' AND status = 'assinado';

  SELECT count(*) INTO v_qtd_recusado
    FROM public.assinatura_participantes
   WHERE solicitacao_id = p_solic AND status = 'recusado';

  IF v_qtd_recusado > 0 THEN
    v_novo := 'recusado';
  ELSIF v_solic.expira_em < now()
        AND (v_cliente_assinado IS NULL OR (v_requer_loja AND v_loja_assinado IS NULL)) THEN
    v_novo := 'expirado';
  ELSIF v_requer_loja THEN
    IF v_cliente_assinado IS NOT NULL AND v_loja_assinado IS NOT NULL THEN
      v_novo := 'concluido';
    ELSIF v_loja_assinado IS NOT NULL THEN
      v_novo := 'assinado_loja';
    ELSIF v_cliente_assinado IS NOT NULL THEN
      v_novo := 'aguardando_loja';
    ELSE
      v_novo := 'aguardando_loja';
    END IF;
  ELSE
    v_novo := CASE WHEN v_cliente_assinado IS NOT NULL THEN 'concluido' ELSE 'aguardando_cliente' END;
  END IF;

  UPDATE public.solicitacoes_assinatura
     SET status = v_novo,
         cliente_assinado_em = COALESCE(cliente_assinado_em, v_cliente_assinado),
         loja_assinado_em    = COALESCE(loja_assinado_em, v_loja_assinado),
         concluido_em        = CASE WHEN v_novo = 'concluido' THEN COALESCE(concluido_em, now()) ELSE concluido_em END,
         updated_at          = now()
   WHERE id = p_solic
     AND status NOT IN ('cancelado','recusado','expirado','assinado_manual');
END $function$;