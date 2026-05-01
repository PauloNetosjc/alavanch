-- 1) Trigger auditoria de status em assistencias
CREATE OR REPLACE FUNCTION public.log_assistencia_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  -- Só registra se houve mudança real de status
  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    BEGIN
      v_uid := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      v_uid := NULL;
    END;

    INSERT INTO public.timeline_eventos (
      entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata
    ) VALUES (
      'assistencia',
      NEW.id,
      'status_change',
      'Status: ' || COALESCE(OLD.status,'(novo)') || ' → ' || COALESCE(NEW.status,'(nulo)'),
      v_uid,
      jsonb_build_object(
        'de', OLD.status,
        'para', NEW.status,
        'arquivada', NEW.arquivada,
        'tecnico_id', NEW.tecnico_id
      )
    );
  END IF;

  -- Audita arquivamento/desarquivamento
  IF TG_OP = 'UPDATE' AND (OLD.arquivada IS DISTINCT FROM NEW.arquivada) THEN
    BEGIN
      v_uid := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      v_uid := NULL;
    END;

    INSERT INTO public.timeline_eventos (
      entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata
    ) VALUES (
      'assistencia',
      NEW.id,
      CASE WHEN NEW.arquivada THEN 'arquivamento' ELSE 'desarquivamento' END,
      CASE WHEN NEW.arquivada THEN 'Chamado arquivado' ELSE 'Chamado desarquivado' END,
      v_uid,
      jsonb_build_object('status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assistencia_status_change ON public.assistencias;
CREATE TRIGGER trg_assistencia_status_change
AFTER UPDATE ON public.assistencias
FOR EACH ROW
EXECUTE FUNCTION public.log_assistencia_status_change();

-- 2) Trigger para mudança de técnico (re-atribuição)
CREATE OR REPLACE FUNCTION public.log_assistencia_tecnico_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_old text;
  v_new text;
BEGIN
  IF TG_OP = 'UPDATE' AND (COALESCE(OLD.tecnico_id::text,'') IS DISTINCT FROM COALESCE(NEW.tecnico_id::text,'')) THEN
    BEGIN
      v_uid := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      v_uid := NULL;
    END;

    SELECT nome_completo INTO v_old FROM public.profiles WHERE user_id = OLD.tecnico_id LIMIT 1;
    SELECT nome_completo INTO v_new FROM public.profiles WHERE user_id = NEW.tecnico_id LIMIT 1;

    INSERT INTO public.timeline_eventos (
      entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata
    ) VALUES (
      'assistencia',
      NEW.id,
      'tecnico_change',
      CASE
        WHEN OLD.tecnico_id IS NULL THEN 'Técnico atribuído: ' || COALESCE(v_new,'—')
        WHEN NEW.tecnico_id IS NULL THEN 'Técnico removido: ' || COALESCE(v_old,'—')
        ELSE 'Técnico alterado: ' || COALESCE(v_old,'—') || ' → ' || COALESCE(v_new,'—')
      END,
      v_uid,
      jsonb_build_object('de', OLD.tecnico_id, 'para', NEW.tecnico_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assistencia_tecnico_change ON public.assistencias;
CREATE TRIGGER trg_assistencia_tecnico_change
AFTER UPDATE ON public.assistencias
FOR EACH ROW
EXECUTE FUNCTION public.log_assistencia_tecnico_change();

-- 3) Trigger para mudança de prioridade
CREATE OR REPLACE FUNCTION public.log_assistencia_prioridade_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND (COALESCE(OLD.prioridade,'') IS DISTINCT FROM COALESCE(NEW.prioridade,'')) THEN
    BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;
    INSERT INTO public.timeline_eventos (
      entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata
    ) VALUES (
      'assistencia', NEW.id, 'prioridade_change',
      'Prioridade: ' || COALESCE(OLD.prioridade,'—') || ' → ' || COALESCE(NEW.prioridade,'—'),
      v_uid,
      jsonb_build_object('de', OLD.prioridade, 'para', NEW.prioridade)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assistencia_prioridade_change ON public.assistencias;
CREATE TRIGGER trg_assistencia_prioridade_change
AFTER UPDATE ON public.assistencias
FOR EACH ROW
EXECUTE FUNCTION public.log_assistencia_prioridade_change();

-- 4) Trigger para material ficar disponível
CREATE OR REPLACE FUNCTION public.log_material_disponivel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.disponivel IS DISTINCT FROM NEW.disponivel AND NEW.disponivel = true THEN
    BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;
    INSERT INTO public.timeline_eventos (
      entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata
    ) VALUES (
      'assistencia', NEW.assistencia_id, 'material_disponivel',
      'Material disponível: ' || NEW.descricao || ' (x' || NEW.quantidade || ')',
      v_uid,
      jsonb_build_object('material_id', NEW.id, 'origem', NEW.origem)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_material_disponivel ON public.materiais_assistencia;
CREATE TRIGGER trg_material_disponivel
AFTER UPDATE ON public.materiais_assistencia
FOR EACH ROW
EXECUTE FUNCTION public.log_material_disponivel();