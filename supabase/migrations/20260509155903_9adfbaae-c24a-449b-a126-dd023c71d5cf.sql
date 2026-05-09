
-- 1) Sigla das lojas
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS sigla text;

UPDATE public.lojas SET sigla = UPPER(SUBSTRING(REGEXP_REPLACE(nome,'[^A-Za-zÀ-ÿ]','','g'),1,3)) WHERE sigla IS NULL OR sigla = '';

-- 2) Urgência em pedidos
DO $$ BEGIN
  CREATE TYPE public.urgencia_nivel AS ENUM ('baixa','media','alta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS urgencia public.urgencia_nivel DEFAULT 'baixa';

-- 3) Reformatar códigos existentes: PV-<SIGLA>-<NUM4>
WITH base AS (
  SELECT
    p.id,
    COALESCE(NULLIF(l.sigla,''), 'GER') AS sigla,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(NULLIF(l.sigla,''),'GER') ORDER BY p.created_at, p.id) AS rn
  FROM public.pedidos p
  LEFT JOIN public.lojas l ON l.id = p.loja_id
)
UPDATE public.pedidos p
SET codigo = 'PV-' || b.sigla || '-' || LPAD(b.rn::text, 4, '0')
FROM base b
WHERE b.id = p.id;

-- 4) Atualizar gatilho de criação de pedido
CREATE OR REPLACE FUNCTION public.criar_pedido_ao_confirmar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_codigo text;
  v_seq int;
  v_pedido_id uuid;
  v_sigla text;
BEGIN
  IF NEW.status IN ('confirmado','convertido','aprovado')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF EXISTS (SELECT 1 FROM public.pedidos WHERE orcamento_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT COALESCE(NULLIF(l.sigla,''),'GER') INTO v_sigla
      FROM public.lojas l WHERE l.id = NEW.loja_id;
    IF v_sigla IS NULL THEN v_sigla := 'GER'; END IF;

    SELECT COALESCE(MAX(
      CASE WHEN codigo ~ ('^PV-'||v_sigla||'-[0-9]+$')
           THEN CAST(SPLIT_PART(codigo,'-',3) AS int)
           ELSE 0 END
    ),0) + 1
      INTO v_seq
      FROM public.pedidos
      WHERE codigo LIKE 'PV-' || v_sigla || '-%';

    v_codigo := 'PV-' || v_sigla || '-' || LPAD(v_seq::text,4,'0');

    INSERT INTO public.pedidos (codigo, orcamento_id, cliente_id, loja_id, valor_total, status)
      VALUES (v_codigo, NEW.id, NEW.cliente_id, NEW.loja_id, NEW.total, 'em_producao')
      RETURNING id INTO v_pedido_id;
    INSERT INTO public.pedido_pastas (pedido_id, nome, ordem) VALUES
      (v_pedido_id,'Projetos/PDF',0),
      (v_pedido_id,'Check-in Obra',1),
      (v_pedido_id,'Fotos/Entrega',2);
  END IF;
  RETURN NEW;
END; $function$;
