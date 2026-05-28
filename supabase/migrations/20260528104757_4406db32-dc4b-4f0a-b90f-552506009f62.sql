
-- 1) Corrige ensure_fluxo_projeto_final_producao_e_fabrica
--    (a versão anterior referenciava pedido_documentos.tipo_documento_id, que não existe)
CREATE OR REPLACE FUNCTION public.ensure_fluxo_projeto_final_producao_e_fabrica(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tem_producao boolean;
  v_pdf_assinado boolean;
  v_cliente_assinado_em timestamptz;
  v_pedido record;
  v_tarefa record;
BEGIN
  IF p_pedido_id IS NULL THEN RETURN; END IF;

  SELECT id, data_assinatura_pdf_final, status_fabrica
    INTO v_pedido
    FROM public.pedidos
   WHERE id = p_pedido_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Condição 1: arquivo ativo em Arquivos do Projeto > Projeto para Produção
  SELECT EXISTS (
    SELECT 1 FROM public.pedido_documentos
     WHERE pedido_id = p_pedido_id
       AND categoria_projeto = 'projeto_para_producao'
       AND COALESCE(ativo, true) = true
  ) INTO v_tem_producao;

  -- Condição 2: PDF Projeto Final assinado pelo cliente
  -- (a) já marcado no pedido, ou (b) existe solicitação concluída do tipo "PDF final"
  v_pdf_assinado := v_pedido.data_assinatura_pdf_final IS NOT NULL;

  IF NOT v_pdf_assinado THEN
    SELECT sa.cliente_assinado_em
      INTO v_cliente_assinado_em
      FROM public.solicitacoes_assinatura sa
      JOIN public.tipos_documento td ON td.id = sa.tipo_documento_id
     WHERE sa.pedido_id = p_pedido_id
       AND sa.cliente_assinado_em IS NOT NULL
       AND sa.cancelado_em IS NULL
       AND lower(td.nome) IN ('pdf final','projeto final','pdf projeto final')
     ORDER BY sa.cliente_assinado_em DESC
     LIMIT 1;

    IF v_cliente_assinado_em IS NOT NULL THEN
      v_pdf_assinado := true;
      -- Garante o registro da data no pedido
      UPDATE public.pedidos
         SET data_assinatura_pdf_final = COALESCE(
               data_assinatura_pdf_final,
               (v_cliente_assinado_em AT TIME ZONE 'America/Sao_Paulo')::date
             )
       WHERE id = p_pedido_id;
    END IF;
  END IF;

  IF NOT (v_tem_producao AND v_pdf_assinado) THEN
    RETURN;
  END IF;

  -- Conclui (idempotente) a tarefa "Preparo e envio de PDF Projeto Final"
  FOR v_tarefa IN
    SELECT tp.id, tp.status
      FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE tp.pedido_id = p_pedido_id
       AND (m.nome = 'Preparo e envio de PDF Projeto Final'
            OR m.chave = 'preparo_envio_pdf_projeto_final')
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

  -- Libera Fábrica (idempotente)
  IF COALESCE(v_pedido.status_fabrica,'') NOT IN ('liberado_para_lote','em_lote','concluido') THEN
    UPDATE public.pedidos
       SET status_fabrica = 'liberado_para_lote'
     WHERE id = p_pedido_id;
  END IF;

  -- Cria tarefa Implantação Fábrica (idempotente)
  BEGIN
    PERFORM public.fn_instanciar_tarefas_nativas(p_pedido_id, 'pdf_projeto_final_assinado');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_instanciar_tarefas_nativas (pdf_projeto_final_assinado) falhou: %', SQLERRM;
  END;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ensure_fluxo_projeto_final_producao_e_fabrica falhou: %', SQLERRM;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ensure_fluxo_projeto_final_producao_e_fabrica(uuid) TO authenticated, service_role;


-- 2) Deduplicação da pasta "Projeto Final" da Central de Documentos
--    (a pasta é identificada por nome — não há tipo_documento_id em pedido_documentos)
CREATE OR REPLACE FUNCTION public.fn_dedupe_projeto_final(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_keep uuid;
BEGIN
  IF p_pedido_id IS NULL THEN RETURN; END IF;

  -- Escolhe o doc a manter ativo:
  -- 1º preferência: assinado mais recente; 2ª: criado mais recente
  SELECT pd.id
    INTO v_keep
    FROM public.pedido_documentos pd
    JOIN public.pedido_pastas pp ON pp.id = pd.pasta_id
   WHERE pd.pedido_id = p_pedido_id
     AND lower(pp.nome) = 'projeto final'
   ORDER BY (pd.assinado_em IS NOT NULL) DESC,
            COALESCE(pd.assinado_em, pd.created_at) DESC,
            pd.created_at DESC
   LIMIT 1;

  IF v_keep IS NULL THEN RETURN; END IF;

  -- Inativa todos os demais (preserva histórico, hashes, evidências, participantes)
  UPDATE public.pedido_documentos pd
     SET ativo = false
    FROM public.pedido_pastas pp
   WHERE pd.pasta_id = pp.id
     AND pd.pedido_id = p_pedido_id
     AND lower(pp.nome) = 'projeto final'
     AND pd.id <> v_keep
     AND COALESCE(pd.ativo, true) = true;

  -- Garante que o escolhido está ativo
  UPDATE public.pedido_documentos
     SET ativo = true
   WHERE id = v_keep
     AND COALESCE(ativo, true) = false;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_dedupe_projeto_final falhou: %', SQLERRM;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_dedupe_projeto_final(uuid) TO authenticated, service_role;


-- 3) Trigger: ao inserir/atualizar documento na pasta "Projeto Final", deduplica
--    e tenta liberar Fábrica
CREATE OR REPLACE FUNCTION public.fn_projeto_final_doc_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pasta_nome text;
BEGIN
  SELECT lower(nome) INTO v_pasta_nome FROM public.pedido_pastas WHERE id = NEW.pasta_id;
  IF v_pasta_nome = 'projeto final' THEN
    PERFORM public.fn_dedupe_projeto_final(NEW.pedido_id);
    PERFORM public.ensure_fluxo_projeto_final_producao_e_fabrica(NEW.pedido_id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_projeto_final_doc_after_change falhou: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_projeto_final_doc_after_insert ON public.pedido_documentos;
CREATE TRIGGER trg_projeto_final_doc_after_insert
AFTER INSERT ON public.pedido_documentos
FOR EACH ROW
EXECUTE FUNCTION public.fn_projeto_final_doc_after_change();

DROP TRIGGER IF EXISTS trg_projeto_final_doc_after_update ON public.pedido_documentos;
CREATE TRIGGER trg_projeto_final_doc_after_update
AFTER UPDATE OF assinado_em, pasta_id ON public.pedido_documentos
FOR EACH ROW
EXECUTE FUNCTION public.fn_projeto_final_doc_after_change();


-- 4) Backfill: deduplica Projeto Final em todos os pedidos que tenham mais de um ativo
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT pd.pedido_id
      FROM public.pedido_documentos pd
      JOIN public.pedido_pastas pp ON pp.id = pd.pasta_id
     WHERE lower(pp.nome) = 'projeto final'
       AND COALESCE(pd.ativo, true) = true
     GROUP BY pd.pedido_id
    HAVING count(*) > 1
  LOOP
    PERFORM public.fn_dedupe_projeto_final(r.pedido_id);
  END LOOP;
END $$;


-- 5) Re-roda o fluxo gated para todos os pedidos que já têm Projeto para Produção
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT pedido_id
      FROM public.pedido_documentos
     WHERE categoria_projeto = 'projeto_para_producao'
       AND COALESCE(ativo, true) = true
  LOOP
    PERFORM public.ensure_fluxo_projeto_final_producao_e_fabrica(r.pedido_id);
  END LOOP;
END $$;
