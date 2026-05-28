
-- ============================================================
-- Regra de prazo e conclusão da tarefa nativa "Revisão loja"
-- ============================================================

-- 1) Modelo: 7 dias úteis, prazo calculado a partir da data de Revisão (agenda)
UPDATE public.tarefas_nativas_modelos
   SET prazo_qtd = 7, prazo_unidade = 'dias', prazo_tipo = 'util'
 WHERE nome = 'Revisão loja' AND loja_id IS NULL;

-- 2) fn_instanciar_tarefas_nativas: base de prazo especial para "Revisão loja"
CREATE OR REPLACE FUNCTION public.fn_instanciar_tarefas_nativas(p_pedido_id uuid, p_gatilho text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido record;
  v_modelo record;
  v_prazo timestamptz;
  v_pre   timestamptz;
  v_resp  uuid;
  v_id    uuid;
  v_count int := 0;
  v_data_base date;
  v_data_alvo date;
  v_data_revisao date;
  v_use_base date;
  v_skip_prazo boolean;
BEGIN
  SELECT id, cliente_id, loja_id INTO v_pedido
    FROM public.pedidos WHERE id = p_pedido_id;
  IF v_pedido.id IS NULL THEN RETURN 0; END IF;

  v_data_base := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  FOR v_modelo IN
    SELECT * FROM public.tarefas_nativas_modelos
     WHERE ativo = true
       AND gatilho = p_gatilho
       AND (loja_id IS NULL OR loja_id = v_pedido.loja_id)
     ORDER BY ordem, created_at
  LOOP
    v_use_base := v_data_base;
    v_skip_prazo := false;

    -- Caso especial: "Revisão loja" usa data de Revisão (agenda) + 7 dias úteis
    IF v_modelo.nome = 'Revisão loja' AND v_modelo.gatilho = 'upload_projeto_para_revisao' THEN
      SELECT (data)::date INTO v_data_revisao
        FROM public.agenda_eventos
       WHERE pedido_id = v_pedido.id AND tipo = 'revisao_final'
       ORDER BY created_at DESC LIMIT 1;
      IF v_data_revisao IS NOT NULL THEN
        v_use_base := v_data_revisao;
      ELSE
        v_skip_prazo := true;
        RAISE NOTICE '[Revisão loja] sem data de Revisão agendada — tarefa criada sem prazo (pedido %)', v_pedido.id;
      END IF;
    END IF;

    IF v_skip_prazo THEN
      v_prazo := NULL;
      v_pre := NULL;
    ELSIF v_modelo.prazo_unidade = 'horas' THEN
      v_prazo := now() + make_interval(hours => v_modelo.prazo_qtd);
      v_pre := v_prazo - make_interval(days => COALESCE(v_modelo.pre_alerta_dias,0));
    ELSIF v_modelo.prazo_tipo = 'util' THEN
      v_data_alvo := public.add_dias_uteis(v_use_base, v_modelo.prazo_qtd, v_pedido.loja_id);
      v_prazo := ((v_data_alvo::text || ' 18:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo');
      v_pre := v_prazo - make_interval(days => COALESCE(v_modelo.pre_alerta_dias,0));
    ELSE
      v_data_alvo := v_use_base + v_modelo.prazo_qtd;
      v_prazo := ((v_data_alvo::text || ' 18:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo');
      v_pre := v_prazo - make_interval(days => COALESCE(v_modelo.pre_alerta_dias,0));
    END IF;

    v_resp := NULL;
    IF COALESCE(v_modelo.fonte_responsavel,'fixo') <> 'fixo' THEN
      v_resp := public.fn_resolver_responsavel_tarefa(v_pedido.id, v_modelo.fonte_responsavel);
    END IF;
    IF v_resp IS NULL THEN
      v_resp := v_modelo.responsavel_padrao_id;
    END IF;

    INSERT INTO public.tarefas_pedido (
      pedido_id, cliente_id, modelo_id, titulo, descricao, setor,
      cargo_id, responsavel_id, loja_id,
      status, origem, prazo, pre_alerta_em, prioridade,
      exige_anexo, exige_aprovacao,
      exibir_meus_chamados, exibir_controle_prazos, exibir_kanban
    ) VALUES (
      v_pedido.id, v_pedido.cliente_id, v_modelo.id, v_modelo.nome, v_modelo.descricao, v_modelo.setor,
      v_modelo.cargo_id, v_resp, v_pedido.loja_id,
      'pendente', 'automatica', v_prazo, v_pre, v_modelo.prioridade,
      v_modelo.exige_anexo, v_modelo.exige_aprovacao,
      v_modelo.exibir_meus_chamados, v_modelo.exibir_controle_prazos, v_modelo.exibir_kanban
    )
    ON CONFLICT (pedido_id, modelo_id) WHERE modelo_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NOT NULL THEN
      INSERT INTO public.eventos_tarefa (tarefa_id, tipo, payload)
      VALUES (v_id, 'criada', jsonb_build_object('gatilho', p_gatilho, 'modelo_id', v_modelo.id));
      v_count := v_count + 1;
      v_id := NULL;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- 3) Recalcular prazo de "Revisão loja" quando a data de Revisão muda
CREATE OR REPLACE FUNCTION public.fn_recalcular_prazo_revisao_loja()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido_id uuid;
  v_data_revisao date;
  v_loja uuid;
  v_data_alvo date;
  v_novo_prazo timestamptz;
  v_tarefa record;
BEGIN
  v_pedido_id := COALESCE(NEW.pedido_id, OLD.pedido_id);
  IF v_pedido_id IS NULL THEN RETURN NEW; END IF;

  -- pega a data de revisão mais recente
  SELECT (data)::date INTO v_data_revisao
    FROM public.agenda_eventos
   WHERE pedido_id = v_pedido_id AND tipo = 'revisao_final'
   ORDER BY created_at DESC LIMIT 1;

  IF v_data_revisao IS NULL THEN RETURN NEW; END IF;

  SELECT loja_id INTO v_loja FROM public.pedidos WHERE id = v_pedido_id;

  v_data_alvo := public.add_dias_uteis(v_data_revisao, 7, v_loja);
  v_novo_prazo := ((v_data_alvo::text || ' 18:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo');

  FOR v_tarefa IN
    SELECT tp.id, tp.prazo
      FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE tp.pedido_id = v_pedido_id
       AND m.nome = 'Revisão loja'
       AND tp.status IN ('pendente','em_andamento')
  LOOP
    IF v_tarefa.prazo IS DISTINCT FROM v_novo_prazo THEN
      UPDATE public.tarefas_pedido
         SET prazo = v_novo_prazo
       WHERE id = v_tarefa.id;
      INSERT INTO public.eventos_tarefa (tarefa_id, tipo, payload)
      VALUES (v_tarefa.id, 'prazo', jsonb_build_object(
        'de', v_tarefa.prazo, 'para', v_novo_prazo,
        'automatico', true, 'origem', 'data_revisao_alterada',
        'data_revisao', v_data_revisao
      ));
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_recalcular_prazo_revisao_loja falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalcular_prazo_revisao_loja ON public.agenda_eventos;
CREATE TRIGGER trg_recalcular_prazo_revisao_loja
AFTER INSERT OR UPDATE OF data ON public.agenda_eventos
FOR EACH ROW
WHEN (NEW.tipo = 'revisao_final')
EXECUTE FUNCTION public.fn_recalcular_prazo_revisao_loja();
