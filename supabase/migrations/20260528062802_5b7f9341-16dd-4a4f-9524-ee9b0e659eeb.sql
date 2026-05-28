
CREATE OR REPLACE FUNCTION public.fn_concluir_tarefa_por_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tarefa_id uuid;
  v_status_anterior text;
BEGIN
  IF NEW.categoria_projeto IS NULL THEN RETURN NEW; END IF;

  SELECT tp.id, tp.status INTO v_tarefa_id, v_status_anterior
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
           observacao_conclusao = 'Concluída automaticamente pelo upload do arquivo ' || COALESCE(NEW.nome,'') || '.'
     WHERE id = v_tarefa_id;

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, usuario_id, payload)
    VALUES (v_tarefa_id, 'status', NEW.created_by,
      jsonb_build_object(
        'de', v_status_anterior,
        'para', 'concluida',
        'automatico', true,
        'origem', 'upload_arquivo_projeto',
        'categoria_projeto', NEW.categoria_projeto,
        'pedido_documento_id', NEW.id,
        'arquivo', NEW.nome
      ));

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, usuario_id, payload, anexo_url)
    VALUES (v_tarefa_id, 'anexo', NEW.created_by,
      jsonb_build_object(
        'pedido_documento_id', NEW.id,
        'categoria_projeto', NEW.categoria_projeto,
        'arquivo', NEW.nome
      ),
      NEW.storage_path);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_concluir_tarefa_por_upload falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;
