
CREATE OR REPLACE FUNCTION public.recalcular_prazos_operacionais_pedido(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido            record;
  v_cfg               record;
  v_base_entrega      date;
  v_base_montagem     date;
  v_limite_entrega    date;
  v_limite_montagem   date;
  v_contrato_assinado date;
  v_pdf_final_em      timestamptz;
  v_pdf_final_date    date;
BEGIN
  SELECT p.id, p.loja_id, p.orcamento_id,
         p.data_assinatura_pdf_final, p.data_entrega
    INTO v_pedido
    FROM public.pedidos p
   WHERE p.id = p_pedido_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT prazo_padrao_dias, prazo_entrega_tipo_dias, prazo_entrega_inicio_contagem,
         prazo_montagem_dias, prazo_montagem_tipo_dias, prazo_montagem_inicio_contagem
    INTO v_cfg
    FROM public.configuracoes_empresa
   WHERE loja_id = v_pedido.loja_id
   LIMIT 1;
  IF NOT FOUND THEN
    SELECT prazo_padrao_dias, prazo_entrega_tipo_dias, prazo_entrega_inicio_contagem,
           prazo_montagem_dias, prazo_montagem_tipo_dias, prazo_montagem_inicio_contagem
      INTO v_cfg
      FROM public.configuracoes_empresa
     LIMIT 1;
  END IF;
  IF NOT FOUND THEN RETURN; END IF;

  -- Data base para entrega
  IF coalesce(v_cfg.prazo_entrega_inicio_contagem,'assinatura_contrato') = 'assinatura_pdf_final' THEN
    -- Se ainda não temos data_assinatura_pdf_final, tenta inferir da solicitação
    -- mais recente do tipo "pdf_final" que esteja concluída OU assinada manualmente.
    IF v_pedido.data_assinatura_pdf_final IS NULL THEN
      SELECT COALESCE(sa.concluido_em, sa.assinado_manual_em, sa.cliente_assinado_em)
        INTO v_pdf_final_em
        FROM public.solicitacoes_assinatura sa
        JOIN public.tipos_documento td ON td.id = sa.tipo_documento_id
       WHERE sa.pedido_id = p_pedido_id
         AND td.slug = 'pdf_final'
         AND sa.status IN ('concluido','assinado_manual')
         AND COALESCE(sa.concluido_em, sa.assinado_manual_em, sa.cliente_assinado_em) IS NOT NULL
       ORDER BY COALESCE(sa.concluido_em, sa.assinado_manual_em, sa.cliente_assinado_em) DESC
       LIMIT 1;
      IF v_pdf_final_em IS NOT NULL THEN
        v_pdf_final_date := (v_pdf_final_em AT TIME ZONE 'America/Sao_Paulo')::date;
        UPDATE public.pedidos
           SET data_assinatura_pdf_final = v_pdf_final_date
         WHERE id = p_pedido_id
           AND data_assinatura_pdf_final IS NULL;
        v_pedido.data_assinatura_pdf_final := v_pdf_final_date;
      END IF;
    END IF;
    v_base_entrega := v_pedido.data_assinatura_pdf_final;
  ELSE
    SELECT (c.assinado_em AT TIME ZONE 'America/Sao_Paulo')::date
      INTO v_contrato_assinado
      FROM public.contratos c
     WHERE c.orcamento_id = v_pedido.orcamento_id
       AND c.assinado_em IS NOT NULL
     ORDER BY c.assinado_em DESC
     LIMIT 1;
    v_base_entrega := v_contrato_assinado;
  END IF;

  IF v_base_entrega IS NOT NULL AND coalesce(v_cfg.prazo_padrao_dias,0) > 0 THEN
    IF coalesce(v_cfg.prazo_entrega_tipo_dias,'corridos') = 'uteis' THEN
      v_limite_entrega := public.add_business_days(v_base_entrega, v_cfg.prazo_padrao_dias);
    ELSE
      v_limite_entrega := v_base_entrega + v_cfg.prazo_padrao_dias;
    END IF;
  ELSE
    v_limite_entrega := NULL;
  END IF;

  -- Data base para montagem
  IF coalesce(v_cfg.prazo_montagem_inicio_contagem,'entrega_realizada') = 'fim_prazo_entrega' THEN
    v_base_montagem := v_limite_entrega;
  ELSE
    v_base_montagem := v_pedido.data_entrega;
  END IF;

  IF v_base_montagem IS NOT NULL AND coalesce(v_cfg.prazo_montagem_dias,0) >= 0 THEN
    IF coalesce(v_cfg.prazo_montagem_tipo_dias,'uteis') = 'uteis' THEN
      v_limite_montagem := public.add_business_days(v_base_montagem, v_cfg.prazo_montagem_dias);
    ELSE
      v_limite_montagem := v_base_montagem + v_cfg.prazo_montagem_dias;
    END IF;
  ELSE
    v_limite_montagem := NULL;
  END IF;

  UPDATE public.pedidos
     SET data_limite_entrega = v_limite_entrega,
         data_limite_inicio_montagem = v_limite_montagem
   WHERE id = p_pedido_id
     AND (coalesce(data_limite_entrega::text,'') IS DISTINCT FROM coalesce(v_limite_entrega::text,'')
          OR coalesce(data_limite_inicio_montagem::text,'') IS DISTINCT FROM coalesce(v_limite_montagem::text,''));
END;
$function$;

-- Recalcular o pedido PV-LOJ-5703 imediatamente
SELECT public.recalcular_prazos_operacionais_pedido(id)
  FROM public.pedidos
 WHERE codigo = 'PV-LOJ-5703';
