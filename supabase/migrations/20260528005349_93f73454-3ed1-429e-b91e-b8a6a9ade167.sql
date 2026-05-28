
-- 1) Função geradora — suporta parcelas_detalhe como array de objetos OU array de números,
--    usando parcelas_vencimentos / parcelas_formas como colunas paralelas.
CREATE OR REPLACE FUNCTION public.gerar_receber_de_pedido_assinado(p_pedido_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ped record;
  v_cat_id uuid;
  v_pag record;
  v_idx int := 1;
  v_total_parcelas int := 0;
  v_det jsonb;
  v_venc_arr jsonb;
  v_forma_arr jsonb;
  v_el jsonb;
  v_qtd int;
  v_valor_total numeric;
  v_valor_parc numeric;
  v_base_date date;
  v_venc date;
  v_k int;
  v_forma text;
  v_valor numeric;
  v_metodo text;
BEGIN
  SELECT * INTO v_ped FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_ped.orcamento_id IS NULL THEN RETURN; END IF;

  -- Idempotência por pedido
  IF EXISTS (SELECT 1 FROM public.lancamentos_financeiros WHERE pedido_id = p_pedido_id AND tipo = 'entrada') THEN
    RETURN;
  END IF;

  SELECT id INTO v_cat_id FROM public.categorias_financeiras
   WHERE tipo='entrada' AND nome ILIKE '%recebimento%contrato%' LIMIT 1;

  -- Conta total de parcelas para descrição "X/Y"
  FOR v_pag IN SELECT * FROM public.pagamentos_orcamento WHERE orcamento_id = v_ped.orcamento_id LOOP
    v_det := v_pag.parcelas_detalhe;
    IF v_det IS NOT NULL AND jsonb_typeof(v_det) = 'array' AND jsonb_array_length(v_det) > 0 THEN
      v_total_parcelas := v_total_parcelas + jsonb_array_length(v_det);
    ELSE
      v_total_parcelas := v_total_parcelas + COALESCE(v_pag.parcelas, 1);
    END IF;
  END LOOP;

  IF v_total_parcelas = 0 THEN RETURN; END IF;

  FOR v_pag IN SELECT * FROM public.pagamentos_orcamento WHERE orcamento_id = v_ped.orcamento_id ORDER BY created_at LOOP
    v_metodo := v_pag.metodo;
    v_det := v_pag.parcelas_detalhe;
    v_venc_arr := v_pag.parcelas_vencimentos;
    v_forma_arr := v_pag.parcelas_formas;

    IF v_det IS NOT NULL AND jsonb_typeof(v_det) = 'array' AND jsonb_array_length(v_det) > 0 THEN
      FOR v_k IN 0..(jsonb_array_length(v_det) - 1) LOOP
        v_el := v_det -> v_k;

        IF jsonb_typeof(v_el) = 'object' THEN
          -- Formato A: objeto { valor, data_vencimento, forma_pagamento }
          v_valor := COALESCE((v_el->>'valor')::numeric, 0);
          v_venc := NULLIF(COALESCE(v_el->>'data_vencimento', v_el->>'data'), '')::date;
          v_forma := COALESCE(NULLIF(v_el->>'forma_pagamento',''), NULLIF(v_el->>'forma',''), NULL);
        ELSE
          -- Formato B: número cru; vencimento/forma vêm de colunas paralelas
          v_valor := COALESCE((v_el#>>'{}')::numeric, 0);
          v_venc := NULL;
          v_forma := NULL;
        END IF;

        -- Fallback usando arrays paralelos
        IF v_venc IS NULL AND v_venc_arr IS NOT NULL AND jsonb_typeof(v_venc_arr) = 'array'
           AND jsonb_array_length(v_venc_arr) > v_k THEN
          v_venc := NULLIF(v_venc_arr->>v_k, '')::date;
        END IF;
        IF v_forma IS NULL AND v_forma_arr IS NOT NULL AND jsonb_typeof(v_forma_arr) = 'array'
           AND jsonb_array_length(v_forma_arr) > v_k THEN
          v_forma := NULLIF(v_forma_arr->>v_k, '');
        END IF;
        IF v_forma IS NULL THEN v_forma := v_metodo; END IF;

        INSERT INTO public.lancamentos_financeiros (
          tipo, descricao, valor, data_vencimento, status,
          pedido_id, categoria_id, loja_id, forma_pagamento, aprovacao_status
        ) VALUES (
          'entrada',
          'Receita ' || v_ped.codigo || ' - Parcela ' || v_idx || '/' || v_total_parcelas,
          v_valor,
          COALESCE(v_venc, CURRENT_DATE),
          'pendente',
          v_ped.id, v_cat_id, v_ped.loja_id,
          v_forma,
          'aprovado'
        );
        v_idx := v_idx + 1;
      END LOOP;
    ELSE
      v_qtd := GREATEST(COALESCE(v_pag.parcelas, 1), 1);
      v_valor_total := COALESCE(v_pag.valor, 0);
      v_valor_parc := v_valor_total / v_qtd;
      v_base_date := v_pag.data_vencimento;
      FOR v_k IN 0..(v_qtd-1) LOOP
        v_venc := CASE WHEN v_base_date IS NULL THEN CURRENT_DATE
                       ELSE (v_base_date + (v_k || ' months')::interval)::date END;
        INSERT INTO public.lancamentos_financeiros (
          tipo, descricao, valor, data_vencimento, status,
          pedido_id, categoria_id, loja_id, forma_pagamento, aprovacao_status
        ) VALUES (
          'entrada',
          'Receita ' || v_ped.codigo || ' - Parcela ' || v_idx || '/' || v_total_parcelas,
          v_valor_parc,
          v_venc,
          'pendente',
          v_ped.id, v_cat_id, v_ped.loja_id,
          v_metodo,
          'aprovado'
        );
        v_idx := v_idx + 1;
      END LOOP;
    END IF;
  END LOOP;
END;
$function$;

-- 2) Trigger function — dispara para concluido (digital) E assinado_manual.
CREATE OR REPLACE FUNCTION public.trg_gerar_receber_pedido_assinado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status::text IN ('concluido','assinado_manual')
     AND (OLD.status::text IS DISTINCT FROM NEW.status::text)
     AND NEW.pedido_id IS NOT NULL THEN
    PERFORM public.gerar_receber_de_pedido_assinado(NEW.pedido_id);
  END IF;
  RETURN NEW;
END;
$function$;
