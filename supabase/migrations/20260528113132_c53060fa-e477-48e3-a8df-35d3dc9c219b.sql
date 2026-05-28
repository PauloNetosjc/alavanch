
-- 1) Coluna etapa_atual
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS etapa_atual text;

CREATE INDEX IF NOT EXISTS idx_pedidos_etapa_atual ON public.pedidos(etapa_atual);

-- 2) Função: atualizar_etapa_atual_pedido
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
  v_tem_tarefa_pendente boolean;
  v_pdf_assinado boolean;
BEGIN
  IF p_pedido_id IS NULL THEN RETURN NULL; END IF;

  SELECT id, status, status_fabrica,
         data_assinatura_pdf_final, data_envio_fabrica,
         data_entrega, data_montagem, data_vistoria,
         data_medicao_tecnica
    INTO v_pedido
    FROM public.pedidos
   WHERE id = p_pedido_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF lower(coalesce(v_pedido.status,'')) IN ('cancelado') THEN
    UPDATE public.pedidos SET etapa_atual = NULL WHERE id = p_pedido_id;
    RETURN NULL;
  END IF;
  IF lower(coalesce(v_pedido.status,'')) = 'concluido' THEN
    v_etapa := 'finalizado';
    UPDATE public.pedidos SET etapa_atual = v_etapa WHERE id = p_pedido_id;
    RETURN v_etapa;
  END IF;

  v_pdf_assinado := v_pedido.data_assinatura_pdf_final IS NOT NULL;

  SELECT EXISTS(SELECT 1 FROM public.pedido_documentos WHERE pedido_id=p_pedido_id AND categoria_projeto='projeto_vendido' AND coalesce(ativo,true)) INTO v_has_doc_vendido;
  SELECT EXISTS(SELECT 1 FROM public.pedido_documentos WHERE pedido_id=p_pedido_id AND categoria_projeto='projeto_revisado' AND coalesce(ativo,true)) INTO v_has_doc_revisado;
  SELECT EXISTS(SELECT 1 FROM public.pedido_documentos WHERE pedido_id=p_pedido_id AND categoria_projeto='projeto_para_producao' AND coalesce(ativo,true)) INTO v_has_doc_producao;

  -- Avalia de baixo (mais avançado) para cima (mais inicial)
  v_etapa := NULL;

  IF v_pedido.data_vistoria IS NOT NULL THEN v_etapa := 'vistoria';
  ELSIF v_pedido.data_montagem IS NOT NULL THEN v_etapa := 'montagem';
  ELSIF v_pedido.data_entrega IS NOT NULL THEN v_etapa := 'entrega';
  ELSIF v_pedido.data_envio_fabrica IS NOT NULL THEN v_etapa := 'fabrica_em_producao';
  ELSIF v_pedido.status_fabrica = 'liberado_para_lote'
        OR (v_has_doc_producao AND v_pdf_assinado) THEN
    v_etapa := 'fabrica_liberado_para_lote';
  ELSIF EXISTS (
      SELECT 1 FROM public.tarefas_pedido tp
        JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
       WHERE tp.pedido_id = p_pedido_id
         AND tp.status NOT IN ('concluida','cancelada')
         AND m.nome = 'Preparo e envio de PDF Projeto Final'
    ) THEN v_etapa := 'pdf_projeto_final';
  ELSIF v_has_doc_producao THEN v_etapa := 'projeto_para_producao';
  ELSIF v_has_doc_revisado THEN v_etapa := 'projeto_revisado';
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
  ELSIF EXISTS (
      SELECT 1 FROM public.tarefas_pedido tp
        JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
       WHERE tp.pedido_id = p_pedido_id
         AND tp.status NOT IN ('concluida','cancelada')
         AND m.nome = 'Fazer medição técnica'
    ) OR v_pedido.data_medicao_tecnica IS NOT NULL THEN v_etapa := 'medicao_tecnica';
  ELSIF v_has_doc_vendido THEN v_etapa := 'projeto_vendido';
  ELSIF EXISTS (
      SELECT 1 FROM public.tarefas_pedido tp
        JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
       WHERE tp.pedido_id = p_pedido_id
         AND tp.status NOT IN ('concluida','cancelada')
         AND m.nome IN ('Subir arquivo 3D vendido')
    ) THEN v_etapa := 'projeto_vendido';
  ELSIF EXISTS (
      SELECT 1 FROM public.tarefas_pedido tp
        JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
       WHERE tp.pedido_id = p_pedido_id
         AND tp.status NOT IN ('concluida','cancelada')
         AND m.nome = 'Enviar projeto inicial para o cliente'
    ) THEN v_etapa := 'projeto_inicial';
  ELSE v_etapa := 'contrato_assinado';
  END IF;

  UPDATE public.pedidos SET etapa_atual = v_etapa WHERE id = p_pedido_id AND coalesce(etapa_atual,'') IS DISTINCT FROM v_etapa;
  RETURN v_etapa;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'atualizar_etapa_atual_pedido(%): %', p_pedido_id, SQLERRM;
  RETURN NULL;
END;
$$;

