
CREATE OR REPLACE FUNCTION public.is_dia_util(_data date, _loja uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXTRACT(ISODOW FROM _data) < 6
     AND NOT EXISTS (
       SELECT 1 FROM public.agenda_feriados
       WHERE data = _data AND (loja_id IS NULL OR loja_id = _loja)
     );
$function$;

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
    IF v_modelo.prazo_unidade = 'horas' THEN
      v_prazo := now() + make_interval(hours => v_modelo.prazo_qtd);
    ELSIF v_modelo.prazo_tipo = 'util' THEN
      v_data_alvo := public.add_dias_uteis(v_data_base, v_modelo.prazo_qtd, v_pedido.loja_id);
      v_prazo := ((v_data_alvo::text || ' 18:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo');
    ELSE
      v_data_alvo := v_data_base + v_modelo.prazo_qtd;
      v_prazo := ((v_data_alvo::text || ' 18:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo');
    END IF;

    v_pre := v_prazo - make_interval(days => COALESCE(v_modelo.pre_alerta_dias,0));

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

-- Recalcula prazos em aberto
UPDATE public.tarefas_pedido tp
SET prazo = CASE
      WHEN m.prazo_unidade = 'horas' THEN tp.created_at + make_interval(hours => m.prazo_qtd)
      WHEN m.prazo_tipo = 'util' THEN
        ((public.add_dias_uteis((tp.created_at AT TIME ZONE 'America/Sao_Paulo')::date, m.prazo_qtd, tp.loja_id)::text || ' 18:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo')
      ELSE
        ((((tp.created_at AT TIME ZONE 'America/Sao_Paulo')::date + m.prazo_qtd)::text || ' 18:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo')
    END,
    pre_alerta_em = (CASE
      WHEN m.prazo_unidade = 'horas' THEN tp.created_at + make_interval(hours => m.prazo_qtd)
      WHEN m.prazo_tipo = 'util' THEN
        ((public.add_dias_uteis((tp.created_at AT TIME ZONE 'America/Sao_Paulo')::date, m.prazo_qtd, tp.loja_id)::text || ' 18:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo')
      ELSE
        ((((tp.created_at AT TIME ZONE 'America/Sao_Paulo')::date + m.prazo_qtd)::text || ' 18:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo')
    END) - make_interval(days => COALESCE(m.pre_alerta_dias,0))
FROM public.tarefas_nativas_modelos m
WHERE tp.modelo_id = m.id
  AND tp.status NOT IN ('concluida','cancelada');
