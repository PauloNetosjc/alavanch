
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
  v_metodo record;
  v_data_base date;
  v_qtd int;
  v_valor_total numeric;
  v_venc date;
  v_k int;
  v_forma text;
  v_idx_global int := 1;
  v_total_global int := 0;
  v_cfg jsonb;
  v_item jsonb;
  v_det jsonb;
  v_venc_arr jsonb;
  v_forma_arr jsonb;
  v_el jsonb;
  v_valor numeric;
  v_prazo int;
  v_metodo_forma text;
  v_grupo_valor numeric;
  v_grupo_venc date;
  v_grupo_qtd int;
  v_juros_perc numeric;
  v_juros_total numeric;
BEGIN
  SELECT * INTO v_ped FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_ped.orcamento_id IS NULL THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.lancamentos_financeiros WHERE pedido_id = p_pedido_id AND tipo = 'entrada') THEN
    RETURN;
  END IF;

  SELECT id INTO v_cat_id FROM public.categorias_financeiras
    WHERE tipo='entrada' AND nome ILIKE '%recebimento%contrato%' LIMIT 1;

  SELECT GREATEST(
           COALESCE(MAX(s.concluido_em), '1900-01-01'::timestamptz),
           COALESCE(MAX(s.cliente_assinado_em), '1900-01-01'::timestamptz),
           COALESCE(MAX(s.loja_assinado_em), '1900-01-01'::timestamptz)
         )::date
    INTO v_data_base
  FROM public.solicitacoes_assinatura s
  WHERE s.pedido_id = p_pedido_id
    AND s.status::text IN ('concluido','assinado_manual');

  IF v_data_base IS NULL OR v_data_base <= '1900-01-01'::date THEN
    v_data_base := COALESCE(v_ped.created_at::date, CURRENT_DATE);
  END IF;

  FOR v_pag IN SELECT * FROM public.pagamentos_orcamento WHERE orcamento_id = v_ped.orcamento_id LOOP
    v_det := v_pag.parcelas_detalhe;
    IF v_det IS NOT NULL AND jsonb_typeof(v_det) = 'array' AND jsonb_array_length(v_det) > 0 THEN
      v_total_global := v_total_global + jsonb_array_length(v_det);
    ELSE
      v_total_global := v_total_global + GREATEST(COALESCE(v_pag.parcelas, 1), 1);
    END IF;
  END LOOP;

  IF v_total_global = 0 THEN RETURN; END IF;

  FOR v_pag IN SELECT * FROM public.pagamentos_orcamento WHERE orcamento_id = v_ped.orcamento_id ORDER BY created_at LOOP
    SELECT * INTO v_metodo FROM public.metodos_pagamento WHERE nome = v_pag.metodo LIMIT 1;
    v_cfg := COALESCE(v_metodo.parcelas_config, '[]'::jsonb);
    v_prazo := COALESCE(v_metodo.prazo_recebimento_dias, 0);

    v_metodo_forma := NULL;
    IF jsonb_typeof(v_cfg) = 'array' AND jsonb_array_length(v_cfg) > 0 THEN
      v_metodo_forma := NULLIF(v_cfg->0->>'forma_pagamento', '');
    END IF;
    IF v_metodo_forma IS NULL THEN v_metodo_forma := v_pag.metodo; END IF;

    v_det := v_pag.parcelas_detalhe;
    v_venc_arr := v_pag.parcelas_vencimentos;
    v_forma_arr := v_pag.parcelas_formas;

    IF v_det IS NOT NULL AND jsonb_typeof(v_det) = 'array' AND jsonb_array_length(v_det) > 0 THEN
      v_qtd := jsonb_array_length(v_det);
    ELSE
      v_qtd := GREATEST(COALESCE(v_pag.parcelas, 1), 1);
    END IF;
    v_valor_total := COALESCE(v_pag.valor, 0);

    v_grupo_valor := 0;
    v_grupo_venc := NULL;
    v_grupo_qtd := 0;

    FOR v_k IN 0..(v_qtd - 1) LOOP
      IF v_det IS NOT NULL AND jsonb_typeof(v_det)='array' AND jsonb_array_length(v_det) > v_k THEN
        v_el := v_det -> v_k;
        IF jsonb_typeof(v_el) = 'object' THEN
          v_valor := COALESCE((v_el->>'valor')::numeric, 0);
        ELSE
          v_valor := COALESCE((v_el#>>'{}')::numeric, 0);
        END IF;
      ELSE
        v_el := NULL;
        v_valor := ROUND((v_valor_total / GREATEST(v_qtd,1))::numeric, 2);
      END IF;

      v_venc := NULL;
      IF v_el IS NOT NULL AND jsonb_typeof(v_el)='object' THEN
        v_venc := NULLIF(COALESCE(v_el->>'data_vencimento', v_el->>'data'), '')::date;
      END IF;
      IF v_venc IS NULL AND v_venc_arr IS NOT NULL AND jsonb_typeof(v_venc_arr)='array'
         AND jsonb_array_length(v_venc_arr) > v_k THEN
        v_venc := NULLIF(v_venc_arr->>v_k, '')::date;
      END IF;
      IF v_venc IS NULL THEN
        v_venc := COALESCE(v_pag.data_vencimento,
                           (v_data_base + (v_k || ' months')::interval)::date);
      END IF;

      v_forma := NULL;
      IF v_el IS NOT NULL AND jsonb_typeof(v_el)='object' THEN
        v_forma := NULLIF(COALESCE(v_el->>'forma_pagamento', v_el->>'forma'), '');
      END IF;
      IF v_forma IS NULL AND v_forma_arr IS NOT NULL AND jsonb_typeof(v_forma_arr)='array'
         AND jsonb_array_length(v_forma_arr) > v_k THEN
        v_forma := NULLIF(v_forma_arr->>v_k, '');
      END IF;
      IF v_forma IS NULL THEN v_forma := COALESCE(v_metodo_forma, v_pag.metodo); END IF;

      IF v_metodo.id IS NOT NULL
         AND COALESCE(v_metodo.agrupado, false)
         AND v_metodo_forma IS NOT NULL
         AND lower(v_forma) = lower(v_metodo_forma) THEN
        v_grupo_valor := v_grupo_valor + v_valor;
        v_grupo_qtd := v_grupo_qtd + 1;
        IF v_grupo_venc IS NULL OR v_venc < v_grupo_venc THEN
          v_grupo_venc := v_venc;
        END IF;
      ELSE
        INSERT INTO public.lancamentos_financeiros (
          tipo, descricao, valor, data_vencimento, status,
          pedido_id, categoria_id, loja_id, forma_pagamento, aprovacao_status,
          juros_previsto, taxa_perc, numero_parcela, total_parcelas, agrupado, origem_pagamento_id
        ) VALUES (
          'entrada',
          'Receita ' || v_ped.codigo || ' - Parcela ' || v_idx_global || '/' || v_total_global,
          v_valor, v_venc, 'pendente',
          v_ped.id, v_cat_id, v_ped.loja_id, v_forma, 'aprovado',
          0, 0, v_k + 1, v_qtd, false, v_pag.id
        );
        v_idx_global := v_idx_global + 1;
      END IF;
    END LOOP;

    IF v_grupo_qtd > 0 THEN
      v_juros_perc := 0;
      v_item := NULL;
      IF jsonb_typeof(v_cfg) = 'array' THEN
        FOR v_k IN 0..(jsonb_array_length(v_cfg) - 1) LOOP
          IF COALESCE((v_cfg->v_k->>'numero')::int, 0) = v_grupo_qtd THEN
            v_item := v_cfg->v_k;
            EXIT;
          END IF;
        END LOOP;
        IF v_item IS NOT NULL AND COALESCE(v_metodo.juros_modo,'repassar') = 'absorver' THEN
          v_juros_perc := COALESCE((v_item->>'juros_perc')::numeric, 0);
        END IF;
      END IF;
      v_juros_total := ROUND((v_grupo_valor * v_juros_perc / 100)::numeric, 2);

      -- Data base do agrupado: vencimento negociado primeiro; assinatura só como fallback.
      -- Prazo de recebimento agrupado SEMPRE somado sobre essa data base.
      IF v_grupo_venc IS NULL THEN
        v_grupo_venc := COALESCE(
          NULLIF(v_pag.parcelas_vencimentos->>0, '')::date,
          v_pag.data_vencimento,
          v_data_base
        );
      END IF;
      IF v_prazo > 0 THEN
        v_grupo_venc := (v_grupo_venc + (v_prazo || ' days')::interval)::date;
      END IF;

      INSERT INTO public.lancamentos_financeiros (
        tipo, descricao, valor, data_vencimento, status,
        pedido_id, categoria_id, loja_id, forma_pagamento, aprovacao_status,
        juros_previsto, taxa_perc, numero_parcela, total_parcelas, agrupado, origem_pagamento_id
      ) VALUES (
        'entrada',
        'Receita ' || v_ped.codigo || ' — Recebimento agrupado ' || v_metodo_forma || ' ' || v_grupo_qtd || 'x',
        v_grupo_valor, v_grupo_venc, 'pendente',
        v_ped.id, v_cat_id, v_ped.loja_id, v_metodo_forma, 'aprovado',
        v_juros_total, v_juros_perc, 1, v_grupo_qtd, true, v_pag.id
      );
      v_idx_global := v_idx_global + 1;
    END IF;
  END LOOP;
END;
$function$;
