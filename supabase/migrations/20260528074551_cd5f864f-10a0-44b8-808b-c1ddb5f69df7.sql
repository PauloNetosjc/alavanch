
-- ============================================================
-- Fix: gatilhos de tarefas nativas ao salvar Cronograma e Datas
-- - Trigger agenda passa a rodar em INSERT e UPDATE (data/tipo/responsável)
-- - Logs explícitos (RAISE LOG) em vez de swallowing silencioso
-- - Gatilho redundante em pedidos.data_medicao_tecnica
-- - Backfill de tarefas faltantes para agendas já existentes
-- ============================================================

-- 1) Reescreve a função do trigger de agenda para rodar em INSERT+UPDATE,
--    atualizar prazo de tarefas abertas, e logar falhas com SQLERRM completo.
CREATE OR REPLACE FUNCTION public.trg_fn_tarefas_nativas_agenda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gatilho text;
  v_base_date date;
  v_time text;
  v_loja uuid;
  v_resp_profile uuid;
  v_data_mudou boolean := true;
  v_pedido_mudou boolean := true;
BEGIN
  BEGIN
    IF NEW.pedido_id IS NULL THEN RETURN NEW; END IF;

    v_gatilho := CASE NEW.tipo::text
      WHEN 'medicao_tecnica'      THEN 'medicao_tecnica_agendada'
      WHEN 'revisao_final'        THEN 'revisao_final_agendada'
      WHEN 'entrega'              THEN 'entrega_agendada'
      WHEN 'montagem'             THEN 'montagem_agendada'
      WHEN 'assistencia_tecnica'  THEN 'assistencia_agendada'
      ELSE NULL
    END;
    IF v_gatilho IS NULL THEN RETURN NEW; END IF;

    -- Em UPDATE, só processa se algo relevante mudou
    IF TG_OP = 'UPDATE' THEN
      v_data_mudou   := NEW.data IS DISTINCT FROM OLD.data
                     OR NEW.hora_inicio IS DISTINCT FROM OLD.hora_inicio
                     OR NEW.hora_fim IS DISTINCT FROM OLD.hora_fim
                     OR NEW.tipo IS DISTINCT FROM OLD.tipo
                     OR NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
                     OR NEW.pedido_id IS DISTINCT FROM OLD.pedido_id;
      IF NOT v_data_mudou THEN RETURN NEW; END IF;
    END IF;

    -- Cria tarefa (idempotente via unique index parcial)
    PERFORM public.fn_instanciar_tarefas_nativas(NEW.pedido_id, v_gatilho);

    v_base_date := NEW.data;
    v_time := COALESCE(NEW.hora_fim::text, NEW.hora_inicio::text, '18:00:00');
    SELECT loja_id INTO v_loja FROM public.pedidos WHERE id = NEW.pedido_id;

    IF NEW.responsavel_id IS NOT NULL THEN
      SELECT id INTO v_resp_profile FROM public.profiles WHERE id = NEW.responsavel_id;
      IF v_resp_profile IS NULL THEN
        SELECT id INTO v_resp_profile FROM public.profiles WHERE user_id = NEW.responsavel_id;
      END IF;
    END IF;

    -- Atualiza prazo/responsável das tarefas abertas vinculadas a este gatilho
    WITH calc AS (
      SELECT tp.id AS tarefa_id, m.pre_alerta_dias,
        (
          (
            CASE
              WHEN m.gatilho_offset_direcao = 'antes' AND m.prazo_tipo = 'util'
                THEN public.sub_dias_uteis(v_base_date, COALESCE(m.gatilho_offset_dias,0), v_loja)
              WHEN m.gatilho_offset_direcao = 'antes'
                THEN v_base_date - COALESCE(m.gatilho_offset_dias,0)
              WHEN m.gatilho_offset_direcao = 'depois' AND m.prazo_tipo = 'util'
                THEN public.add_dias_uteis(v_base_date, COALESCE(m.gatilho_offset_dias,0), v_loja)
              WHEN m.gatilho_offset_direcao = 'depois'
                THEN v_base_date + COALESCE(m.gatilho_offset_dias,0)
              ELSE v_base_date
            END
          )::text || ' ' || v_time
        )::timestamp AT TIME ZONE 'America/Sao_Paulo' AS prazo
        FROM public.tarefas_pedido tp
        JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
       WHERE m.gatilho = v_gatilho
         AND tp.pedido_id = NEW.pedido_id
         AND tp.status NOT IN ('concluida','cancelada')
    )
    UPDATE public.tarefas_pedido tp
       SET prazo = c.prazo,
           pre_alerta_em = c.prazo - make_interval(days => COALESCE(c.pre_alerta_dias,0)),
           responsavel_id = COALESCE(v_resp_profile, tp.responsavel_id)
      FROM calc c
     WHERE tp.id = c.tarefa_id;

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, payload)
    SELECT tp.id, 'agenda_atualizada',
           jsonb_build_object('gatilho', v_gatilho, 'agenda_id', NEW.id, 'data', NEW.data, 'op', TG_OP)
      FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE m.gatilho = v_gatilho
       AND tp.pedido_id = NEW.pedido_id
       AND tp.status NOT IN ('concluida','cancelada');
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'tarefas_nativas agenda trigger falhou: pedido=% tipo=% gatilho=% SQLSTATE=% MSG=%',
      NEW.pedido_id, NEW.tipo, v_gatilho, SQLSTATE, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- 2) Substitui o trigger para rodar em INSERT e UPDATE (data/tipo/responsável)
