CREATE OR REPLACE FUNCTION public.criar_pedido_ao_confirmar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_codigo text;
  v_seq int;
  v_pedido_id uuid;
BEGIN
  IF NEW.status IN ('confirmado','convertido','aprovado')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF EXISTS (SELECT 1 FROM public.pedidos WHERE orcamento_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    SELECT COALESCE(MAX(CAST(split_part(split_part(codigo,'#',2),'/',1) AS int)),0)+1
      INTO v_seq FROM public.pedidos
      WHERE codigo LIKE 'VENDA #%/' || EXTRACT(YEAR FROM now())::text;
    v_codigo := 'VENDA #' || lpad(v_seq::text,3,'0') || '/' || EXTRACT(YEAR FROM now())::text;
    INSERT INTO public.pedidos (codigo, orcamento_id, cliente_id, loja_id, valor_total, status)
      VALUES (v_codigo, NEW.id, NEW.cliente_id, NEW.loja_id, NEW.total, 'em_producao')
      RETURNING id INTO v_pedido_id;
    INSERT INTO public.pedido_pastas (pedido_id, nome, ordem) VALUES
      (v_pedido_id,'Projetos/PDF',0),
      (v_pedido_id,'Check-in Obra',1),
      (v_pedido_id,'Fotos/Entrega',2);
  END IF;
  RETURN NEW;
END; $$;