-- 3) Função: liberar_pedido_para_fabrica
CREATE OR REPLACE FUNCTION public.liberar_pedido_para_fabrica(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_pedido_id IS NULL THEN RETURN; END IF;

  SELECT status_fabrica INTO v_status FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF coalesce(v_status,'') NOT IN ('liberado_para_lote','em_lote','concluido') THEN
    UPDATE public.pedidos
       SET status_fabrica = 'liberado_para_lote'
     WHERE id = p_pedido_id;
  END IF;

  -- Garante tarefa Implantação Fábrica (idempotente)
  BEGIN
    PERFORM public.fn_instanciar_tarefas_nativas(p_pedido_id, 'pdf_projeto_final_assinado');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_instanciar_tarefas_nativas (pdf_projeto_final_assinado) falhou: %', SQLERRM;
  END;

  -- Atualiza etapa atual
  PERFORM public.atualizar_etapa_atual_pedido(p_pedido_id);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'liberar_pedido_para_fabrica(%): %', p_pedido_id, SQLERRM;
END;
$$;

-- 4) Trigger: ao concluir tarefa preparo_envio_pdf_projeto_final, libera fábrica
CREATE OR REPLACE FUNCTION public.trg_tarefa_pdf_final_concluida_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nome text;
BEGIN
  IF NEW.status = 'concluida' AND coalesce(OLD.status,'') <> 'concluida' THEN
    SELECT nome INTO v_nome FROM public.tarefas_nativas_modelos WHERE id = NEW.modelo_id;
    IF v_nome = 'Preparo e envio de PDF Projeto Final' THEN
      PERFORM public.liberar_pedido_para_fabrica(NEW.pedido_id);
    END IF;
  END IF;
  -- Sempre recalcula etapa atual ao mudar status da tarefa
  IF (TG_OP = 'INSERT') OR (NEW.status IS DISTINCT FROM OLD.status) THEN
    PERFORM public.atualizar_etapa_atual_pedido(NEW.pedido_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarefa_pdf_final_concluida ON public.tarefas_pedido;
CREATE TRIGGER trg_tarefa_pdf_final_concluida
AFTER INSERT OR UPDATE OF status ON public.tarefas_pedido
FOR EACH ROW EXECUTE FUNCTION public.trg_tarefa_pdf_final_concluida_fn();

-- 5) Trigger: documento de projeto inserido/atualizado
CREATE OR REPLACE FUNCTION public.trg_pedido_doc_etapa_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pid uuid;
BEGIN
  v_pid := COALESCE(NEW.pedido_id, OLD.pedido_id);
  IF v_pid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Se entrou arquivo projeto_para_producao ativo, tenta liberar fábrica via fluxo PDF
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.categoria_projeto = 'projeto_para_producao' AND COALESCE(NEW.ativo,true) THEN
    BEGIN
      PERFORM public.ensure_fluxo_projeto_final_producao_e_fabrica(v_pid);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  PERFORM public.atualizar_etapa_atual_pedido(v_pid);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_doc_etapa ON public.pedido_documentos;
CREATE TRIGGER trg_pedido_doc_etapa
AFTER INSERT OR UPDATE ON public.pedido_documentos
FOR EACH ROW EXECUTE FUNCTION public.trg_pedido_doc_etapa_fn();

-- 6) Trigger: mudanças em pedidos que afetam etapa
CREATE OR REPLACE FUNCTION public.trg_pedido_etapa_recalc_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status_fabrica IS DISTINCT FROM OLD.status_fabrica
     OR NEW.data_envio_fabrica IS DISTINCT FROM OLD.data_envio_fabrica
     OR NEW.data_entrega IS DISTINCT FROM OLD.data_entrega
     OR NEW.data_montagem IS DISTINCT FROM OLD.data_montagem
     OR NEW.data_vistoria IS DISTINCT FROM OLD.data_vistoria
     OR NEW.data_assinatura_pdf_final IS DISTINCT FROM OLD.data_assinatura_pdf_final
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.atualizar_etapa_atual_pedido(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_etapa_recalc ON public.pedidos;
CREATE TRIGGER trg_pedido_etapa_recalc
AFTER UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.trg_pedido_etapa_recalc_fn();

-- 7) Backfill: liberar fábrica para pedidos que já cumprem as condições
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id
      FROM public.pedidos p
     WHERE coalesce(p.status,'') NOT IN ('cancelado','concluido')
       AND (
         -- Caso 1: tarefa pdf final já concluída
         EXISTS (
           SELECT 1 FROM public.tarefas_pedido tp
             JOIN public.tarefas_nativas_modelos m ON m.id = tp.modelo_id
            WHERE tp.pedido_id = p.id
              AND tp.status = 'concluida'
              AND m.nome = 'Preparo e envio de PDF Projeto Final'
         )
         AND EXISTS (
           SELECT 1 FROM public.pedido_documentos pd
            WHERE pd.pedido_id = p.id
              AND pd.categoria_projeto = 'projeto_para_producao'
              AND coalesce(pd.ativo,true)
         )
       )
  LOOP
    PERFORM public.liberar_pedido_para_fabrica(r.id);
  END LOOP;
END $$;

-- 8) Backfill: etapa_atual para todos os pedidos
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.pedidos LOOP
    PERFORM public.atualizar_etapa_atual_pedido(r.id);
  END LOOP;
END $$;
