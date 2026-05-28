
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
BEGIN
  -- 1) Categoria operacional explícita (bloco Arquivos do Projeto)
  v_categoria := NEW.categoria_projeto;

  -- 2) Fallback: derivar categoria pela pasta da Central de Documentos
  IF v_categoria IS NULL AND NEW.pasta_id IS NOT NULL THEN
    SELECT nome INTO v_pasta_nome
      FROM public.pedido_pastas
     WHERE id = NEW.pasta_id;

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
        'de', v_status_anterior,
        'para', 'concluida',
        'automatico', true,
        'origem', CASE WHEN NEW.categoria_projeto IS NOT NULL
                       THEN 'upload_arquivo_projeto'
                       ELSE 'upload_central_documentos' END,
        'categoria_projeto', v_categoria,
        'pasta_nome', v_pasta_nome,
        'pedido_documento_id', NEW.id,
        'arquivo', NEW.nome
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_concluir_tarefa_por_upload falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;
