-- Trava global: card só pode ser movido/removido se o checklist do estágio atual estiver concluído

CREATE OR REPLACE FUNCTION public.checklist_estagio_concluido(_pedido_id uuid, _estagio_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tpl uuid;
  _total int;
  _pendentes int;
BEGIN
  SELECT checklist_template_id INTO _tpl FROM public.pipeline_estagios WHERE id = _estagio_id;
  IF _tpl IS NULL THEN
    RETURN true; -- sem checklist configurado, libera
  END IF;

  SELECT count(*) INTO _total FROM public.pedido_estagio_checklist
    WHERE pedido_id = _pedido_id AND estagio_id = _estagio_id;

  -- Se nenhum item foi gerado ainda, considera não concluído
  IF _total = 0 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO _pendentes FROM public.pedido_estagio_checklist
    WHERE pedido_id = _pedido_id AND estagio_id = _estagio_id AND coalesce(concluido,false) = false;

  RETURN _pendentes = 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.kanban_bloquear_sem_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
  _origem text;
BEGIN
  -- ignora movimentações automáticas vindas de triggers internos (automações kanban)
  _origem := current_setting('app.kanban_origem', true);

  IF (TG_OP = 'UPDATE') THEN
    -- só valida se realmente mudou de estágio
    IF NEW.estagio_id IS DISTINCT FROM OLD.estagio_id THEN
      IF coalesce(_origem, '') = 'automacao' THEN
        RETURN NEW;
      END IF;
      _ok := public.checklist_estagio_concluido(OLD.pedido_id, OLD.estagio_id);
      IF NOT _ok THEN
        RAISE EXCEPTION 'Conclua o checklist do estágio atual antes de movimentar este card.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF coalesce(_origem, '') = 'automacao' THEN
      RETURN OLD;
    END IF;
    _ok := public.checklist_estagio_concluido(OLD.pedido_id, OLD.estagio_id);
    IF NOT _ok THEN
      RAISE EXCEPTION 'Conclua o checklist do estágio atual antes de remover este card.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_bloquear_sem_checklist ON public.kanban_cards;
CREATE TRIGGER trg_kanban_bloquear_sem_checklist
BEFORE UPDATE OR DELETE ON public.kanban_cards
FOR EACH ROW EXECUTE FUNCTION public.kanban_bloquear_sem_checklist();