DROP TRIGGER IF EXISTS trg_tarefas_nativas_agenda_ins ON public.agenda_eventos;
DROP TRIGGER IF EXISTS trg_tarefas_nativas_agenda ON public.agenda_eventos;
CREATE TRIGGER trg_tarefas_nativas_agenda
AFTER INSERT OR UPDATE OF data, hora_inicio, hora_fim, tipo, responsavel_id, pedido_id
ON public.agenda_eventos
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_tarefas_nativas_agenda();

-- 3) Trigger redundante em pedidos.data_medicao_tecnica para preenchimento
--    manual direto na coluna (defense in depth — hoje o fluxo passa pela Agenda,
--    mas garante que qualquer outro caminho também dispare a tarefa).
CREATE OR REPLACE FUNCTION public.trg_fn_tarefas_nativas_pedido_datas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_loja uuid;
  v_data date;
BEGIN
  BEGIN
    IF NEW.data_medicao_tecnica IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.data_medicao_tecnica IS DISTINCT FROM OLD.data_medicao_tecnica) THEN
      v_loja := NEW.loja_id;
      v_data := NEW.data_medicao_tecnica;
      PERFORM public.fn_instanciar_tarefas_nativas(NEW.id, 'medicao_tecnica_agendada');

      WITH calc AS (
        SELECT tp.id AS tarefa_id, m.pre_alerta_dias,
          ((v_data::text || ' 18:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo') AS prazo
          FROM public.tarefas_pedido tp
          JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
         WHERE m.gatilho = 'medicao_tecnica_agendada'
           AND tp.pedido_id = NEW.id
           AND tp.status NOT IN ('concluida','cancelada')
      )
      UPDATE public.tarefas_pedido tp
         SET prazo = c.prazo,
             pre_alerta_em = c.prazo - make_interval(days => COALESCE(c.pre_alerta_dias,0))
        FROM calc c
       WHERE tp.id = c.tarefa_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'tarefas_nativas pedido_datas trigger falhou: pedido=% SQLSTATE=% MSG=%',
      NEW.id, SQLSTATE, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tarefas_nativas_pedido_datas ON public.pedidos;
CREATE TRIGGER trg_tarefas_nativas_pedido_datas
AFTER INSERT OR UPDATE OF data_medicao_tecnica
ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_tarefas_nativas_pedido_datas();

-- 4) BACKFILL: para todo agenda_eventos existente (medicao_tecnica/revisao_final/
--    entrega/montagem/assistencia_tecnica), garante a tarefa nativa criada e
--    com o prazo alinhado.
DO $backfill$
DECLARE
  r record;
  v_gatilho text;
  v_loja uuid;
  v_resp_profile uuid;
  v_time text;
