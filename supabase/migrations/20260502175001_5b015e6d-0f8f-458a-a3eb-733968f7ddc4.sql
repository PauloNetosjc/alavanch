
-- Vincula orçamento de adendo ao pedido original
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS pedido_origem_id uuid,
  ADD COLUMN IF NOT EXISTS is_adendo boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orcamentos_pedido_origem ON public.orcamentos(pedido_origem_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_pedido_pai ON public.pedidos(pedido_pai_id);

-- Trigger: ao confirmar/converter um orçamento marcado como adendo, copiar pedido_pai_id para o novo pedido
CREATE OR REPLACE FUNCTION public.set_pedido_pai_em_adendo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pai uuid;
  v_is_adendo boolean;
BEGIN
  IF NEW.orcamento_id IS NOT NULL AND NEW.pedido_pai_id IS NULL THEN
    SELECT pedido_origem_id, is_adendo
      INTO v_pai, v_is_adendo
    FROM public.orcamentos WHERE id = NEW.orcamento_id;
    IF v_is_adendo IS TRUE AND v_pai IS NOT NULL THEN
      NEW.pedido_pai_id := v_pai;
      NEW.is_adendo := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_pedido_pai_em_adendo ON public.pedidos;
CREATE TRIGGER trg_set_pedido_pai_em_adendo
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.set_pedido_pai_em_adendo();
