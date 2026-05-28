
-- Atualiza atualizar_etapa_atual_pedido para alinhar com etapas do Workflow Operacional.
-- - 'concluido' (em vez de 'finalizado')
-- - 'vistoria_finalizacao' (em vez de 'vistoria')
-- - 'fabrica_lote' (unifica liberado_para_lote e em_producao)
-- - 'venda_futura' quando Projeto Inicial concluido e SEM medição agendada
-- - 'contrato_nao_assinado' como fallback explícito quando contrato não foi assinado
-- - Nenhum pedido com contrato assinado pode ficar com etapa_atual nula

CREATE OR REPLACE FUNCTION public.atualizar_etapa_atual_pedido(p_pedido_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pedido record;
  v_etapa text;
  v_has_doc_vendido boolean;
  v_has_doc_revisado boolean;
  v_has_doc_producao boolean;
  v_pdf_assinado boolean;
  v_contrato_assinado boolean;
  v_projeto_inicial_concluido boolean;
  v_tem_medicao_agendada boolean;
BEGIN
  IF p_pedido_id IS NULL THEN RETURN NULL; END IF;

  SELECT id, status, status_fabrica, orcamento_id,
         data_assinatura_pdf_final, data_envio_fabrica,
         data_entrega, data_montagem, data_vistoria,
         data_medicao_tecnica
    INTO v_pedido
    FROM public.pedidos
   WHERE id = p_pedido_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF lower(coalesce(v_pedido.status,'')) = 'cancelado' THEN
    UPDATE public.pedidos SET etapa_atual = NULL WHERE id = p_pedido_id;
    RETURN NULL;
  END IF;
  IF lower(coalesce(v_pedido.status,'')) = 'concluido' THEN
    v_etapa := 'concluido';
    UPDATE public.pedidos SET etapa_atual = v_etapa WHERE id = p_pedido_id AND coalesce(etapa_atual,'') IS DISTINCT FROM v_etapa;
    RETURN v_etapa;
  END IF;

  v_pdf_assinado := v_pedido.data_assinatura_pdf_final IS NOT NULL;

  SELECT EXISTS(
    SELECT 1 FROM public.contratos c
     WHERE c.orcamento_id = v_pedido.orcamento_id
       AND c.assinado_em IS NOT NULL
       AND c.status NOT IN ('cancelado','recusado','expirado')
  ) INTO v_contrato_assinado;

  SELECT EXISTS(SELECT 1 FROM public.pedido_documentos WHERE pedido_id=p_pedido_id AND categoria_projeto='projeto_vendido' AND coalesce(ativo,true)) INTO v_has_doc_vendido;
  SELECT EXISTS(SELECT 1 FROM public.pedido_documentos WHERE pedido_id=p_pedido_id AND categoria_projeto='projeto_revisado' AND coalesce(ativo,true)) INTO v_has_doc_revisado;
  SELECT EXISTS(SELECT 1 FROM public.pedido_documentos WHERE pedido_id=p_pedido_id AND categoria_projeto='projeto_para_producao' AND coalesce(ativo,true)) INTO v_has_doc_producao;

  -- Projeto inicial concluído? Tarefa "Enviar projeto inicial para o cliente" finalizada
  SELECT EXISTS (
    SELECT 1 FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE tp.pedido_id = p_pedido_id
       AND tp.status = 'concluida'
       AND m.nome = 'Enviar projeto inicial para o cliente'
  ) INTO v_projeto_inicial_concluido;

  -- Medição técnica agendada (data_medicao_tecnica preenchida OU tarefa pendente)
  v_tem_medicao_agendada := v_pedido.data_medicao_tecnica IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.tarefas_pedido tp
      JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
     WHERE tp.pedido_id = p_pedido_id
       AND tp.status NOT IN ('concluida','cancelada')
       AND m.nome = 'Fazer medição técnica'
  );

  v_etapa := NULL;

  IF v_pedido.data_vistoria IS NOT NULL THEN v_etapa := 'vistoria_finalizacao';
  ELSIF v_pedido.data_montagem IS NOT NULL THEN v_etapa := 'montagem';
  ELSIF v_pedido.data_entrega IS NOT NULL THEN v_etapa := 'entrega';
  ELSIF v_pedido.data_envio_fabrica IS NOT NULL
        OR v_pedido.status_fabrica IN ('liberado_para_lote','em_lote','em_producao')
        OR (v_has_doc_producao AND v_pdf_assinado) THEN
    v_etapa := 'fabrica_lote';
  ELSIF EXISTS (
      SELECT 1 FROM public.tarefas_pedido tp
        JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
       WHERE tp.pedido_id = p_pedido_id
         AND tp.status NOT IN ('concluida','cancelada')
         AND m.nome = 'Preparo e envio de PDF Projeto Final'
    ) THEN v_etapa := 'pdf_projeto_final';
  ELSIF v_has_doc_producao THEN v_etapa := 'pdf_projeto_final';
  ELSIF v_has_doc_revisado THEN v_etapa := 'pdf_projeto_final';
  ELSIF EXISTS (
      SELECT 1 FROM public.tarefas_pedido tp
        JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
       WHERE tp.pedido_id = p_pedido_id
         AND tp.status NOT IN ('concluida','cancelada')
         AND m.nome = 'Revisão loja'
    ) THEN v_etapa := 'revisao_loja';
  ELSIF EXISTS (
      SELECT 1 FROM public.tarefas_pedido tp
        JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
       WHERE tp.pedido_id = p_pedido_id
         AND tp.status NOT IN ('concluida','cancelada')
         AND m.nome = 'Preparo projeto revisão'
    ) THEN v_etapa := 'preparo_projeto_revisao';
  ELSIF v_tem_medicao_agendada THEN v_etapa := 'medicao_tecnica';
  ELSIF v_projeto_inicial_concluido AND NOT v_tem_medicao_agendada THEN
    v_etapa := 'venda_futura';
  ELSIF v_has_doc_vendido THEN v_etapa := 'projeto_inicial';
  ELSIF EXISTS (
      SELECT 1 FROM public.tarefas_pedido tp
        JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
       WHERE tp.pedido_id = p_pedido_id
         AND tp.status NOT IN ('concluida','cancelada')
         AND m.nome IN ('Subir arquivo 3D vendido','Enviar projeto inicial para o cliente')
    ) THEN v_etapa := 'projeto_inicial';
  ELSIF v_contrato_assinado THEN
    v_etapa := 'contrato_assinado';
  ELSE
    v_etapa := 'contrato_nao_assinado';
  END IF;

  UPDATE public.pedidos SET etapa_atual = v_etapa WHERE id = p_pedido_id AND coalesce(etapa_atual,'') IS DISTINCT FROM v_etapa;
  RETURN v_etapa;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'atualizar_etapa_atual_pedido(%): %', p_pedido_id, SQLERRM;
  RETURN NULL;
END;
$$;

-- Trigger: recalcular etapa quando contrato muda (assinatura)
CREATE OR REPLACE FUNCTION public.trg_contrato_recalc_etapa_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r record;
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.assinado_em IS DISTINCT FROM OLD.assinado_em) OR (NEW.status IS DISTINCT FROM OLD.status) THEN
    FOR r IN SELECT id FROM public.pedidos WHERE orcamento_id = NEW.orcamento_id LOOP
      PERFORM public.atualizar_etapa_atual_pedido(r.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrato_recalc_etapa ON public.contratos;
CREATE TRIGGER trg_contrato_recalc_etapa
AFTER INSERT OR UPDATE OF status, assinado_em ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.trg_contrato_recalc_etapa_fn();

-- Backfill geral
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.pedidos LOOP
    PERFORM public.atualizar_etapa_atual_pedido(r.id);
  END LOOP;
END $$;