BEGIN
  FOR r IN
    SELECT a.id, a.pedido_id, a.tipo, a.data, a.hora_inicio, a.hora_fim, a.responsavel_id
      FROM public.agenda_eventos a
     WHERE a.pedido_id IS NOT NULL
       AND a.cancelado_em IS NULL
       AND a.tipo::text IN ('medicao_tecnica','revisao_final','entrega','montagem','assistencia_tecnica')
  LOOP
    v_gatilho := CASE r.tipo::text
      WHEN 'medicao_tecnica'      THEN 'medicao_tecnica_agendada'
      WHEN 'revisao_final'        THEN 'revisao_final_agendada'
      WHEN 'entrega'              THEN 'entrega_agendada'
      WHEN 'montagem'             THEN 'montagem_agendada'
      WHEN 'assistencia_tecnica'  THEN 'assistencia_agendada'
    END;

    BEGIN
      PERFORM public.fn_instanciar_tarefas_nativas(r.pedido_id, v_gatilho);

      SELECT loja_id INTO v_loja FROM public.pedidos WHERE id = r.pedido_id;
      v_time := COALESCE(r.hora_fim::text, r.hora_inicio::text, '18:00:00');

      v_resp_profile := NULL;
      IF r.responsavel_id IS NOT NULL THEN
        SELECT id INTO v_resp_profile FROM public.profiles WHERE id = r.responsavel_id;
        IF v_resp_profile IS NULL THEN
          SELECT id INTO v_resp_profile FROM public.profiles WHERE user_id = r.responsavel_id;
        END IF;
      END IF;

      WITH calc AS (
        SELECT tp.id AS tarefa_id, m.pre_alerta_dias,
          (
            (
              CASE
                WHEN m.gatilho_offset_direcao = 'antes' AND m.prazo_tipo = 'util'
                  THEN public.sub_dias_uteis(r.data, COALESCE(m.gatilho_offset_dias,0), v_loja)
                WHEN m.gatilho_offset_direcao = 'antes'
                  THEN r.data - COALESCE(m.gatilho_offset_dias,0)
                WHEN m.gatilho_offset_direcao = 'depois' AND m.prazo_tipo = 'util'
                  THEN public.add_dias_uteis(r.data, COALESCE(m.gatilho_offset_dias,0), v_loja)
                WHEN m.gatilho_offset_direcao = 'depois'
                  THEN r.data + COALESCE(m.gatilho_offset_dias,0)
                ELSE r.data
              END
            )::text || ' ' || v_time
          )::timestamp AT TIME ZONE 'America/Sao_Paulo' AS prazo
          FROM public.tarefas_pedido tp
          JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
         WHERE m.gatilho = v_gatilho
           AND tp.pedido_id = r.pedido_id
           AND tp.status NOT IN ('concluida','cancelada')
      )
      UPDATE public.tarefas_pedido tp
         SET prazo = c.prazo,
             pre_alerta_em = c.prazo - make_interval(days => COALESCE(c.pre_alerta_dias,0)),
             responsavel_id = COALESCE(v_resp_profile, tp.responsavel_id)
        FROM calc c
       WHERE tp.id = c.tarefa_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'backfill tarefas_nativas falhou: pedido=% tipo=% SQLSTATE=% MSG=%',
        r.pedido_id, r.tipo, SQLSTATE, SQLERRM;
    END;
  END LOOP;
END;
$backfill$;
