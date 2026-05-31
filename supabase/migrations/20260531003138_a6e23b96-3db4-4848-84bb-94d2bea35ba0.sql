WITH user_lojas_all AS (
  SELECT ul.user_id, ul.loja_id FROM public.user_lojas ul
  UNION
  SELECT p.user_id, p.loja_id FROM public.profiles p WHERE p.loja_id IS NOT NULL
),
user_bases AS (
  SELECT ula.user_id, l.base_cliente_id
  FROM user_lojas_all ula
  JOIN public.lojas l ON l.id = ula.loja_id
  WHERE l.base_cliente_id IS NOT NULL
  GROUP BY ula.user_id, l.base_cliente_id
),
unica AS (
  SELECT user_id, (array_agg(base_cliente_id))[1] AS base_cliente_id
  FROM user_bases
  GROUP BY user_id
  HAVING COUNT(DISTINCT base_cliente_id) = 1
)
UPDATE public.profiles p
SET base_cliente_id = u.base_cliente_id
FROM unica u
WHERE p.user_id = u.user_id
  AND p.base_cliente_id IS NULL
  AND COALESCE(p.tipo_usuario, 'usuario_base') = 'usuario_base';

CREATE OR REPLACE FUNCTION public.sync_user_base_from_loja()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base UUID;
  v_tipo TEXT;
  v_existing UUID;
BEGIN
  SELECT base_cliente_id INTO v_base FROM public.lojas WHERE id = NEW.loja_id;
  IF v_base IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT base_cliente_id, tipo_usuario INTO v_existing, v_tipo FROM public.profiles WHERE user_id = NEW.user_id;
  IF v_existing IS NULL AND COALESCE(v_tipo, 'usuario_base') = 'usuario_base' THEN
    UPDATE public.profiles SET base_cliente_id = v_base WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_base_from_loja ON public.user_lojas;
CREATE TRIGGER trg_sync_user_base_from_loja
AFTER INSERT ON public.user_lojas
FOR EACH ROW EXECUTE FUNCTION public.sync_user_base_from_loja();