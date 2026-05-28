-- 1) Atualiza fn_instanciar_tarefas_nativas para que "Revisão loja"
--    nunca seja criada sem prazo: se não houver data de Revisão agendada,
--    usa a data atual como base (mantém os 7 dias úteis do modelo).
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

    -- Caso especial "Revisão loja": prazo = 7 dias úteis após data da Revisão
    -- agendada. Se não houver Revisão agendada ainda, usa data atual como
    -- fallback para garantir que a tarefa sempre tenha um prazo válido.
    IF v_modelo.nome = 'Revisão loja' AND v_modelo.gatilho = 'upload_projeto_para_revisao' THEN
      SELECT (data)::date INTO v_data_revisao
        FROM public.agenda_eventos
       WHERE pedido_id = v_pedido.id AND tipo = 'revisao_final'
       ORDER BY created_at DESC LIMIT 1;
      IF v_data_revisao IS NOT NULL THEN
        v_use_base := v_data_revisao;
      ELSE
        RAISE NOTICE '[Revisão loja] sem data de Revisão agendada — usando data atual como base (pedido %)', v_pedido.id;
      END IF;
    END IF;

    IF v_modelo.prazo_unidade = 'horas' THEN
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


-- 2) Função central de blindagem do fluxo Revisão Loja + PDF Final.
--    Idempotente, segura e sem efeitos colaterais quando nada se aplica.
CREATE OR REPLACE FUNCTION public.ensure_fluxo_revisao_e_pdf_final(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loja_id uuid;
  v_data_revisao date;
  v_data_base date;
  v_data_alvo date;
  v_tem_upload_para_rev boolean;
  v_tem_upload_revisado boolean;
  v_tem_revisao_aprovada boolean;
  v_tem_revisao_pendente boolean;
  v_criou_revisao_loja int := 0;
  v_criou_pdf_final int := 0;
  v_concluiu_revisao_loja boolean := false;
  v_revisao_loja record;
BEGIN
  IF p_pedido_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pedido_id null');
  END IF;

  SELECT loja_id INTO v_loja_id FROM public.pedidos WHERE id = p_pedido_id;

  -- Data da Revisão Final agendada (se houver)
  SELECT MAX(data) INTO v_data_revisao
    FROM public.agenda_eventos
   WHERE pedido_id = p_pedido_id AND tipo = 'revisao_final';

  -- Uploads realizados em Arquivos do Projeto
  SELECT EXISTS (
    SELECT 1 FROM public.pedido_documentos
     WHERE pedido_id = p_pedido_id
       AND categoria_projeto = 'projeto_para_revisao'
       AND COALESCE(ativo, true) = true
  ) INTO v_tem_upload_para_rev;

  SELECT EXISTS (
    SELECT 1 FROM public.pedido_documentos
     WHERE pedido_id = p_pedido_id
       AND categoria_projeto = 'projeto_revisado'
       AND COALESCE(ativo, true) = true
  ) INTO v_tem_upload_revisado;

  -- Revisão de valores
  SELECT EXISTS (
    SELECT 1 FROM public.pedido_revisoes
     WHERE pedido_id = p_pedido_id AND COALESCE(aprovada,false) = false
  ) INTO v_tem_revisao_pendente;

  SELECT EXISTS (
    SELECT 1 FROM public.pedido_revisoes
     WHERE pedido_id = p_pedido_id AND COALESCE(aprovada,false) = true
  ) INTO v_tem_revisao_aprovada;

  -- 1) Garante "Revisão loja" quando houver Projeto para Revisão enviado
  IF v_tem_upload_para_rev THEN
    BEGIN
      v_criou_revisao_loja := public.fn_instanciar_tarefas_nativas(p_pedido_id, 'upload_projeto_para_revisao');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[ensure_fluxo] erro criar revisao_loja: %', SQLERRM;
    END;
  END IF;

  -- 1b) Recalcula prazo da "Revisão loja" (7 dias úteis após a data da Revisão
  --     agendada). Se não houver agenda, usa a data atual como base — nunca
  --     deixa a tarefa com prazo nulo.
  v_data_base := COALESCE(v_data_revisao, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_data_alvo := public.add_dias_uteis(v_data_base, 7, v_loja_id);

  WITH calc AS (
    SELECT tp.id AS tarefa_id, m.pre_alerta_dias,
           ((v_data_alvo::text || ' 18:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo') AS prazo
      FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE m.gatilho = 'upload_projeto_para_revisao'
       AND m.nome = 'Revisão loja'
       AND tp.pedido_id = p_pedido_id
       AND tp.status NOT IN ('concluida','cancelada')
  )
  UPDATE public.tarefas_pedido tp
     SET prazo = c.prazo,
         pre_alerta_em = c.prazo - make_interval(days => COALESCE(c.pre_alerta_dias,0))
    FROM calc c
   WHERE tp.id = c.tarefa_id;

  -- 2) Conclui automaticamente a "Revisão loja" quando houver evento válido:
  --    (a) upload projeto_revisado SEM revisão de valores pendente, OU
  --    (b) revisão de valores aprovada e nenhuma pendente.
  IF (v_tem_upload_revisado AND NOT v_tem_revisao_pendente)
     OR (v_tem_revisao_aprovada AND NOT v_tem_revisao_pendente) THEN
    FOR v_revisao_loja IN
      SELECT tp.id, tp.status
        FROM public.tarefas_pedido tp
        JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
       WHERE tp.pedido_id = p_pedido_id
         AND m.nome = 'Revisão loja'
         AND m.gatilho = 'upload_projeto_para_revisao'
         AND tp.status NOT IN ('concluida','cancelada')
    LOOP
      UPDATE public.tarefas_pedido
         SET status = 'concluida',
             concluido_em = COALESCE(concluido_em, now()),
             observacao_conclusao = COALESCE(observacao_conclusao,
               'Concluída automaticamente por ensure_fluxo_revisao_e_pdf_final.')
       WHERE id = v_revisao_loja.id;

      INSERT INTO public.eventos_tarefa (tarefa_id, tipo, payload)
      VALUES (v_revisao_loja.id, 'status',
        jsonb_build_object(
          'de', v_revisao_loja.status, 'para', 'concluida',
          'automatico', true, 'origem', 'ensure_fluxo_revisao_e_pdf_final',
          'upload_projeto_revisado', v_tem_upload_revisado,
          'revisao_aprovada', v_tem_revisao_aprovada
        ));

      v_concluiu_revisao_loja := true;
    END LOOP;

    -- 3) Dispara criação de "Preparo e envio de PDF Projeto Final"
    --    quando a Revisão loja foi concluída (agora ou anteriormente).
    BEGIN
      v_criou_pdf_final := public.fn_instanciar_tarefas_nativas(p_pedido_id, 'upload_projeto_revisado');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[ensure_fluxo] erro criar pdf final: %', SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'data_revisao', v_data_revisao,
    'tem_upload_para_revisao', v_tem_upload_para_rev,
    'tem_upload_revisado', v_tem_upload_revisado,
    'tem_revisao_pendente', v_tem_revisao_pendente,
    'tem_revisao_aprovada', v_tem_revisao_aprovada,
    'criou_revisao_loja', v_criou_revisao_loja,
    'concluiu_revisao_loja', v_concluiu_revisao_loja,
    'criou_pdf_final', v_criou_pdf_final
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_fluxo_revisao_e_pdf_final(uuid) TO authenticated, service_role;


