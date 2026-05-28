
-- =====================================================================
-- ARQUIVOS DO PROJETO — Fase 5: categorias sequenciais + tarefas nativas
-- =====================================================================

-- 1) Categoria do documento de projeto -------------------------------
ALTER TABLE public.pedido_documentos
  ADD COLUMN IF NOT EXISTS categoria_projeto text
    CHECK (categoria_projeto IN ('projeto_vendido','projeto_para_revisao','projeto_revisado'));

CREATE INDEX IF NOT EXISTS idx_pedido_docs_categoria_projeto
  ON public.pedido_documentos (pedido_id, categoria_projeto)
  WHERE categoria_projeto IS NOT NULL;


-- 2) Configurações de automação no modelo de tarefa -----------------
ALTER TABLE public.tarefas_nativas_modelos
  ADD COLUMN IF NOT EXISTS conclui_por_upload_categoria text
    CHECK (conclui_por_upload_categoria IN ('projeto_vendido','projeto_para_revisao','projeto_revisado'));

ALTER TABLE public.tarefas_nativas_modelos
  ADD COLUMN IF NOT EXISTS fonte_responsavel text
    DEFAULT 'fixo'
    CHECK (fonte_responsavel IN ('fixo','vendedor','tecnico_medicao'));


-- 3) Atualiza modelo "Enviar projeto inicial" para 7 dias úteis -----
UPDATE public.tarefas_nativas_modelos
   SET prazo_qtd = 7, prazo_unidade = 'dias', prazo_tipo = 'util',
       fonte_responsavel = 'vendedor'
 WHERE nome = 'Enviar projeto inicial para o cliente';


-- 4) Novos modelos seed ---------------------------------------------
INSERT INTO public.tarefas_nativas_modelos
  (nome, descricao, setor, gatilho, prazo_qtd, prazo_unidade, prazo_tipo, prioridade, ordem,
   exibir_meus_chamados, exibir_controle_prazos, exibir_kanban, ativo,
   conclui_por_upload_categoria, fonte_responsavel, exige_anexo)
VALUES
  ('Subir arquivo 3D vendido',
   'Anexar o arquivo 3D do projeto vendido na seção Projeto Vendido.',
   'Comercial', 'pedido_assinado', 7, 'dias', 'util', 'alta', 35,
   true, true, false, true, 'projeto_vendido', 'vendedor', true),
  ('Anexar Projeto para Revisão',
   'Anexar o projeto atualizado (pós-medição) para revisão em loja.',
   'Conferência', 'medicao_tecnica_concluida', 1, 'dias', 'util', 'alta', 55,
   true, true, false, true, 'projeto_para_revisao', 'tecnico_medicao', true),
  ('Subir Projeto Revisado',
   'Anexar o projeto final revisado após a revisão em loja.',
   'Comercial', 'revisao_projeto_concluida', 1, 'dias', 'util', 'alta', 75,
   true, true, false, true, 'projeto_revisado', 'vendedor', true)
ON CONFLICT DO NOTHING;


-- 5) Helpers para resolver responsável ------------------------------
CREATE OR REPLACE FUNCTION public.fn_resolver_responsavel_tarefa(
  p_pedido_id uuid,
  p_fonte text
) RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
  ELSE
    RETURN NULL;
  END IF;

  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  -- agenda_eventos.responsavel_id pode ser auth.user_id OU profile.id; tenta os dois.
  SELECT id INTO v_profile_id FROM public.profiles WHERE id = v_user_id;
  IF v_profile_id IS NOT NULL THEN RETURN v_profile_id; END IF;
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_user_id;
  RETURN v_profile_id;
END;
$$;


