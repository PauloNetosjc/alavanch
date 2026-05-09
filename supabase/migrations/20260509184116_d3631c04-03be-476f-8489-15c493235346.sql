
-- Backfill SLAs
UPDATE public.pipeline_estagios SET sla_dias_uteis = 2  WHERE pipeline='pos_venda' AND lower(nome) LIKE '%emissão de boletos%';
UPDATE public.pipeline_estagios SET sla_dias_uteis = 7  WHERE pipeline='pos_venda' AND lower(nome) LIKE '%envio: pj inicial%';
UPDATE public.pipeline_estagios SET sla_dias_uteis = 2  WHERE pipeline='revisao'   AND (lower(nome) LIKE '%análise revisão%' OR lower(nome) LIKE '%analise revisao%');
UPDATE public.pipeline_estagios SET sla_dias_uteis = 7  WHERE pipeline='revisao'   AND lower(nome) LIKE '%preparo pj final%';
UPDATE public.pipeline_estagios SET sla_dias_uteis = 15 WHERE pipeline='revisao'   AND (lower(nome) LIKE '%revisão loja%' OR lower(nome) LIKE '%revisao loja%');
UPDATE public.pipeline_estagios SET sla_dias_uteis = 7  WHERE pipeline='revisao'   AND lower(nome) LIKE '%preparo pdf final%';
UPDATE public.pipeline_estagios SET sla_dias_uteis = 7  WHERE pipeline='revisao'   AND lower(nome) LIKE '%assinatura pdf final%';
UPDATE public.pipeline_estagios SET sla_dias_uteis = 7  WHERE pipeline='revisao'   AND (lower(nome) LIKE '%envio fábrica%' OR lower(nome) LIKE '%envio fabrica%');

