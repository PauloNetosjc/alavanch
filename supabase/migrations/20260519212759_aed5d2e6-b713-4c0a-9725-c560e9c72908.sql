
-- 1) Fix add_dias_uteis call inside assistencia prazo trigger
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
    NEW.data_limite := public.add_dias_uteis(v_base, v_dias, NEW.loja_id);
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.prioridade,'') IS DISTINCT FROM COALESCE(NEW.prioridade,'') THEN
    NEW.data_limite := public.add_dias_uteis(v_base, v_dias, NEW.loja_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Pedidos: data_entrega, entregador_id, montador_id
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS data_entrega DATE,
  ADD COLUMN IF NOT EXISTS entregador_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS montador_id UUID REFERENCES auth.users(id);

-- 3) Sync agenda → pedido (entrega / montagem)
CREATE OR REPLACE FUNCTION public.fn_agenda_sync_pedido_logistica()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pedido_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.tipo = 'entrega' THEN
    UPDATE public.pedidos
       SET data_entrega = NEW.data,
           entregador_id = COALESCE(NEW.responsavel_id, entregador_id)
     WHERE id = NEW.pedido_id;
  ELSIF NEW.tipo = 'montagem' THEN
    UPDATE public.pedidos
       SET data_montagem = NEW.data,
           montador_id = COALESCE(NEW.responsavel_id, montador_id)
     WHERE id = NEW.pedido_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_sync_pedido_logistica ON public.agenda_eventos;
CREATE TRIGGER trg_agenda_sync_pedido_logistica
AFTER INSERT OR UPDATE OF data, responsavel_id, tipo, pedido_id
ON public.agenda_eventos
FOR EACH ROW EXECUTE FUNCTION public.fn_agenda_sync_pedido_logistica();