-- 6) Atualiza fn_instanciar_tarefas_nativas para usar fonte_responsavel
CREATE OR REPLACE FUNCTION public.fn_instanciar_tarefas_nativas(
  p_pedido_id uuid,
  p_gatilho text
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido record;
  v_modelo record;
  v_prazo timestamptz;
  v_pre   timestamptz;
  v_resp  uuid;
  v_id    uuid;
  v_count int := 0;
BEGIN
  SELECT id, cliente_id, loja_id INTO v_pedido
    FROM public.pedidos WHERE id = p_pedido_id;
  IF v_pedido.id IS NULL THEN RETURN 0; END IF;

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
      v_prazo := (public.add_dias_uteis(CURRENT_DATE, v_modelo.prazo_qtd, v_pedido.loja_id))::timestamptz;
    ELSE
      v_prazo := now() + make_interval(days => v_modelo.prazo_qtd);
    END IF;

    v_pre := v_prazo - make_interval(days => COALESCE(v_modelo.pre_alerta_dias,0));

    -- Resolve responsável conforme fonte
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
$$;


-- 7) Trigger BEFORE INSERT — validar sequência -----------------------
CREATE OR REPLACE FUNCTION public.fn_validar_sequencia_arquivos_projeto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count_anterior int;
BEGIN
  IF NEW.categoria_projeto IS NULL THEN RETURN NEW; END IF;

  IF NEW.categoria_projeto = 'projeto_para_revisao' THEN
    SELECT COUNT(*) INTO v_count_anterior
      FROM public.pedido_documentos
     WHERE pedido_id = NEW.pedido_id
       AND categoria_projeto = 'projeto_vendido';
    IF v_count_anterior = 0 THEN
      RAISE EXCEPTION 'Envie primeiro o Projeto Vendido.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF NEW.categoria_projeto = 'projeto_revisado' THEN
    SELECT COUNT(*) INTO v_count_anterior
      FROM public.pedido_documentos
     WHERE pedido_id = NEW.pedido_id
       AND categoria_projeto = 'projeto_para_revisao';
    IF v_count_anterior = 0 THEN
      RAISE EXCEPTION 'Envie primeiro o Projeto para Revisão.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_sequencia_arquivos_projeto ON public.pedido_documentos;
CREATE TRIGGER trg_validar_sequencia_arquivos_projeto
  BEFORE INSERT ON public.pedido_documentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_sequencia_arquivos_projeto();


-- 8) Trigger AFTER INSERT — conclui tarefa por upload ----------------
CREATE OR REPLACE FUNCTION public.fn_concluir_tarefa_por_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tarefa_id uuid;
BEGIN
  IF NEW.categoria_projeto IS NULL THEN RETURN NEW; END IF;

  -- Encontra tarefa ativa cujo modelo conclui por esta categoria
  SELECT tp.id INTO v_tarefa_id
    FROM public.tarefas_pedido tp
    JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
   WHERE tp.pedido_id = NEW.pedido_id
     AND m.conclui_por_upload_categoria = NEW.categoria_projeto
     AND tp.status NOT IN ('concluida','cancelada')
   ORDER BY tp.created_at ASC
   LIMIT 1;

  IF v_tarefa_id IS NOT NULL THEN
    UPDATE public.tarefas_pedido
       SET status = 'concluida',
           concluido_em = now(),
           concluido_por = NEW.created_by,
           observacao_conclusao = 'Concluída automaticamente por upload em Arquivos do Projeto.'
     WHERE id = v_tarefa_id;

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, payload, ator_id)
    VALUES (v_tarefa_id, 'concluida_por_upload',
            jsonb_build_object(
              'pedido_documento_id', NEW.id,
              'categoria_projeto', NEW.categoria_projeto,
              'arquivo', NEW.nome
            ),
            NEW.created_by);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_concluir_tarefa_por_upload falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_concluir_tarefa_por_upload ON public.pedido_documentos;
CREATE TRIGGER trg_concluir_tarefa_por_upload
  AFTER INSERT ON public.pedido_documentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_concluir_tarefa_por_upload();


-- 9) Permissões -----------------------------------------------------
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('arquivos_projeto','visualizar','Visualizar Arquivos do Projeto no pedido','Pedido'),
  ('arquivos_projeto','upload','Enviar Arquivos do Projeto','Pedido'),
  ('arquivos_projeto','excluir','Excluir Arquivos do Projeto','Pedido')
ON CONFLICT (modulo, acao) DO NOTHING;


-- 10) Helper para garantir a pasta "Projeto" -------------------------
CREATE OR REPLACE FUNCTION public.fn_garantir_pasta_projeto(p_pedido_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_ordem int;
BEGIN
  SELECT id INTO v_id
    FROM public.pedido_pastas
   WHERE pedido_id = p_pedido_id AND LOWER(nome) = 'projeto'
   LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT COALESCE(MAX(ordem),0) + 1 INTO v_ordem
    FROM public.pedido_pastas WHERE pedido_id = p_pedido_id;

  INSERT INTO public.pedido_pastas (pedido_id, nome, ordem)
  VALUES (p_pedido_id, 'Projeto', v_ordem)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_garantir_pasta_projeto(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_resolver_responsavel_tarefa(uuid, text) TO authenticated;
