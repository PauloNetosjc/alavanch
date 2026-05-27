CREATE OR REPLACE FUNCTION public.criar_pedido_ao_confirmar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_codigo text;
  v_num int;
  v_pedido_id uuid;
  v_sigla text;
  v_attempts int := 0;
BEGIN
  IF NEW.status IN ('confirmado','convertido','aprovado')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF EXISTS (SELECT 1 FROM public.pedidos WHERE orcamento_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT COALESCE(NULLIF(l.sigla,''),'GER') INTO v_sigla
      FROM public.lojas l WHERE l.id = NEW.loja_id;
    IF v_sigla IS NULL THEN v_sigla := 'GER'; END IF;

    -- gera número aleatório de 4 dígitos ainda não usado para esta sigla
    LOOP
      v_num := 1000 + floor(random() * 9000)::int; -- 1000..9999
      v_codigo := 'PV-' || v_sigla || '-' || LPAD(v_num::text, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.pedidos WHERE codigo = v_codigo);
      v_attempts := v_attempts + 1;
      IF v_attempts > 50 THEN
        -- fallback: expande para 5 dígitos
        v_num := 10000 + floor(random() * 90000)::int;
        v_codigo := 'PV-' || v_sigla || '-' || LPAD(v_num::text, 5, '0');
        IF NOT EXISTS (SELECT 1 FROM public.pedidos WHERE codigo = v_codigo) THEN EXIT; END IF;
      END IF;
    END LOOP;

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