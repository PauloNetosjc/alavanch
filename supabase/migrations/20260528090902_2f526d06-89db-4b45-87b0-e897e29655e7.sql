
-- 1) Coluna data_assinatura_pdf_final em pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS data_assinatura_pdf_final date;

-- 2) Reconfigurar modelos nativos existentes (sem criar duplicatas)
UPDATE public.tarefas_nativas_modelos
   SET nome = 'Preparo e envio de PDF Projeto Final',
       descricao = 'Preparar e enviar o Projeto Final em PDF para assinatura/aprovação do cliente.',
       setor = 'Técnico',
       gatilho = 'upload_projeto_revisado',
       prazo_qtd = 7,
       prazo_unidade = 'dias',
       prazo_tipo = 'util',
       fonte_responsavel = 'tecnico_medicao',
       conclui_por_upload_categoria = 'projeto_final',
       ativo = true,
       updated_at = now()
 WHERE id = '059006a8-f2b2-4334-9704-ee383c45594f';

UPDATE public.tarefas_nativas_modelos
   SET nome = 'Implantação Fábrica',
       descricao = 'Implantar/liberar o pedido na fábrica após a assinatura do Projeto Final PDF pelo cliente.',
       setor = 'Técnico/Fábrica',
       gatilho = 'pdf_projeto_final_assinado',
       prazo_qtd = 7,
       prazo_unidade = 'dias',
       prazo_tipo = 'util',
       fonte_responsavel = 'tecnico_medicao',
       ativo = true,
       updated_at = now()
 WHERE id = '8d9ead39-9682-4a97-8473-25906639d7e6';

-- 3) Atualizar fn_concluir_tarefa_por_upload:
--    - manter regra atual (revisão pendente bloqueia "Revisão loja")
--    - após concluir validamente "Revisão loja", disparar gatilho upload_projeto_revisado
--      para criar "Preparo e envio de PDF Projeto Final"
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
  v_concluiu_revisao_loja boolean := false;
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
    SELECT tp.id, tp.status, m.conclui_por_upload_categoria, m.nome
      FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE tp.pedido_id = NEW.pedido_id
       AND m.conclui_por_upload_categoria = v_categoria
       AND tp.status NOT IN ('concluida','cancelada')
  LOOP
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

    IF v_categoria = 'projeto_revisado' AND v_tarefa.nome = 'Revisão loja' THEN
      v_concluiu_revisao_loja := true;
    END IF;
  END LOOP;

  IF NEW.categoria_projeto = 'projeto_para_revisao' THEN
    PERFORM public.fn_instanciar_tarefas_nativas(NEW.pedido_id, 'upload_projeto_para_revisao');
  END IF;

  -- Disparar criação de "Preparo e envio de PDF Projeto Final"
  IF v_concluiu_revisao_loja THEN
    PERFORM public.fn_instanciar_tarefas_nativas(NEW.pedido_id, 'upload_projeto_revisado');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_concluir_tarefa_por_upload falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 4) Atualizar fn_concluir_revisao_loja_por_aprovacao para também disparar upload_projeto_revisado
CREATE OR REPLACE FUNCTION public.fn_concluir_revisao_loja_por_aprovacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tem_pendente boolean;
  v_tarefa record;
  v_pedido_id uuid;
  v_concluiu boolean := false;
BEGIN
  IF NOT (COALESCE(OLD.aprovada,false) = false AND COALESCE(NEW.aprovada,false) = true) THEN
    RETURN NEW;
  END IF;

  v_pedido_id := NEW.pedido_id;

  SELECT EXISTS (
    SELECT 1 FROM public.pedido_revisoes
     WHERE pedido_id = v_pedido_id
       AND id <> NEW.id
       AND COALESCE(aprovada,false) = false
  ) INTO v_tem_pendente;

  IF v_tem_pendente THEN
    RETURN NEW;
  END IF;

  FOR v_tarefa IN
    SELECT tp.id, tp.status
      FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE tp.pedido_id = v_pedido_id
       AND m.conclui_por_upload_categoria = 'projeto_revisado'
       AND m.nome = 'Revisão loja'
       AND tp.status NOT IN ('concluida','cancelada')
  LOOP
    UPDATE public.tarefas_pedido
       SET status = 'concluida',
           concluido_em = now(),
           observacao_conclusao = 'Concluída automaticamente após aprovação da revisão.'
     WHERE id = v_tarefa.id;

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, payload)
    VALUES (v_tarefa.id, 'status',
      jsonb_build_object(
        'de', v_tarefa.status, 'para', 'concluida',
        'automatico', true, 'origem', 'aprovacao_revisao',
        'pedido_revisao_id', NEW.id
      ));
    v_concluiu := true;
  END LOOP;

  IF v_concluiu THEN
    PERFORM public.fn_instanciar_tarefas_nativas(v_pedido_id, 'upload_projeto_revisado');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_concluir_revisao_loja_por_aprovacao falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 5) Trigger: criação de solicitacao_assinatura do tipo "PDF final" conclui
--    "Preparo e envio de PDF Projeto Final"
CREATE OR REPLACE FUNCTION public.fn_concluir_preparo_pdf_por_solicitacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo_nome text;
  v_tarefa record;
