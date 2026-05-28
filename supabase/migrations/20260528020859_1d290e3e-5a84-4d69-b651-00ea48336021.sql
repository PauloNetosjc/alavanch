
-- 1) Novos campos
ALTER TABLE public.metodos_pagamento
  ADD COLUMN IF NOT EXISTS prazo_recebimento_dias int NOT NULL DEFAULT 0;

ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS juros_previsto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_perc numeric,
  ADD COLUMN IF NOT EXISTS numero_parcela int,
  ADD COLUMN IF NOT EXISTS total_parcelas int,
  ADD COLUMN IF NOT EXISTS agrupado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem_pagamento_id uuid;

-- 2) Neutraliza gerador antigo (duplicava e ignorava juros)
DROP TRIGGER IF EXISTS trg_gerar_lancamentos_pedido ON public.pedidos;

-- 3) Reescreve gerador oficial
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
  v_valor_parc numeric;
  v_venc date;
  v_k int;
  v_forma text;
  v_idx_global int := 1;
  v_total_global int := 0;
  v_juros_perc numeric;
  v_juros_total numeric;
  v_juros_parc numeric;
  v_cfg jsonb;
  v_item jsonb;
  v_det jsonb;
  v_venc_arr jsonb;
  v_forma_arr jsonb;
  v_el jsonb;
  v_valor numeric;
  v_prazo int;
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

  -- Data base = data da assinatura (concluído / assinado_manual) ou criação do pedido
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

  -- Conta total global de parcelas para descrição "X/Y" (modo não-agrupado)
  FOR v_pag IN SELECT * FROM public.pagamentos_orcamento WHERE orcamento_id = v_ped.orcamento_id LOOP
    SELECT * INTO v_metodo FROM public.metodos_pagamento WHERE nome = v_pag.metodo LIMIT 1;
    IF v_metodo.id IS NOT NULL AND COALESCE(v_metodo.agrupado, false) THEN
      v_total_global := v_total_global + 1;
    ELSE
      v_det := v_pag.parcelas_detalhe;
      IF v_det IS NOT NULL AND jsonb_typeof(v_det) = 'array' AND jsonb_array_length(v_det) > 0 THEN
        v_total_global := v_total_global + jsonb_array_length(v_det);
      ELSE
        v_total_global := v_total_global + GREATEST(COALESCE(v_pag.parcelas, 1), 1);
      END IF;
    END IF;
  END LOOP;

  IF v_total_global = 0 THEN RETURN; END IF;

  FOR v_pag IN SELECT * FROM public.pagamentos_orcamento WHERE orcamento_id = v_ped.orcamento_id ORDER BY created_at LOOP
    SELECT * INTO v_metodo FROM public.metodos_pagamento WHERE nome = v_pag.metodo LIMIT 1;
    v_qtd := GREATEST(COALESCE(v_pag.parcelas, 1), 1);
    v_valor_total := COALESCE(v_pag.valor, 0);
    v_cfg := COALESCE(v_metodo.parcelas_config, '[]'::jsonb);
    v_prazo := COALESCE(v_metodo.prazo_recebimento_dias, 0);

    -- Localiza item da config p/ a qtd de parcelas (juros/forma)
    v_item := NULL;
    v_juros_perc := 0;
    IF jsonb_typeof(v_cfg) = 'array' THEN
      FOR v_k IN 0..(jsonb_array_length(v_cfg) - 1) LOOP
        IF COALESCE((v_cfg->v_k->>'numero')::int, 0) = v_qtd THEN
          v_item := v_cfg->v_k;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    IF v_item IS NOT NULL AND COALESCE(v_metodo.juros_modo,'repassar') = 'absorver' THEN
      v_juros_perc := COALESCE((v_item->>'juros_perc')::numeric, 0);
    END IF;

    -- Forma padrão para esse método (do item de config, se houver, senão metodo.nome)
    v_forma := v_pag.metodo;
    IF v_item IS NOT NULL THEN
      IF jsonb_typeof(v_item->'forma_pagamento') = 'string' THEN
        v_forma := COALESCE(NULLIF(v_item->>'forma_pagamento',''), v_forma);
      ELSIF jsonb_typeof(v_item->'forma_pagamento') = 'array'
            AND jsonb_array_length(v_item->'forma_pagamento') > 0 THEN
        v_forma := COALESCE(NULLIF(v_item->'forma_pagamento'->>0,''), v_forma);
      END IF;
    END IF;

    -- ============= AGRUPADO =============
    IF v_metodo.id IS NOT NULL AND COALESCE(v_metodo.agrupado, false) THEN
      v_juros_total := ROUND((v_valor_total * v_juros_perc / 100)::numeric, 2);
      v_venc := v_data_base + (v_prazo || ' days')::interval;

      INSERT INTO public.lancamentos_financeiros (
        tipo, descricao, valor, data_vencimento, status,
        pedido_id, categoria_id, loja_id, forma_pagamento, aprovacao_status,
        juros_previsto, taxa_perc, numero_parcela, total_parcelas, agrupado, origem_pagamento_id
      ) VALUES (
        'entrada',
        'Receita ' || v_ped.codigo || ' — Recebimento agrupado ' || v_pag.metodo || ' ' || v_qtd || 'x',
        v_valor_total,
        v_venc,
        'pendente',
        v_ped.id, v_cat_id, v_ped.loja_id,
        v_forma,
        'aprovado',
        v_juros_total,
        v_juros_perc,
        1,
        v_qtd,
        true,
        v_pag.id
      );
      CONTINUE;
    END IF;

    -- ============= NÃO-AGRUPADO =============
    v_det := v_pag.parcelas_detalhe;
    v_venc_arr := v_pag.parcelas_vencimentos;
    v_forma_arr := v_pag.parcelas_formas;

    IF v_det IS NOT NULL AND jsonb_typeof(v_det) = 'array' AND jsonb_array_length(v_det) > 0 THEN
      v_qtd := jsonb_array_length(v_det);
      v_juros_total := ROUND((v_valor_total * v_juros_perc / 100)::numeric, 2);
      v_juros_parc  := CASE WHEN v_qtd > 0 THEN ROUND((v_juros_total / v_qtd)::numeric, 2) ELSE 0 END;

      FOR v_k IN 0..(v_qtd - 1) LOOP
        v_el := v_det -> v_k;
        IF jsonb_typeof(v_el) = 'object' THEN
          v_valor := COALESCE((v_el->>'valor')::numeric, 0);
          v_venc  := NULLIF(COALESCE(v_el->>'data_vencimento', v_el->>'data'), '')::date;
          v_forma := COALESCE(NULLIF(v_el->>'forma_pagamento',''), NULLIF(v_el->>'forma',''), v_pag.metodo);
        ELSE
          v_valor := COALESCE((v_el#>>'{}')::numeric, 0);
          v_venc  := NULL;
          v_forma := v_pag.metodo;
        END IF;

        IF v_venc IS NULL AND v_venc_arr IS NOT NULL AND jsonb_typeof(v_venc_arr) = 'array'
           AND jsonb_array_length(v_venc_arr) > v_k THEN
          v_venc := NULLIF(v_venc_arr->>v_k, '')::date;
        END IF;
        IF v_forma_arr IS NOT NULL AND jsonb_typeof(v_forma_arr) = 'array'
           AND jsonb_array_length(v_forma_arr) > v_k THEN
          v_forma := COALESCE(NULLIF(v_forma_arr->>v_k, ''), v_forma);
        END IF;

        INSERT INTO public.lancamentos_financeiros (
          tipo, descricao, valor, data_vencimento, status,
          pedido_id, categoria_id, loja_id, forma_pagamento, aprovacao_status,
          juros_previsto, taxa_perc, numero_parcela, total_parcelas, agrupado, origem_pagamento_id
        ) VALUES (
          'entrada',
          'Receita ' || v_ped.codigo || ' - Parcela ' || v_idx_global || '/' || v_total_global,
          v_valor,
          COALESCE(v_venc, v_data_base),
          'pendente',
          v_ped.id, v_cat_id, v_ped.loja_id,
          v_forma,
          'aprovado',
          v_juros_parc,
          v_juros_perc,
          v_k + 1,
          v_qtd,
          false,
          v_pag.id
        );
        v_idx_global := v_idx_global + 1;
      END LOOP;
    ELSE
      v_valor_parc := v_valor_total / v_qtd;
      v_juros_total := ROUND((v_valor_total * v_juros_perc / 100)::numeric, 2);
      v_juros_parc  := CASE WHEN v_qtd > 0 THEN ROUND((v_juros_total / v_qtd)::numeric, 2) ELSE 0 END;
      FOR v_k IN 0..(v_qtd-1) LOOP
        v_venc := CASE WHEN v_pag.data_vencimento IS NULL
                       THEN (v_data_base + (v_k || ' months')::interval)::date
                       ELSE (v_pag.data_vencimento + (v_k || ' months')::interval)::date END;
        INSERT INTO public.lancamentos_financeiros (
          tipo, descricao, valor, data_vencimento, status,
          pedido_id, categoria_id, loja_id, forma_pagamento, aprovacao_status,
          juros_previsto, taxa_perc, numero_parcela, total_parcelas, agrupado, origem_pagamento_id
        ) VALUES (
          'entrada',
          'Receita ' || v_ped.codigo || ' - Parcela ' || v_idx_global || '/' || v_total_global,
          v_valor_parc,
          v_venc,
          'pendente',
          v_ped.id, v_cat_id, v_ped.loja_id,
          v_pag.metodo,
          'aprovado',
          v_juros_parc,
          v_juros_perc,
          v_k + 1,
          v_qtd,
          false,
          v_pag.id
        );
        v_idx_global := v_idx_global + 1;
      END LOOP;
    END IF;
  END LOOP;
END;
$function$;
