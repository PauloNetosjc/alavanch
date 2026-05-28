
-- 1) Trigger: when a solicitacao becomes cancelado/expirado/recusado, deactivate its pedido_documentos
CREATE OR REPLACE FUNCTION public.fn_inativar_docs_solic_cancelada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelado','expirado','recusado')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.pedido_documentos
       SET ativo = false
     WHERE solicitacao_id = NEW.id
       AND ativo IS DISTINCT FROM false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inativar_docs_solic_cancelada ON public.solicitacoes_assinatura;
CREATE TRIGGER trg_inativar_docs_solic_cancelada
AFTER UPDATE OF status ON public.solicitacoes_assinatura
FOR EACH ROW
EXECUTE FUNCTION public.fn_inativar_docs_solic_cancelada();

-- 2) Trigger: when a contrato becomes cancelado, cancel its solicitacoes and deactivate its docs
CREATE OR REPLACE FUNCTION public.fn_propagar_cancelamento_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelado' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Cancela solicitacoes vinculadas (independente do status anterior, exceto já finalizadas/canceladas)
    UPDATE public.solicitacoes_assinatura
       SET status = 'cancelado',
           cancelado_em = COALESCE(cancelado_em, now())
     WHERE contrato_id = NEW.id
       AND status NOT IN ('cancelado','concluido','assinado_manual');

    -- Deativa documentos atrelados às solicitacoes desse contrato
    UPDATE public.pedido_documentos pd
       SET ativo = false
      FROM public.solicitacoes_assinatura sa
     WHERE pd.solicitacao_id = sa.id
       AND sa.contrato_id = NEW.id
       AND pd.ativo IS DISTINCT FROM false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagar_cancelamento_contrato ON public.contratos;
CREATE TRIGGER trg_propagar_cancelamento_contrato
AFTER UPDATE OF status ON public.contratos
FOR EACH ROW
EXECUTE FUNCTION public.fn_propagar_cancelamento_contrato();

-- 3) Backfill: para contratos já cancelados, cancela solicitacoes e inativa documentos
UPDATE public.solicitacoes_assinatura sa
   SET status = 'cancelado',
       cancelado_em = COALESCE(sa.cancelado_em, now())
  FROM public.contratos c
 WHERE sa.contrato_id = c.id
   AND c.status = 'cancelado'
   AND sa.status NOT IN ('cancelado','concluido','assinado_manual');

UPDATE public.pedido_documentos pd
   SET ativo = false
  FROM public.solicitacoes_assinatura sa
 WHERE pd.solicitacao_id = sa.id
   AND sa.status IN ('cancelado','expirado','recusado')
   AND pd.ativo IS DISTINCT FROM false;