-- 3) Trigger extra na agenda: sempre que a data da Revisão Final mudar,
--    recalcula o prazo da "Revisão loja" via ensure_fluxo.
CREATE OR REPLACE FUNCTION public.trg_fn_ensure_fluxo_revisao_agenda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pedido_id IS NOT NULL AND NEW.tipo::text = 'revisao_final' THEN
    BEGIN
      PERFORM public.ensure_fluxo_revisao_e_pdf_final(NEW.pedido_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[trg_ensure_fluxo_revisao_agenda] %: %', NEW.pedido_id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_fluxo_revisao_agenda ON public.agenda_eventos;
CREATE TRIGGER trg_ensure_fluxo_revisao_agenda
AFTER INSERT OR UPDATE OF data, tipo, pedido_id
ON public.agenda_eventos
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_ensure_fluxo_revisao_agenda();


-- 4) Backfill: roda ensure_fluxo para todos os pedidos que já têm alguma
--    pista do fluxo (upload de Projeto para Revisão / Projeto Revisado,
--    revisão de valores, ou tarefa "Revisão loja" sem prazo).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT pedido_id FROM (
      SELECT pedido_id FROM public.pedido_documentos
        WHERE categoria_projeto IN ('projeto_para_revisao','projeto_revisado')
          AND COALESCE(ativo,true) = true
      UNION
      SELECT pedido_id FROM public.pedido_revisoes
      UNION
      SELECT tp.pedido_id
        FROM public.tarefas_pedido tp
        JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
       WHERE m.nome = 'Revisão loja' AND tp.prazo IS NULL
    ) s
   WHERE pedido_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.ensure_fluxo_revisao_e_pdf_final(r.pedido_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'backfill ensure_fluxo pedido %: %', r.pedido_id, SQLERRM;
    END;
  END LOOP;
END $$;