
-- 1) Atualiza fn_concluir_tarefa_por_upload para validar status da revisão
CREATE OR REPLACE FUNCTION public.fn_concluir_tarefa_por_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_categoria text;
  v_pasta_nome text;
  v_origem text;
  v_tarefa record;
  v_tem_revisao_pendente boolean;
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

  FOR v_tarefa IN
    SELECT tp.id, tp.status, m.conclui_por_upload_categoria, m.chave
      FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE tp.pedido_id = NEW.pedido_id
       AND m.conclui_por_upload_categoria = v_categoria
       AND tp.status NOT IN ('concluida','cancelada')
  LOOP
    -- Para "Revisão loja" (upload em projeto_revisado): bloquear se houver revisão pendente
    IF v_categoria = 'projeto_revisado' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.pedido_revisoes
         WHERE pedido_id = NEW.pedido_id
           AND COALESCE(aprovada, false) = false
      ) INTO v_tem_revisao_pendente;

      IF v_tem_revisao_pendente THEN
        INSERT INTO public.eventos_tarefa (tarefa_id, tipo, usuario_id, payload)
        VALUES (v_tarefa.id, 'comentario', NEW.created_by,
          jsonb_build_object(
            'mensagem', 'Upload em Projeto Revisado registrado, mas a tarefa permanece pendente porque ainda existe revisão aguardando aprovação.',
            'pedido_documento_id', NEW.id,
            'arquivo', NEW.nome
          ));
        CONTINUE;
      END IF;
    END IF;

    UPDATE public.tarefas_pedido
       SET status = 'concluida',
           concluido_em = now(),
           concluido_por = NEW.created_by,
           observacao_conclusao = 'Concluída automaticamente pelo upload do arquivo ' || COALESCE(NEW.nome,'') || '.'
     WHERE id = v_tarefa.id;

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, usuario_id, payload)
    VALUES (v_tarefa.id, 'status', NEW.created_by,
      jsonb_build_object(
        'de', v_tarefa.status, 'para', 'concluida',
        'automatico', true, 'origem', v_origem,
        'categoria_projeto', v_categoria, 'pasta_nome', v_pasta_nome,
        'pedido_documento_id', NEW.id, 'arquivo', NEW.nome
      ));

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, usuario_id, payload, anexo_url)
    VALUES (v_tarefa.id, 'anexo', NEW.created_by,
      jsonb_build_object(
        'pedido_documento_id', NEW.id,
        'categoria_projeto', v_categoria,
        'arquivo', NEW.nome
      ),
      NEW.storage_path);
  END LOOP;

  IF NEW.categoria_projeto = 'projeto_para_revisao' THEN
    PERFORM public.fn_instanciar_tarefas_nativas(NEW.pedido_id, 'upload_projeto_para_revisao');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_concluir_tarefa_por_upload falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 2) Gatilho para concluir "Revisão loja" ao aprovar revisão (quando não restar pendente)
CREATE OR REPLACE FUNCTION public.fn_concluir_revisao_loja_por_aprovacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pendentes int;
  v_tarefa record;
BEGIN
  IF COALESCE(NEW.aprovada, false) = false THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.aprovada, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_pendentes
    FROM public.pedido_revisoes
   WHERE pedido_id = NEW.pedido_id
     AND COALESCE(aprovada, false) = false;

  IF v_pendentes > 0 THEN
    RETURN NEW;
  END IF;

  FOR v_tarefa IN
    SELECT tp.id, tp.status
      FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE tp.pedido_id = NEW.pedido_id
       AND m.conclui_por_upload_categoria = 'projeto_revisado'
       AND tp.status NOT IN ('concluida','cancelada')
  LOOP
    UPDATE public.tarefas_pedido
       SET status = 'concluida',
           concluido_em = now(),
           concluido_por = NEW.created_by,
           observacao_conclusao = 'Concluída automaticamente pela aprovação da revisão do projeto.'
     WHERE id = v_tarefa.id;

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, usuario_id, payload)
    VALUES (v_tarefa.id, 'status', NEW.created_by,
      jsonb_build_object(
        'de', v_tarefa.status, 'para', 'concluida',
        'automatico', true, 'origem', 'aprovacao_revisao',
        'pedido_revisao_id', NEW.id, 'versao', NEW.versao
      ));
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_concluir_revisao_loja_por_aprovacao falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_concluir_revisao_loja_por_aprovacao ON public.pedido_revisoes;
CREATE TRIGGER trg_concluir_revisao_loja_por_aprovacao
AFTER INSERT OR UPDATE OF aprovada ON public.pedido_revisoes
FOR EACH ROW EXECUTE FUNCTION public.fn_concluir_revisao_loja_por_aprovacao();

-- 3) Reabrir tarefas "Revisão loja" concluídas indevidamente
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tp.id, tp.pedido_id
      FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE tp.status = 'concluida'
       AND m.conclui_por_upload_categoria = 'projeto_revisado'
       AND EXISTS (
         SELECT 1 FROM public.pedido_revisoes pr
          WHERE pr.pedido_id = tp.pedido_id
            AND COALESCE(pr.aprovada, false) = false
       )
  LOOP
    UPDATE public.tarefas_pedido
       SET status = 'pendente',
           concluido_em = NULL,
           concluido_por = NULL,
           observacao_conclusao = NULL,
           updated_at = now()
     WHERE id = r.id;

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, usuario_id, payload)
    VALUES (r.id, 'comentario', NULL,
      jsonb_build_object('mensagem', 'Tarefa reaberta porque a revisão ainda aguardava aprovação.'));
  END LOOP;
END $$;
