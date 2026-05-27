CREATE OR REPLACE FUNCTION public.gerar_lancamentos_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pag record;
  v_cat_id uuid;
  v_n int;
  v_valor_parcela numeric;
  v_data date;
  i int;
  v_det jsonb;
  v_vencs jsonb;
  v_valor_i numeric;
  v_data_i date;
  v_agrupado boolean;
BEGIN
  IF NEW.orcamento_id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.lancamentos_financeiros WHERE pedido_id = NEW.id AND tipo = 'entrada') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_cat_id FROM public.categorias_financeiras
   WHERE tipo = 'entrada' AND nome ILIKE '%recebimento%contrato%' LIMIT 1;

  FOR v_pag IN
    SELECT * FROM public.pagamentos_orcamento WHERE orcamento_id = NEW.orcamento_id
  LOOP
    v_n := GREATEST(COALESCE(v_pag.parcelas, 1), 1);
    v_valor_parcela := ROUND((v_pag.valor / v_n)::numeric, 2);
    v_data := COALESCE(v_pag.data_vencimento, CURRENT_DATE);
    v_det := v_pag.parcelas_detalhe;
    v_vencs := v_pag.parcelas_vencimentos;

    -- Verifica se o método está marcado como "agrupar parcelas no financeiro"
    SELECT COALESCE(mp.agrupado, false) INTO v_agrupado
      FROM public.metodos_pagamento mp
     WHERE mp.nome = v_pag.metodo
     LIMIT 1;

    IF COALESCE(v_agrupado, false) AND v_n > 1 THEN
      -- Agrupa: cria UM único lançamento no vencimento informado
      INSERT INTO public.lancamentos_financeiros (
        tipo, descricao, valor, data_vencimento, status,
        pedido_id, categoria_id, loja_id
      ) VALUES (
        'entrada',
        v_pag.metodo || ' - ' || NEW.codigo || ' (' || v_n || 'x agrupadas)',
        v_pag.valor,
        v_data,
        'pendente',
        NEW.id, v_cat_id, NEW.loja_id
      );
    ELSE
      FOR i IN 1..v_n LOOP
        IF v_det IS NOT NULL AND jsonb_typeof(v_det) = 'array' AND jsonb_array_length(v_det) >= i THEN
          v_valor_i := COALESCE((v_det->>(i-1))::numeric, v_valor_parcela);
        ELSIF i = v_n THEN
          v_valor_i := v_pag.valor - (v_valor_parcela * (v_n - 1));
        ELSE
          v_valor_i := v_valor_parcela;
        END IF;

        IF v_vencs IS NOT NULL AND jsonb_typeof(v_vencs) = 'array' AND jsonb_array_length(v_vencs) >= i AND (v_vencs->>(i-1)) IS NOT NULL THEN
          v_data_i := (v_vencs->>(i-1))::date;
        ELSE
          v_data_i := (v_data + ((i - 1) || ' months')::interval)::date;
        END IF;

        INSERT INTO public.lancamentos_financeiros (
          tipo, descricao, valor, data_vencimento, status,
          pedido_id, categoria_id, loja_id
        ) VALUES (
          'entrada',
          v_pag.metodo || ' - ' || NEW.codigo ||
            CASE WHEN v_n > 1 THEN ' (' || i || '/' || v_n || ')' ELSE '' END,
          v_valor_i,
          v_data_i,
          'pendente',
          NEW.id, v_cat_id, NEW.loja_id
        );
      END LOOP;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;