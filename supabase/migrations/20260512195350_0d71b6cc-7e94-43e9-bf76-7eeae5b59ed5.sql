
-- Add receita_codigo to pedidos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS receita_codigo text UNIQUE;

CREATE OR REPLACE FUNCTION public.gerar_receita_codigo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  IF NEW.receita_codigo IS NOT NULL AND NEW.receita_codigo <> '' THEN
    RETURN NEW;
  END IF;
  LOOP
    v_code := lpad((floor(random() * 99999) + 1)::int::text, 5, '0');
    SELECT EXISTS(SELECT 1 FROM public.pedidos WHERE receita_codigo = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  NEW.receita_codigo := v_code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gerar_receita_codigo ON public.pedidos;
CREATE TRIGGER trg_gerar_receita_codigo
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.gerar_receita_codigo();

-- Backfill existing pedidos
DO $$
DECLARE
  r record;
  v_code text;
  v_exists boolean;
BEGIN
  FOR r IN SELECT id FROM public.pedidos WHERE receita_codigo IS NULL LOOP
    LOOP
      v_code := lpad((floor(random() * 99999) + 1)::int::text, 5, '0');
      SELECT EXISTS(SELECT 1 FROM public.pedidos WHERE receita_codigo = v_code) INTO v_exists;
      EXIT WHEN NOT v_exists;
    END LOOP;
    UPDATE public.pedidos SET receita_codigo = v_code WHERE id = r.id;
  END LOOP;
END $$;
