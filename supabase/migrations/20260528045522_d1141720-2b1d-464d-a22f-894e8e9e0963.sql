-- =====================================================================
-- Fase 4: Gatilhos automáticos do Motor de Tarefas Nativas
-- =====================================================================

-- Trigger 1: solicitacoes_assinatura → pedido_assinado / contrato_criado
CREATE OR REPLACE FUNCTION public.trg_fn_tarefas_nativas_assinatura()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      IF NEW.pedido_id IS NOT NULL THEN
        PERFORM public.fn_instanciar_tarefas_nativas(NEW.pedido_id, 'contrato_criado');
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.pedido_id IS NOT NULL
         AND NEW.status IS DISTINCT FROM OLD.status
         AND NEW.status IN ('concluido','assinado_manual') THEN
        PERFORM public.fn_instanciar_tarefas_nativas(NEW.pedido_id, 'pedido_assinado');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tarefas_nativas assinatura trigger falhou: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarefas_nativas_assinatura_ins ON public.solicitacoes_assinatura;
CREATE TRIGGER trg_tarefas_nativas_assinatura_ins
AFTER INSERT ON public.solicitacoes_assinatura
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_tarefas_nativas_assinatura();

DROP TRIGGER IF EXISTS trg_tarefas_nativas_assinatura_upd ON public.solicitacoes_assinatura;
CREATE TRIGGER trg_tarefas_nativas_assinatura_upd
AFTER UPDATE OF status ON public.solicitacoes_assinatura
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_tarefas_nativas_assinatura();

-- Trigger 2: agenda_eventos → tipo → gatilho correspondente
CREATE OR REPLACE FUNCTION public.trg_fn_tarefas_nativas_agenda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gatilho text;
BEGIN
  BEGIN
    IF NEW.pedido_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_gatilho := CASE NEW.tipo::text
      WHEN 'medicao_tecnica'      THEN 'medicao_tecnica_agendada'
      WHEN 'revisao_final'        THEN 'revisao_final_agendada'
      WHEN 'entrega'              THEN 'entrega_agendada'
      WHEN 'montagem'             THEN 'montagem_agendada'
      WHEN 'assistencia_tecnica'  THEN 'assistencia_agendada'
      ELSE NULL
    END;

    IF v_gatilho IS NOT NULL THEN
      PERFORM public.fn_instanciar_tarefas_nativas(NEW.pedido_id, v_gatilho);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tarefas_nativas agenda trigger falhou: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarefas_nativas_agenda_ins ON public.agenda_eventos;
CREATE TRIGGER trg_tarefas_nativas_agenda_ins
AFTER INSERT ON public.agenda_eventos
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_tarefas_nativas_agenda();
