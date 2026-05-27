
CREATE OR REPLACE FUNCTION public.gerar_receber_de_pedido_assinado(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ped record;
  v_cat_id uuid;
  v_pag record;
  v_idx int := 1;
  v_total_parcelas int := 0;
  v_det jsonb;
  v_d jsonb;
  v_qtd int;
  v_valor_total numeric;
  v_valor_parc numeric;
  v_base_date date;
  v_venc date;
  v_k int;
  v_forma text;
BEGIN
  SELECT * INTO v_ped FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_ped.orcamento_id IS NULL THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.lancamentos_financeiros WHERE pedido_id = p_pedido_id) THEN
    RETURN;
  END IF;

  SELECT id INTO v_cat_id FROM public.categorias_financeiras
   WHERE tipo='entrada' AND nome ILIKE '%recebimento%contrato%' LIMIT 1;

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
    v_forma := v_pag.metodo;
    v_det := v_pag.parcelas_detalhe;
    IF v_det IS NOT NULL AND jsonb_typeof(v_det) = 'array' AND jsonb_array_length(v_det) > 0 THEN
      FOR v_d IN SELECT * FROM jsonb_array_elements(v_det) LOOP
        v_venc := NULLIF(COALESCE(v_d->>'data_vencimento', v_d->>'data'), '')::date;
        INSERT INTO public.lancamentos_financeiros (
          tipo, descricao, valor, data_vencimento, status,
          pedido_id, categoria_id, loja_id, forma_pagamento, aprovacao_status
        ) VALUES (
          'entrada',
          'Recebimento contrato ' || v_ped.codigo || ' - parcela ' || v_idx || '/' || v_total_parcelas,
          COALESCE((v_d->>'valor')::numeric, 0),
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
          'Recebimento contrato ' || v_ped.codigo || ' - parcela ' || v_idx || '/' || v_total_parcelas,
          v_valor_parc,
          v_venc,
          'pendente',
          v_ped.id, v_cat_id, v_ped.loja_id,
          v_forma,
          'aprovado'
        );
        v_idx := v_idx + 1;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerar_receber_de_pedido_assinado(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_gerar_receber_pedido_assinado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status::text = 'concluido'
     AND (OLD.status::text IS DISTINCT FROM 'concluido')
     AND NEW.pedido_id IS NOT NULL THEN
    PERFORM public.gerar_receber_de_pedido_assinado(NEW.pedido_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_solic_gerar_receber ON public.solicitacoes_assinatura;
CREATE TRIGGER trg_solic_gerar_receber
AFTER UPDATE OF status ON public.solicitacoes_assinatura
FOR EACH ROW
EXECUTE FUNCTION public.trg_gerar_receber_pedido_assinado();

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT s.pedido_id
    FROM public.solicitacoes_assinatura s
    WHERE s.status::text = 'concluido'
      AND s.pedido_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.lancamentos_financeiros l WHERE l.pedido_id = s.pedido_id)
  LOOP
    PERFORM public.gerar_receber_de_pedido_assinado(r.pedido_id);
  END LOOP;
END $$;
