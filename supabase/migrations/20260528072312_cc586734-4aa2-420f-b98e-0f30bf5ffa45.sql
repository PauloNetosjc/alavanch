
-- 1) Helper: subtrair N dias úteis (drop antes para evitar conflito de nome de parâmetro)
DROP FUNCTION IF EXISTS public.sub_dias_uteis(date, integer, uuid);
CREATE FUNCTION public.sub_dias_uteis(_inicio date, _n integer, _loja uuid)
RETURNS date
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d date := _inicio;
  contados int := 0;
BEGIN
  IF _n <= 0 THEN RETURN _inicio; END IF;
  WHILE contados < _n LOOP
    d := d - 1;
    IF public.is_dia_util(d, _loja) THEN contados := contados + 1; END IF;
  END LOOP;
  RETURN d;
END $$;

-- 2) Permitir fonte_responsavel = 'conferente'
ALTER TABLE public.tarefas_nativas_modelos
  DROP CONSTRAINT IF EXISTS tarefas_nativas_modelos_fonte_responsavel_check;
ALTER TABLE public.tarefas_nativas_modelos
  ADD CONSTRAINT tarefas_nativas_modelos_fonte_responsavel_check
  CHECK (fonte_responsavel = ANY (ARRAY['fixo','vendedor','tecnico_medicao','conferente']));

-- 3) Resolver responsável: incluir 'conferente'
CREATE OR REPLACE FUNCTION public.fn_resolver_responsavel_tarefa(p_pedido_id uuid, p_fonte text)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
BEGIN
  IF p_fonte = 'vendedor' THEN
    SELECT COALESCE(o.vendedor_id, o.consultor_id) INTO v_user_id
      FROM public.pedidos p
      LEFT JOIN public.orcamentos o ON o.id = p.orcamento_id
     WHERE p.id = p_pedido_id;
  ELSIF p_fonte = 'tecnico_medicao' THEN
    SELECT a.responsavel_id INTO v_user_id
      FROM public.agenda_eventos a
     WHERE a.pedido_id = p_pedido_id
       AND a.tipo::text = 'medicao_tecnica'
       AND a.cancelado_em IS NULL
     ORDER BY a.data DESC, a.created_at DESC
     LIMIT 1;
  ELSIF p_fonte = 'conferente' THEN
    SELECT a.responsavel_id INTO v_user_id
      FROM public.agenda_eventos a
     WHERE a.pedido_id = p_pedido_id
       AND a.tipo::text = 'revisao_final'
       AND a.cancelado_em IS NULL
     ORDER BY a.data DESC, a.created_at DESC
     LIMIT 1;
  ELSE
    RETURN NULL;
  END IF;

  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE id = v_user_id;
  IF v_profile_id IS NOT NULL THEN RETURN v_profile_id; END IF;
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_user_id;
  RETURN v_profile_id;
END;
$$;

-- 4) Trigger da agenda: respeitar offset antes/depois + tipo (util/corrido) por modelo
CREATE OR REPLACE FUNCTION public.trg_fn_tarefas_nativas_agenda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_gatilho text;
  v_base_date date;
  v_time text;
  v_loja uuid;
  v_resp_profile uuid;
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
           jsonb_build_object('gatilho', v_gatilho, 'agenda_id', NEW.id, 'data', NEW.data)
      FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE m.gatilho = v_gatilho
       AND tp.pedido_id = NEW.pedido_id
       AND tp.status NOT IN ('concluida','cancelada');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tarefas_nativas agenda trigger falhou: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- 5) Modelos nativos
INSERT INTO public.tarefas_nativas_modelos (
  nome, descricao, setor, gatilho,
  gatilho_offset_dias, gatilho_offset_direcao,
  prazo_qtd, prazo_unidade, prazo_tipo,
  pre_alerta_dias, prioridade, ordem,
  exige_anexo, exige_aprovacao,
  exibir_meus_chamados, exibir_controle_prazos, exibir_kanban,
  ativo, fonte_responsavel, conclui_por_upload_categoria
)
SELECT
  'Preparo projeto revisão',
  'Preparar o projeto para a revisão agendada. Concluída automaticamente ao subir arquivo em Arquivos do Projeto > Projeto para Revisão.',
  'projeto', 'revisao_final_agendada',
  1, 'antes',
  1, 'dias', 'util',
  1, 'alta', 10,
  false, false,
  true, true, false,
  true, 'conferente', 'projeto_para_revisao'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tarefas_nativas_modelos
  WHERE nome = 'Preparo projeto revisão' AND loja_id IS NULL
);

