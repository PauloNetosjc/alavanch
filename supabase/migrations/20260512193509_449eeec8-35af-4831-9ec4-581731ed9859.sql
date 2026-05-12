CREATE OR REPLACE FUNCTION public.gerar_pedido_codigo_e_inserir()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_codigo text;
  v_seq int;
  v_pedido_id uuid;
  v_sigla text;
  v_pai uuid;
  v_is_adendo boolean;
  v_prefix text;
BEGIN
  IF NEW.status IN ('confirmado','convertido','aprovado')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF EXISTS (SELECT 1 FROM public.pedidos WHERE orcamento_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT COALESCE(NULLIF(l.sigla,''),'GER') INTO v_sigla
      FROM public.lojas l WHERE l.id = NEW.loja_id;
    IF v_sigla IS NULL THEN v_sigla := 'GER'; END IF;

    v_is_adendo := COALESCE(NEW.is_adendo, false);
    v_pai := NEW.pedido_origem_id;
    v_prefix := CASE WHEN v_is_adendo AND v_pai IS NOT NULL THEN 'AD' ELSE 'PV' END;

    SELECT COALESCE(MAX(
      CASE WHEN codigo ~ ('^'||v_prefix||'-'||v_sigla||'-[0-9]+$')
           THEN CAST(SPLIT_PART(codigo,'-',3) AS int)
           ELSE 0 END
    ),0) + 1
      INTO v_seq
      FROM public.pedidos
      WHERE codigo LIKE v_prefix || '-' || v_sigla || '-%';

    v_codigo := v_prefix || '-' || v_sigla || '-' || LPAD(v_seq::text,4,'0');

    INSERT INTO public.pedidos (codigo, orcamento_id, cliente_id, loja_id, valor_total, status, pedido_pai_id, is_adendo)
      VALUES (
        v_codigo, NEW.id, NEW.cliente_id, NEW.loja_id, NEW.total, 'em_producao',
        CASE WHEN v_is_adendo THEN v_pai ELSE NULL END,
        v_is_adendo
      )
      RETURNING id INTO v_pedido_id;

    -- Não cria pastas para adendos (eles vivem dentro do pedido pai)
    IF NOT v_is_adendo THEN
      INSERT INTO public.pedido_pastas (pedido_id, nome, ordem) VALUES
        (v_pedido_id,'Projetos/PDF',0),
        (v_pedido_id,'Check-in Obra',1),
        (v_pedido_id,'Fotos/Entrega',2);
    END IF;
  END IF;
  RETURN NEW;
END; $function$;