-- Engine: registrar antes/depois e usuário; adicionar modo simulação
CREATE OR REPLACE FUNCTION public.pipeline_avancar_card(
  _pedido_id uuid,
  _evento text,
  _contexto jsonb DEFAULT '{}'::jsonb,
  _simular boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  card_rec record;
  reg record;
  loja uuid;
  novo_prazo date;
  prazo_destino_sla int;
  cond_ok boolean;
  data_ref date;
  est_origem_nome text;
  est_destino_nome text;
  v_uid uuid;
  resultados jsonb := '[]'::jsonb;
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;
  SELECT loja_id INTO loja FROM public.pedidos WHERE id = _pedido_id;

  FOR card_rec IN
    SELECT * FROM public.kanban_cards WHERE pedido_id = _pedido_id
  LOOP
    FOR reg IN
      SELECT * FROM public.pipeline_automacoes
       WHERE ativo = true
         AND evento = _evento
         AND estagio_origem_id = card_rec.estagio_id
       ORDER BY ordem
    LOOP
      cond_ok := true;
      IF reg.condicao_tipo = 'tipo_evento_agenda' THEN
        cond_ok := lower(coalesce(_contexto->>'tipo_evento','')) = lower(coalesce(reg.condicao_valor,''));
      ELSIF reg.condicao_tipo = 'template_checklist' THEN
        cond_ok := coalesce(_contexto->>'template_id','') = coalesce(reg.condicao_valor,'');
      END IF;
      IF NOT cond_ok THEN CONTINUE; END IF;

      novo_prazo := NULL;
      data_ref := NULLIF(_contexto->>'data_referencia','')::date;
      IF reg.ajustar_prazo_dias IS NOT NULL THEN
        IF reg.ajustar_prazo_dias < 0 AND data_ref IS NOT NULL THEN
          novo_prazo := public.sub_dias_uteis(data_ref, abs(reg.ajustar_prazo_dias), loja);
        ELSIF reg.ajustar_prazo_dias > 0 THEN
          novo_prazo := public.add_dias_uteis(COALESCE(data_ref,CURRENT_DATE), reg.ajustar_prazo_dias, loja);
        END IF;
      END IF;
      -- Se não há ajuste, calcula via SLA do destino
      IF novo_prazo IS NULL THEN
        SELECT sla_dias_uteis INTO prazo_destino_sla FROM public.pipeline_estagios WHERE id = reg.estagio_destino_id;
        IF prazo_destino_sla IS NOT NULL AND prazo_destino_sla > 0 THEN
          novo_prazo := public.add_dias_uteis(CURRENT_DATE, prazo_destino_sla, loja);
        END IF;
      END IF;

      SELECT nome INTO est_origem_nome FROM public.pipeline_estagios WHERE id = card_rec.estagio_id;
      SELECT nome INTO est_destino_nome FROM public.pipeline_estagios WHERE id = reg.estagio_destino_id;

      resultados := resultados || jsonb_build_object(
        'card_id', card_rec.id,
        'pipeline', card_rec.pipeline,
        'regra_id', reg.id,
        'evento', _evento,
        'antes', jsonb_build_object('estagio_id', card_rec.estagio_id, 'estagio_nome', est_origem_nome, 'prazo', card_rec.prazo),
        'depois', jsonb_build_object('estagio_id', reg.estagio_destino_id, 'estagio_nome', est_destino_nome, 'prazo', COALESCE(novo_prazo, card_rec.prazo))
      );

      IF NOT _simular THEN
        UPDATE public.kanban_cards
           SET estagio_id = reg.estagio_destino_id,
               prazo = COALESCE(novo_prazo, prazo),
               iniciado_em = now(),
               notificacao_atraso_em = NULL,
               updated_at = now()
         WHERE id = card_rec.id;

        INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
        VALUES ('pedido', _pedido_id, 'kanban_automacao',
          format('[%s] %s → %s (auto: %s)', card_rec.pipeline, est_origem_nome, est_destino_nome, _evento),
          v_uid,
          jsonb_build_object(
            'pipeline', card_rec.pipeline,
            'card_id', card_rec.id,
            'regra_id', reg.id,
            'evento', _evento,
            'auto', true,
            'antes', jsonb_build_object('estagio', est_origem_nome, 'prazo', card_rec.prazo),
            'depois', jsonb_build_object('estagio', est_destino_nome, 'prazo', COALESCE(novo_prazo, card_rec.prazo)),
            'contexto', _contexto));
      END IF;

      EXIT; -- só uma regra por card
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('movimentos', resultados, 'simulacao', _simular);
END $$;

-- Função leve de simulação a partir de um estágio + evento (sem precisar de pedido real)
CREATE OR REPLACE FUNCTION public.pipeline_simular(
  _estagio_origem_id uuid,
  _evento text,
  _contexto jsonb DEFAULT '{}'::jsonb,
  _loja uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reg record;
  cond_ok boolean;
  novo_prazo date;
  prazo_destino_sla int;
  data_ref date;
  est_origem_nome text;
  est_destino_nome text;
  loja uuid;
BEGIN
  loja := COALESCE(_loja, public.current_loja_id());
  SELECT nome INTO est_origem_nome FROM public.pipeline_estagios WHERE id = _estagio_origem_id;

  FOR reg IN
    SELECT * FROM public.pipeline_automacoes
     WHERE ativo = true
       AND evento = _evento
       AND estagio_origem_id = _estagio_origem_id
     ORDER BY ordem
  LOOP
    cond_ok := true;
    IF reg.condicao_tipo = 'tipo_evento_agenda' THEN
      cond_ok := lower(coalesce(_contexto->>'tipo_evento','')) = lower(coalesce(reg.condicao_valor,''));
    ELSIF reg.condicao_tipo = 'template_checklist' THEN
      cond_ok := coalesce(_contexto->>'template_id','') = coalesce(reg.condicao_valor,'');
    END IF;
    IF NOT cond_ok THEN CONTINUE; END IF;

    novo_prazo := NULL;
    data_ref := NULLIF(_contexto->>'data_referencia','')::date;
    IF reg.ajustar_prazo_dias IS NOT NULL THEN
      IF reg.ajustar_prazo_dias < 0 AND data_ref IS NOT NULL THEN
        novo_prazo := public.sub_dias_uteis(data_ref, abs(reg.ajustar_prazo_dias), loja);
      ELSIF reg.ajustar_prazo_dias > 0 THEN
        novo_prazo := public.add_dias_uteis(COALESCE(data_ref,CURRENT_DATE), reg.ajustar_prazo_dias, loja);
      END IF;
    END IF;
    IF novo_prazo IS NULL THEN
      SELECT sla_dias_uteis INTO prazo_destino_sla FROM public.pipeline_estagios WHERE id = reg.estagio_destino_id;
      IF prazo_destino_sla IS NOT NULL AND prazo_destino_sla > 0 THEN
        novo_prazo := public.add_dias_uteis(CURRENT_DATE, prazo_destino_sla, loja);
      END IF;
    END IF;

    SELECT nome INTO est_destino_nome FROM public.pipeline_estagios WHERE id = reg.estagio_destino_id;

    RETURN jsonb_build_object(
      'matched', true,
      'regra_id', reg.id,
      'origem', est_origem_nome,
      'destino', est_destino_nome,
      'prazo', novo_prazo,
      'origem_sla_atual', (SELECT sla_dias_uteis FROM public.pipeline_estagios WHERE id = _estagio_origem_id),
      'destino_sla', prazo_destino_sla,
      'ajustar_prazo_dias', reg.ajustar_prazo_dias);
  END LOOP;

  RETURN jsonb_build_object('matched', false, 'origem', est_origem_nome);
END $$;
