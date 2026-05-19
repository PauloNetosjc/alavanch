
-- Trigger: quando um pedido tem evento de medição técnica E revisão final agendados,
-- mover automaticamente seu card do Kanban Revisão para "1 - Preparo PJ Final (Conferente)".
CREATE OR REPLACE FUNCTION public.fn_avancar_revisao_para_preparo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pedido_id uuid;
  v_tem_medicao boolean;
  v_tem_revisao boolean;
  v_estagio_preparo_id uuid;
  v_estagio_atual_ordem int;
BEGIN
  v_pedido_id := COALESCE(NEW.pedido_id, OLD.pedido_id);
  IF v_pedido_id IS NULL THEN RETURN NEW; END IF;

  SELECT EXISTS(SELECT 1 FROM agenda_eventos WHERE pedido_id = v_pedido_id AND tipo='medicao_tecnica' AND COALESCE(cancelado,false)=false)
    INTO v_tem_medicao;
  SELECT EXISTS(SELECT 1 FROM agenda_eventos WHERE pedido_id = v_pedido_id AND tipo='revisao_final' AND COALESCE(cancelado,false)=false)
    INTO v_tem_revisao;

  IF v_tem_medicao AND v_tem_revisao THEN
    SELECT id INTO v_estagio_preparo_id FROM pipeline_estagios
      WHERE pipeline='revisao' AND ordem=3 AND ativo=true LIMIT 1;
    IF v_estagio_preparo_id IS NULL THEN RETURN NEW; END IF;

    SELECT pe.ordem INTO v_estagio_atual_ordem
      FROM pedidos p LEFT JOIN pipeline_estagios pe ON pe.id = p.estagio_revisao_id
      WHERE p.id = v_pedido_id;

    IF v_estagio_atual_ordem IS NULL OR v_estagio_atual_ordem < 3 THEN
      UPDATE pedidos SET estagio_revisao_id = v_estagio_preparo_id WHERE id = v_pedido_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_avancar_revisao_preparo ON public.agenda_eventos;
CREATE TRIGGER trg_avancar_revisao_preparo
AFTER INSERT OR UPDATE ON public.agenda_eventos
FOR EACH ROW EXECUTE FUNCTION public.fn_avancar_revisao_para_preparo();

-- Tolera bases sem coluna 'cancelado'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agenda_eventos' AND column_name='cancelado') THEN
    CREATE OR REPLACE FUNCTION public.fn_avancar_revisao_para_preparo()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
    DECLARE
      v_pedido_id uuid; v_tem_medicao boolean; v_tem_revisao boolean;
      v_estagio_preparo_id uuid; v_estagio_atual_ordem int;
    BEGIN
      v_pedido_id := COALESCE(NEW.pedido_id, OLD.pedido_id);
      IF v_pedido_id IS NULL THEN RETURN NEW; END IF;
      SELECT EXISTS(SELECT 1 FROM agenda_eventos WHERE pedido_id=v_pedido_id AND tipo='medicao_tecnica') INTO v_tem_medicao;
      SELECT EXISTS(SELECT 1 FROM agenda_eventos WHERE pedido_id=v_pedido_id AND tipo='revisao_final') INTO v_tem_revisao;
      IF v_tem_medicao AND v_tem_revisao THEN
        SELECT id INTO v_estagio_preparo_id FROM pipeline_estagios
          WHERE pipeline='revisao' AND ordem=3 AND ativo=true LIMIT 1;
        IF v_estagio_preparo_id IS NULL THEN RETURN NEW; END IF;
        SELECT pe.ordem INTO v_estagio_atual_ordem
          FROM pedidos p LEFT JOIN pipeline_estagios pe ON pe.id=p.estagio_revisao_id
          WHERE p.id=v_pedido_id;
        IF v_estagio_atual_ordem IS NULL OR v_estagio_atual_ordem < 3 THEN
          UPDATE pedidos SET estagio_revisao_id=v_estagio_preparo_id WHERE id=v_pedido_id;
        END IF;
      END IF;
      RETURN NEW;
    END $f$;
  END IF;
END $$;
