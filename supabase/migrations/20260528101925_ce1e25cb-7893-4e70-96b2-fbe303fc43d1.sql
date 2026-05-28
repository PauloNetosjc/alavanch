-- 1) Remove a regra de conclusão automática por upload do modelo
--    "Preparo e envio de PDF Projeto Final". O upload em Central de
--    Documentos > Projeto Final NÃO conclui mais a tarefa.
UPDATE public.tarefas_nativas_modelos
   SET conclui_por_upload_categoria = NULL,
       updated_at = now()
 WHERE nome = 'Preparo e envio de PDF Projeto Final'
   AND conclui_por_upload_categoria = 'projeto_final';

-- 2) Atualiza fn_pdf_final_assinado_pelo_cliente para ALÉM de criar
--    a tarefa "Implantação Fábrica", concluir explicitamente a tarefa
--    "Preparo e envio de PDF Projeto Final" do pedido.
CREATE OR REPLACE FUNCTION public.fn_pdf_final_assinado_pelo_cliente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo_nome text;
  v_tarefa record;
BEGIN
  IF NEW.cliente_assinado_em IS NULL THEN RETURN NEW; END IF;
  IF OLD.cliente_assinado_em IS NOT NULL THEN RETURN NEW; END IF;

  SELECT lower(nome) INTO v_tipo_nome FROM public.tipos_documento WHERE id = NEW.tipo_documento_id;
  IF v_tipo_nome IS NULL OR v_tipo_nome NOT IN ('pdf final', 'projeto final', 'pdf projeto final') THEN
    RETURN NEW;
  END IF;

  UPDATE public.pedidos
     SET data_assinatura_pdf_final = COALESCE(data_assinatura_pdf_final, (NEW.cliente_assinado_em AT TIME ZONE 'America/Sao_Paulo')::date)
   WHERE id = NEW.pedido_id;

  -- Conclui explicitamente a tarefa "Preparo e envio de PDF Projeto Final"
  -- (que NÃO deve mais ser concluída por upload simples).
  FOR v_tarefa IN
    SELECT tp.id, tp.status
      FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE tp.pedido_id = NEW.pedido_id
       AND m.nome = 'Preparo e envio de PDF Projeto Final'
       AND tp.status NOT IN ('concluida','cancelada')
  LOOP
    UPDATE public.tarefas_pedido
       SET status = 'concluida',
           concluido_em = COALESCE(concluido_em, NEW.cliente_assinado_em),
           observacao_conclusao = COALESCE(observacao_conclusao,
             'Concluída automaticamente pela assinatura/aprovação do PDF Projeto Final pelo cliente.')
     WHERE id = v_tarefa.id;

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, payload)
    VALUES (v_tarefa.id, 'status',
      jsonb_build_object(
        'de', v_tarefa.status, 'para', 'concluida',
        'automatico', true,
        'origem', 'pdf_projeto_final_assinado',
        'pedido_documento_id', NEW.id
      ));
  END LOOP;

  -- Cria a próxima tarefa do fluxo (Implantação Fábrica), idempotente.
  PERFORM public.fn_instanciar_tarefas_nativas(NEW.pedido_id, 'pdf_projeto_final_assinado');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_pdf_final_assinado_pelo_cliente falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 3) Backfill: reabrir tarefas "Preparo e envio de PDF Projeto Final"
--    que foram concluídas por upload (origem = upload_arquivo_projeto
--    ou upload_central_documentos) cujo pedido ainda NÃO tem
--    data_assinatura_pdf_final preenchida.
WITH tarefas_indevidas AS (
  SELECT tp.id
    FROM public.tarefas_pedido tp
    JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
    JOIN public.pedidos p ON p.id = tp.pedido_id
   WHERE m.nome = 'Preparo e envio de PDF Projeto Final'
     AND tp.status = 'concluida'
     AND p.data_assinatura_pdf_final IS NULL
     AND EXISTS (
       SELECT 1 FROM public.eventos_tarefa ev
        WHERE ev.tarefa_id = tp.id
          AND ev.tipo = 'status'
          AND (ev.payload->>'origem') IN ('upload_arquivo_projeto','upload_central_documentos')
     )
)
UPDATE public.tarefas_pedido tp
   SET status = 'pendente',
       concluido_em = NULL,
       observacao_conclusao = NULL
  FROM tarefas_indevidas ti
 WHERE tp.id = ti.id;
