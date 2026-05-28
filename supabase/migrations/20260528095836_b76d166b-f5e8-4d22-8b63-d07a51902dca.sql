-- Função central que garante as tarefas obrigatórias do cronograma do pedido.
-- Idempotente (usa unique index uniq_tarefas_pedido_modelo) e nunca duplica
-- tarefa ativa equivalente. Sempre recalcula o prazo das tarefas abertas
-- com base na data real agendada.
CREATE OR REPLACE FUNCTION public.ensure_tarefas_cronograma_pedido(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loja_id      uuid;
  v_med_data     date;
  v_rev_data     date;
  v_criadas_med  int := 0;
  v_criadas_rev  int := 0;
BEGIN
  IF p_pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pedido_id null');
  END IF;

  SELECT loja_id INTO v_loja_id FROM public.pedidos WHERE id = p_pedido_id;

  -- Última data agendada para Medição Técnica
  SELECT MAX(data) INTO v_med_data
    FROM public.agenda_eventos
   WHERE pedido_id = p_pedido_id AND tipo = 'medicao_tecnica';

  -- Última data agendada para Revisão Final
  SELECT MAX(data) INTO v_rev_data
    FROM public.agenda_eventos
   WHERE pedido_id = p_pedido_id AND tipo = 'revisao_final';

  -- 1) Garante tarefa "Fazer medição técnica" (chave fazer_medicao_tecnica)
  IF v_med_data IS NOT NULL THEN
    BEGIN
      v_criadas_med := public.fn_instanciar_tarefas_nativas(p_pedido_id, 'medicao_tecnica_agendada');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[ensure_tarefas_cronograma_pedido] erro medicao: %', SQLERRM;
    END;

    -- Recalcula prazo = data da medição às 18:00 (BRT)
    WITH calc AS (
      SELECT tp.id AS tarefa_id, m.pre_alerta_dias,
             ((v_med_data::text || ' 18:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo') AS prazo
        FROM public.tarefas_pedido tp
        JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
       WHERE m.gatilho = 'medicao_tecnica_agendada'
         AND tp.pedido_id = p_pedido_id
         AND tp.status NOT IN ('concluida','cancelada')
    )
    UPDATE public.tarefas_pedido tp
       SET prazo = c.prazo,
           pre_alerta_em = c.prazo - make_interval(days => COALESCE(c.pre_alerta_dias,0))
      FROM calc c
     WHERE tp.id = c.tarefa_id;
  END IF;

  -- 2) Garante tarefa "Preparo projeto revisão" (chave preparo_projeto_revisao)
  IF v_rev_data IS NOT NULL THEN
    BEGIN
      v_criadas_rev := public.fn_instanciar_tarefas_nativas(p_pedido_id, 'revisao_final_agendada');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[ensure_tarefas_cronograma_pedido] erro revisao: %', SQLERRM;
    END;

    -- Recalcula prazo = 1 dia útil antes da data da revisão (modelo: offset=antes)
    WITH calc AS (
      SELECT tp.id AS tarefa_id, m.pre_alerta_dias,
        (
          (
            CASE
              WHEN m.gatilho_offset_direcao = 'antes' AND m.prazo_tipo = 'util'
                THEN public.sub_dias_uteis(v_rev_data, COALESCE(m.gatilho_offset_dias,1), v_loja_id)
              WHEN m.gatilho_offset_direcao = 'antes'
                THEN v_rev_data - COALESCE(m.gatilho_offset_dias,1)
              WHEN m.gatilho_offset_direcao = 'depois' AND m.prazo_tipo = 'util'
                THEN public.add_dias_uteis(v_rev_data, COALESCE(m.gatilho_offset_dias,0), v_loja_id)
              WHEN m.gatilho_offset_direcao = 'depois'
                THEN v_rev_data + COALESCE(m.gatilho_offset_dias,0)
              ELSE v_rev_data
            END
          )::text || ' 18:00:00'
        )::timestamp AT TIME ZONE 'America/Sao_Paulo' AS prazo
        FROM public.tarefas_pedido tp
        JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
       WHERE m.gatilho = 'revisao_final_agendada'
         AND tp.pedido_id = p_pedido_id
         AND tp.status NOT IN ('concluida','cancelada')
    )
    UPDATE public.tarefas_pedido tp
       SET prazo = c.prazo,
           pre_alerta_em = c.prazo - make_interval(days => COALESCE(c.pre_alerta_dias,0))
      FROM calc c
     WHERE tp.id = c.tarefa_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'medicao_data', v_med_data,
    'criadas_medicao', v_criadas_med,
    'revisao_data', v_rev_data,
    'criadas_revisao', v_criadas_rev
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_tarefas_cronograma_pedido(uuid) TO authenticated, service_role;

-- Trigger de blindagem na agenda: sempre que houver insert/update relevante
-- em medicao_tecnica/revisao_final, garante as tarefas obrigatórias.
CREATE OR REPLACE FUNCTION public.trg_fn_ensure_cronograma_tarefas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pedido_id IS NOT NULL
     AND NEW.tipo::text IN ('medicao_tecnica','revisao_final') THEN
    BEGIN
      PERFORM public.ensure_tarefas_cronograma_pedido(NEW.pedido_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[trg_ensure_cronograma_tarefas] %: %', NEW.pedido_id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_cronograma_tarefas ON public.agenda_eventos;
CREATE TRIGGER trg_ensure_cronograma_tarefas
AFTER INSERT OR UPDATE OF data, tipo, pedido_id
ON public.agenda_eventos
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_ensure_cronograma_tarefas();

-- Backfill: rodar para todos os pedidos com agenda de medição ou revisão
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT pedido_id
      FROM public.agenda_eventos
     WHERE pedido_id IS NOT NULL
       AND tipo::text IN ('medicao_tecnica','revisao_final')
  LOOP
    BEGIN
      PERFORM public.ensure_tarefas_cronograma_pedido(r.pedido_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'backfill ensure_tarefas falhou pedido %: %', r.pedido_id, SQLERRM;
    END;
  END LOOP;
END $$;