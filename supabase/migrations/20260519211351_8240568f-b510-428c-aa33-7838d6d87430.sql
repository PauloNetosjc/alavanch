
ALTER TABLE public.assistencias ADD COLUMN IF NOT EXISTS data_limite DATE;

CREATE OR REPLACE FUNCTION public.fn_assistencia_set_prazo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_dias int;
  v_base date;
BEGIN
  v_base := COALESCE(NEW.created_at::date, CURRENT_DATE);
  v_dias := CASE lower(COALESCE(NEW.prioridade,'media'))
              WHEN 'baixa' THEN 45
              WHEN 'media' THEN 35
              WHEN 'alta'  THEN 25
              WHEN 'urgente' THEN 7
              ELSE 35
            END;
  IF TG_OP = 'INSERT' THEN
    NEW.data_limite := public.add_dias_uteis(v_base, v_dias);
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.prioridade,'') IS DISTINCT FROM COALESCE(NEW.prioridade,'') THEN
    NEW.data_limite := public.add_dias_uteis(v_base, v_dias);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assistencia_set_prazo ON public.assistencias;
CREATE TRIGGER trg_assistencia_set_prazo
BEFORE INSERT OR UPDATE OF prioridade ON public.assistencias
FOR EACH ROW EXECUTE FUNCTION public.fn_assistencia_set_prazo();

-- Backfill
UPDATE public.assistencias SET prioridade = prioridade WHERE data_limite IS NULL;
