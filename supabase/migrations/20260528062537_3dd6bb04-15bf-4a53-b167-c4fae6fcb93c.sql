
CREATE OR REPLACE FUNCTION public.trg_fn_tarefas_nativas_agenda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gatilho text;
  v_prazo timestamptz;
  v_resp_profile uuid;
BEGIN
  BEGIN
    IF NEW.pedido_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_gatilho := CASE NEW.tipo::text
      WHEN 'medicao_tecnica'      THEN 'medicao_tecnica_agendada'
      WHEN 'revisao_final'        THEN 'revisao_final_agendada'
      WHEN 'entrega'              THEN 'entrega_agendada'
      WHEN 'montagem'             THEN 'montagem_agendada'
      WHEN 'assistencia_tecnica'  THEN 'assistencia_agendada'
      ELSE NULL
    END;

    IF v_gatilho IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM public.fn_instanciar_tarefas_nativas(NEW.pedido_id, v_gatilho);

    -- Calcula prazo a partir da data/hora do agendamento (fim do dia se não houver hora)
    v_prazo := (
      (NEW.data::text || ' ' ||
        COALESCE(NEW.hora_fim::text, NEW.hora_inicio::text, '18:00:00')
      )::timestamp AT TIME ZONE 'America/Sao_Paulo'
    );

    -- Resolve responsável (agenda.responsavel_id pode ser auth user_id OU profile id)
    IF NEW.responsavel_id IS NOT NULL THEN
      SELECT id INTO v_resp_profile FROM public.profiles WHERE id = NEW.responsavel_id;
      IF v_resp_profile IS NULL THEN
        SELECT id INTO v_resp_profile FROM public.profiles WHERE user_id = NEW.responsavel_id;
      END IF;
    END IF;

    -- Sincroniza prazo/responsável das tarefas recém-criadas por esse gatilho
    UPDATE public.tarefas_pedido tp
    SET prazo = v_prazo,
        pre_alerta_em = v_prazo - make_interval(days => COALESCE(m.pre_alerta_dias,0)),
        responsavel_id = COALESCE(v_resp_profile, tp.responsavel_id)
    FROM public.tarefas_nativas_modelos m
    WHERE tp.modelo_id = m.id
      AND m.gatilho = v_gatilho
      AND tp.pedido_id = NEW.pedido_id
      AND tp.status NOT IN ('concluida','cancelada');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tarefas_nativas agenda trigger falhou: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;
