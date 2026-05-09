-- 1) Coluna opcional para pipeline destino
ALTER TABLE public.pipeline_automacoes
  ADD COLUMN IF NOT EXISTS pipeline_destino text;

-- 2) Atualizar engine
CREATE OR REPLACE FUNCTION public.pipeline_avancar_card(_pedido_id uuid, _evento text, _contexto jsonb DEFAULT '{}'::jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  card_rec record;
  reg record;
  loja uuid;
  novo_prazo date;
  cond_ok boolean;
  data_ref date;
  count_mov int := 0;
  est_origem_nome text;
  est_destino_nome text;
  pipeline_dest text;
  card_dest_id uuid;
  card_dest_estagio uuid;
  card_dest_prazo date;
BEGIN
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
      IF reg.ajustar_prazo_dias IS NOT NULL THEN
        data_ref := NULLIF(_contexto->>'data_referencia','')::date;
        IF reg.ajustar_prazo_dias < 0 AND data_ref IS NOT NULL THEN
          novo_prazo := public.sub_dias_uteis(data_ref, abs(reg.ajustar_prazo_dias), loja);
        ELSIF reg.ajustar_prazo_dias > 0 THEN
          novo_prazo := public.add_dias_uteis(COALESCE(data_ref,CURRENT_DATE), reg.ajustar_prazo_dias, loja);
        END IF;
      END IF;

      SELECT nome INTO est_origem_nome FROM public.pipeline_estagios WHERE id = card_rec.estagio_id;
      SELECT nome, pipeline INTO est_destino_nome, pipeline_dest FROM public.pipeline_estagios WHERE id = reg.estagio_destino_id;

      IF reg.pipeline_destino IS NOT NULL AND reg.pipeline_destino <> card_rec.pipeline THEN
        -- Cross-kanban: cria ou move card no pipeline destino
        SELECT id, estagio_id, prazo INTO card_dest_id, card_dest_estagio, card_dest_prazo
          FROM public.kanban_cards
         WHERE pedido_id = _pedido_id AND pipeline = reg.pipeline_destino
         LIMIT 1;

        IF card_dest_id IS NULL THEN
          INSERT INTO public.kanban_cards(pedido_id, pipeline, estagio_id, prazo, iniciado_em)
          VALUES (_pedido_id, reg.pipeline_destino, reg.estagio_destino_id, novo_prazo, now())
          RETURNING id INTO card_dest_id;
        ELSE
          UPDATE public.kanban_cards
             SET estagio_id = reg.estagio_destino_id,
                 prazo = COALESCE(novo_prazo, prazo),
                 iniciado_em = now(),
                 notificacao_atraso_em = NULL,
                 updated_at = now()
           WHERE id = card_dest_id;
        END IF;

        INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, metadata)
        VALUES ('pedido', _pedido_id, 'kanban_automacao',
          format('[%s→%s] %s → %s (auto: %s)', card_rec.pipeline, reg.pipeline_destino, est_origem_nome, est_destino_nome, _evento),
          jsonb_build_object(
            'pipeline_origem', card_rec.pipeline,
            'pipeline_destino', reg.pipeline_destino,
            'evento', _evento,
            'regra_id', reg.id,
            'antes', jsonb_build_object('estagio', est_origem_nome),
            'depois', jsonb_build_object('estagio', est_destino_nome, 'prazo', COALESCE(novo_prazo, card_dest_prazo))
          ));
      ELSE
        -- Mesma pipeline: comportamento original
        UPDATE public.kanban_cards
           SET estagio_id = reg.estagio_destino_id,
               prazo = COALESCE(novo_prazo, prazo),
               iniciado_em = now(),
               notificacao_atraso_em = NULL,
               updated_at = now()
         WHERE id = card_rec.id;

        INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, metadata)
        VALUES ('pedido', _pedido_id, 'kanban_automacao',
          format('[%s] %s → %s (auto: %s)', card_rec.pipeline, est_origem_nome, est_destino_nome, _evento),
          jsonb_build_object(
            'pipeline', card_rec.pipeline,
            'evento', _evento,
            'regra_id', reg.id,
            'antes', jsonb_build_object('estagio', est_origem_nome, 'prazo', card_rec.prazo),
            'depois', jsonb_build_object('estagio', est_destino_nome, 'prazo', COALESCE(novo_prazo, card_rec.prazo))
          ));
      END IF;

      count_mov := count_mov + 1;
      EXIT; -- uma regra por card
    END LOOP;
  END LOOP;

  RETURN count_mov;
END;
$function$;