INSERT INTO public.tarefas_nativas_modelos (
  nome, descricao, setor, gatilho,
  gatilho_offset_dias, gatilho_offset_direcao,
  prazo_qtd, prazo_unidade, prazo_tipo,
  pre_alerta_dias, prioridade, ordem,
  exige_anexo, exige_aprovacao,
  exibir_meus_chamados, exibir_controle_prazos, exibir_kanban,
  ativo, fonte_responsavel, conclui_por_upload_categoria
)
SELECT
  'Revisão loja',
  'Revisar o projeto após upload em Arquivos do Projeto > Projeto para Revisão. Sem prazo obrigatório.',
  'comercial', 'upload_projeto_para_revisao',
  0, 'no_dia',
  365, 'dias', 'corrido',
  0, 'media', 20,
  false, false,
  true, false, false,
  true, 'vendedor', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.tarefas_nativas_modelos
  WHERE nome = 'Revisão loja' AND loja_id IS NULL
);

-- 6) Trigger de upload: concluir tarefas + instanciar "Revisão loja"
CREATE OR REPLACE FUNCTION public.fn_concluir_tarefa_por_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tarefa_id uuid;
  v_status_anterior text;
  v_categoria text;
  v_pasta_nome text;
  v_origem text;
BEGIN
  v_categoria := NEW.categoria_projeto;
  v_origem := 'upload_arquivo_projeto';

  IF v_categoria IS NULL AND NEW.pasta_id IS NOT NULL THEN
    SELECT nome INTO v_pasta_nome FROM public.pedido_pastas WHERE id = NEW.pasta_id;
    IF v_pasta_nome IS NOT NULL THEN
      v_categoria := CASE lower(trim(v_pasta_nome))
        WHEN 'projeto inicial' THEN 'projeto_inicial'
        WHEN 'projeto final'   THEN 'projeto_final'
        WHEN 'medição técnica' THEN 'medicao_tecnica'
        WHEN 'medicao tecnica' THEN 'medicao_tecnica'
        WHEN 'vistoria técnico' THEN 'vistoria_tecnico'
        WHEN 'vistoria tecnico' THEN 'vistoria_tecnico'
        WHEN 'vistoria cliente' THEN 'vistoria_cliente'
        WHEN 'check-in obra'    THEN 'checkin_obra'
        WHEN 'checkin obra'     THEN 'checkin_obra'
        ELSE NULL
      END;
      v_origem := 'upload_central_documentos';
    END IF;
  END IF;

  IF v_categoria IS NULL THEN RETURN NEW; END IF;

  SELECT tp.id, tp.status INTO v_tarefa_id, v_status_anterior
    FROM public.tarefas_pedido tp
    JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
   WHERE tp.pedido_id = NEW.pedido_id
     AND m.conclui_por_upload_categoria = v_categoria
     AND tp.status NOT IN ('concluida','cancelada')
   ORDER BY tp.created_at ASC
   LIMIT 1;

  IF v_tarefa_id IS NOT NULL THEN
    UPDATE public.tarefas_pedido
       SET status = 'concluida',
           concluido_em = now(),
           concluido_por = NEW.created_by,
           observacao_conclusao = 'Concluída automaticamente pelo upload do arquivo ' || COALESCE(NEW.nome,'') || '.'
     WHERE id = v_tarefa_id;

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, usuario_id, payload)
    VALUES (v_tarefa_id, 'status', NEW.created_by,
      jsonb_build_object(
        'de', v_status_anterior, 'para', 'concluida',
        'automatico', true, 'origem', v_origem,
        'categoria_projeto', v_categoria, 'pasta_nome', v_pasta_nome,
        'pedido_documento_id', NEW.id, 'arquivo', NEW.nome
      ));

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, usuario_id, payload, anexo_url)
    VALUES (v_tarefa_id, 'anexo', NEW.created_by,
      jsonb_build_object(
        'pedido_documento_id', NEW.id,
        'categoria_projeto', v_categoria,
        'arquivo', NEW.nome
      ),
      NEW.storage_path);
  END IF;

  -- Upload em Projeto para Revisão (apenas Arquivos do Projeto) instancia "Revisão loja"
  IF NEW.categoria_projeto = 'projeto_para_revisao' THEN
    PERFORM public.fn_instanciar_tarefas_nativas(NEW.pedido_id, 'upload_projeto_para_revisao');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_concluir_tarefa_por_upload falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;
