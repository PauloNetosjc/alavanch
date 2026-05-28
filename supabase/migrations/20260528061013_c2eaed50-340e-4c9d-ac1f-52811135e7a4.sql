
-- =====================================================================
-- Conclusão automática da tarefa "Acompanhar assinatura do contrato"
-- ao assinar (digital ou manual) e integração com Meus Chamados.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_concluir_tarefas_por_assinatura(
  p_pedido_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r RECORD;
BEGIN
  -- Conclui tarefas ainda abertas vinculadas ao modelo
  -- "Acompanhar assinatura do contrato" (id fixo).
  FOR r IN
    SELECT tp.id, tp.status
    FROM public.tarefas_pedido tp
    WHERE tp.pedido_id = p_pedido_id
      AND tp.modelo_id = 'ac0543f1-56a5-4650-8672-97decee93255'
      AND tp.status NOT IN ('concluida','cancelada')
  LOOP
    UPDATE public.tarefas_pedido
    SET status = 'concluida',
        concluido_em = now(),
        observacao_conclusao = COALESCE(observacao_conclusao,
          'Concluída automaticamente pela assinatura do contrato.')
    WHERE id = r.id;

    INSERT INTO public.eventos_tarefa (tarefa_id, tipo, usuario_id, payload)
    VALUES (
      r.id, 'status', NULL,
      jsonb_build_object(
        'de', r.status,
        'para', 'concluida',
        'automatico', true,
        'origem', 'assinatura_contrato'
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_concluir_tarefas_por_assinatura(uuid)
  TO authenticated, service_role;

-- Reescreve o trigger de assinatura para também concluir tarefas
CREATE OR REPLACE FUNCTION public.trg_fn_tarefas_nativas_assinatura()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      IF NEW.pedido_id IS NOT NULL THEN
        PERFORM public.fn_instanciar_tarefas_nativas(NEW.pedido_id, 'contrato_criado');
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.pedido_id IS NOT NULL
         AND NEW.status IS DISTINCT FROM OLD.status
         AND NEW.status IN ('concluido','assinado_manual') THEN
        -- Gatilho de novas tarefas (mantém o fluxo já existente)
        PERFORM public.fn_instanciar_tarefas_nativas(NEW.pedido_id, 'pedido_assinado');
        -- Conclui automaticamente a tarefa de acompanhamento da assinatura
        PERFORM public.fn_concluir_tarefas_por_assinatura(NEW.pedido_id);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'tarefas_nativas assinatura trigger falhou: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