BEGIN
  SELECT lower(nome) INTO v_tipo_nome FROM public.tipos_documento WHERE id = NEW.tipo_documento_id;
  IF v_tipo_nome IS NULL OR v_tipo_nome NOT IN ('pdf final', 'projeto final', 'pdf projeto final') THEN
    RETURN NEW;
  END IF;

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
           concluido_em = now(),
           concluido_por = NEW.created_by,
           observacao_conclusao = 'Concluída automaticamente após envio do Projeto Final PDF para assinatura do cliente.'
     WHERE id = v_tarefa.id;

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, usuario_id, payload)
    VALUES (v_tarefa.id, 'status', NEW.created_by,
      jsonb_build_object(
        'de', v_tarefa.status, 'para', 'concluida',
        'automatico', true, 'origem', 'solicitacao_assinatura_pdf_final',
        'solicitacao_id', NEW.id
      ));
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_concluir_preparo_pdf_por_solicitacao falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_concluir_preparo_pdf_por_solicitacao ON public.solicitacoes_assinatura;
CREATE TRIGGER trg_concluir_preparo_pdf_por_solicitacao
AFTER INSERT ON public.solicitacoes_assinatura
FOR EACH ROW EXECUTE FUNCTION public.fn_concluir_preparo_pdf_por_solicitacao();

-- 6) Trigger: assinatura do cliente no PDF final cria "Implantação Fábrica"
CREATE OR REPLACE FUNCTION public.fn_pdf_final_assinado_pelo_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo_nome text;
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

  PERFORM public.fn_instanciar_tarefas_nativas(NEW.pedido_id, 'pdf_projeto_final_assinado');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_pdf_final_assinado_pelo_cliente falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pdf_final_assinado_pelo_cliente ON public.solicitacoes_assinatura;
CREATE TRIGGER trg_pdf_final_assinado_pelo_cliente
AFTER UPDATE OF cliente_assinado_em, status ON public.solicitacoes_assinatura
FOR EACH ROW EXECUTE FUNCTION public.fn_pdf_final_assinado_pelo_cliente();

-- 7) Bloqueio do data_envio_fabrica sem PDF final assinado
CREATE OR REPLACE FUNCTION public.fn_validar_implantacao_fabrica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tem_assinatura boolean;
  v_tem_autorizacao boolean;
BEGIN
  IF NEW.data_envio_fabrica IS NULL THEN RETURN NEW; END IF;
  IF OLD.data_envio_fabrica IS NOT NULL AND OLD.data_envio_fabrica = NEW.data_envio_fabrica THEN
    RETURN NEW;
  END IF;

  -- já existe assinatura registrada no pedido?
  IF NEW.data_assinatura_pdf_final IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.solicitacoes_assinatura s
      JOIN public.tipos_documento t ON t.id = s.tipo_documento_id
     WHERE s.pedido_id = NEW.id
       AND s.cliente_assinado_em IS NOT NULL
       AND lower(t.nome) IN ('pdf final', 'projeto final', 'pdf projeto final')
  ) INTO v_tem_assinatura;

  IF v_tem_assinatura THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.autorizacoes
     WHERE pedido_id = NEW.id
       AND status = 'aprovada'
       AND tipo = 'liberar_fabrica_sem_pdf_final_assinado'
  ) INTO v_tem_autorizacao;

  IF v_tem_autorizacao THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'Para implantar na fábrica, é necessário que o cliente assine o Projeto Final PDF.'
    USING ERRCODE = 'check_violation';
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_implantacao_fabrica ON public.pedidos;
CREATE TRIGGER trg_validar_implantacao_fabrica
BEFORE UPDATE OF data_envio_fabrica ON public.pedidos
FOR EACH ROW
WHEN (NEW.data_envio_fabrica IS DISTINCT FROM OLD.data_envio_fabrica)
EXECUTE FUNCTION public.fn_validar_implantacao_fabrica();

-- 8) Conclusão de "Implantação Fábrica" quando data_envio_fabrica é preenchida
CREATE OR REPLACE FUNCTION public.fn_concluir_implantacao_fabrica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tarefa record;
BEGIN
  IF NEW.data_envio_fabrica IS NULL THEN RETURN NEW; END IF;
  IF OLD.data_envio_fabrica IS NOT NULL AND OLD.data_envio_fabrica = NEW.data_envio_fabrica THEN
    RETURN NEW;
  END IF;

  FOR v_tarefa IN
    SELECT tp.id, tp.status
      FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE tp.pedido_id = NEW.id
       AND m.nome = 'Implantação Fábrica'
       AND tp.status NOT IN ('concluida','cancelada')
  LOOP
    UPDATE public.tarefas_pedido
       SET status = 'concluida',
           concluido_em = now(),
           observacao_conclusao = 'Tarefa concluída após implantação/liberação do pedido na fábrica.'
     WHERE id = v_tarefa.id;

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, payload)
    VALUES (v_tarefa.id, 'status',
      jsonb_build_object(
        'de', v_tarefa.status, 'para', 'concluida',
        'automatico', true, 'origem', 'data_envio_fabrica_preenchida',
        'data_envio_fabrica', NEW.data_envio_fabrica
      ));
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_concluir_implantacao_fabrica falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_concluir_implantacao_fabrica ON public.pedidos;
CREATE TRIGGER trg_concluir_implantacao_fabrica
AFTER UPDATE OF data_envio_fabrica ON public.pedidos
FOR EACH ROW
WHEN (NEW.data_envio_fabrica IS DISTINCT FROM OLD.data_envio_fabrica)
EXECUTE FUNCTION public.fn_concluir_implantacao_fabrica();
