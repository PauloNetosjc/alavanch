
-- 1) Estende constraint da categoria de Arquivos do Projeto para incluir 'projeto_para_producao'
ALTER TABLE public.pedido_documentos
  DROP CONSTRAINT IF EXISTS pedido_documentos_categoria_projeto_check;

ALTER TABLE public.pedido_documentos
  ADD CONSTRAINT pedido_documentos_categoria_projeto_check
  CHECK (categoria_projeto = ANY (ARRAY[
    'projeto_vendido'::text,
    'projeto_para_revisao'::text,
    'projeto_revisado'::text,
    'projeto_para_producao'::text,
    'medicao_tecnica'::text
  ]));

-- 2) Adiciona coluna status_fabrica em pedidos (controle de liberação para Fábrica)
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS status_fabrica text;

-- 3) Função central: garante regra "PDF Final assinado + Projeto para Produção enviado"
CREATE OR REPLACE FUNCTION public.ensure_fluxo_projeto_final_producao_e_fabrica(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tem_producao boolean;
  v_pdf_assinado boolean;
  v_pedido record;
  v_tarefa record;
BEGIN
  IF p_pedido_id IS NULL THEN RETURN; END IF;

  SELECT id, data_assinatura_pdf_final, status_fabrica
    INTO v_pedido
    FROM public.pedidos
   WHERE id = p_pedido_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Condição 1: arquivo enviado em Arquivos do Projeto > Projeto para Produção
  SELECT EXISTS (
    SELECT 1 FROM public.pedido_documentos
     WHERE pedido_id = p_pedido_id
       AND categoria_projeto = 'projeto_para_producao'
  ) INTO v_tem_producao;

  -- Condição 2: PDF Projeto Final assinado pelo cliente
  v_pdf_assinado := v_pedido.data_assinatura_pdf_final IS NOT NULL;
  IF NOT v_pdf_assinado THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.pedido_documentos pd
        JOIN public.tipos_documento td ON td.id = pd.tipo_documento_id
       WHERE pd.pedido_id = p_pedido_id
         AND pd.cliente_assinado_em IS NOT NULL
         AND lower(td.nome) IN ('pdf final','projeto final','pdf projeto final')
    ) INTO v_pdf_assinado;
  END IF;

  IF NOT (v_tem_producao AND v_pdf_assinado) THEN
    -- Sem as duas condições: nada a fazer (mantém tarefa pendente, sem liberar Fábrica)
    RETURN;
  END IF;

  -- Conclui (idempotente) a tarefa "Preparo e envio de PDF Projeto Final"
  FOR v_tarefa IN
    SELECT tp.id, tp.status
      FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE tp.pedido_id = p_pedido_id
       AND m.nome = 'Preparo e envio de PDF Projeto Final'
       AND tp.status NOT IN ('concluida','cancelada')
  LOOP
    UPDATE public.tarefas_pedido
       SET status = 'concluida',
           concluido_em = COALESCE(concluido_em, now()),
           observacao_conclusao = COALESCE(observacao_conclusao,
             'Concluída automaticamente: PDF Projeto Final assinado + arquivo de Projeto para Produção enviado.')
     WHERE id = v_tarefa.id;

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, payload)
    VALUES (v_tarefa.id, 'status',
      jsonb_build_object(
        'de', v_tarefa.status, 'para', 'concluida',
        'automatico', true,
        'origem', 'fluxo_pdf_final_producao_fabrica'
      ));
  END LOOP;

  -- Libera para a Fábrica: status_fabrica = 'liberado_para_lote' (idempotente)
  IF v_pedido.status_fabrica IS DISTINCT FROM 'liberado_para_lote'
     AND COALESCE(v_pedido.status_fabrica,'') NOT IN ('em_lote','concluido') THEN
    UPDATE public.pedidos
       SET status_fabrica = 'liberado_para_lote'
     WHERE id = p_pedido_id;
  END IF;

  -- Cria a tarefa Implantação Fábrica (idempotente via fn_instanciar_tarefas_nativas)
  PERFORM public.fn_instanciar_tarefas_nativas(p_pedido_id, 'pdf_projeto_final_assinado');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ensure_fluxo_projeto_final_producao_e_fabrica falhou: %', SQLERRM;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ensure_fluxo_projeto_final_producao_e_fabrica(uuid) TO authenticated, service_role;

-- 4) Ajusta fn_pdf_final_assinado_pelo_cliente: só registra data e delega ao fluxo gated
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
  IF v_tipo_nome IS NULL OR v_tipo_nome NOT IN ('pdf final','projeto final','pdf projeto final') THEN
    RETURN NEW;
  END IF;

  UPDATE public.pedidos
     SET data_assinatura_pdf_final = COALESCE(data_assinatura_pdf_final, (NEW.cliente_assinado_em AT TIME ZONE 'America/Sao_Paulo')::date)
   WHERE id = NEW.pedido_id;

  -- Conclusão da tarefa + criação da Implantação Fábrica agora dependem
  -- também do upload em Projeto para Produção (regra unificada).
  PERFORM public.ensure_fluxo_projeto_final_producao_e_fabrica(NEW.pedido_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_pdf_final_assinado_pelo_cliente falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 5) Trigger: ao subir arquivo de Projeto para Produção, dispara o fluxo gated
CREATE OR REPLACE FUNCTION public.fn_projeto_para_producao_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.categoria_projeto = 'projeto_para_producao' THEN
    PERFORM public.ensure_fluxo_projeto_final_producao_e_fabrica(NEW.pedido_id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_projeto_para_producao_upload falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_projeto_para_producao_upload ON public.pedido_documentos;
CREATE TRIGGER trg_projeto_para_producao_upload
AFTER INSERT ON public.pedido_documentos
FOR EACH ROW
WHEN (NEW.categoria_projeto = 'projeto_para_producao')
EXECUTE FUNCTION public.fn_projeto_para_producao_upload();
