CREATE OR REPLACE FUNCTION public.sync_pedido_para_kanban_card(
  _pedido_id uuid, _pipeline text, _estagio_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_card_id uuid;
  v_current uuid;
BEGIN
  IF _estagio_id IS NULL THEN RETURN; END IF;
  SELECT id, estagio_id INTO v_card_id, v_current
    FROM public.kanban_cards
    WHERE pedido_id = _pedido_id AND pipeline = _pipeline
    LIMIT 1;
  IF v_card_id IS NULL THEN
    INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id, iniciado_em)
      VALUES (_pedido_id, _pipeline, _estagio_id, now());
  ELSIF v_current IS DISTINCT FROM _estagio_id THEN
    UPDATE public.kanban_cards
      SET estagio_id = _estagio_id, iniciado_em = now(), notificacao_atraso_em = NULL
      WHERE id = v_card_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_pedido_sync_kanban_cards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.estagio_pos_venda_id IS DISTINCT FROM OLD.estagio_pos_venda_id THEN
    PERFORM public.sync_pedido_para_kanban_card(NEW.id, 'pos_venda', NEW.estagio_pos_venda_id);
  END IF;
  IF NEW.estagio_revisao_id IS DISTINCT FROM OLD.estagio_revisao_id THEN
    PERFORM public.sync_pedido_para_kanban_card(NEW.id, 'revisao', NEW.estagio_revisao_id);
  END IF;
  IF NEW.estagio_montagem_id IS DISTINCT FROM OLD.estagio_montagem_id THEN
    PERFORM public.sync_pedido_para_kanban_card(NEW.id, 'montagem', NEW.estagio_montagem_id);
  END IF;
  IF NEW.estagio_fabrica_id IS DISTINCT FROM OLD.estagio_fabrica_id THEN
    PERFORM public.sync_pedido_para_kanban_card(NEW.id, 'fabrica', NEW.estagio_fabrica_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pedido_sync_kanban_cards ON public.pedidos;
CREATE TRIGGER trg_pedido_sync_kanban_cards
  AFTER UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_pedido_sync_kanban_cards();

CREATE OR REPLACE FUNCTION public.fn_kanban_card_sync_pedido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_col text;
BEGIN
  IF NEW.pedido_id IS NULL THEN RETURN NEW; END IF;
  v_col := CASE NEW.pipeline
    WHEN 'pos_venda' THEN 'estagio_pos_venda_id'
    WHEN 'revisao'   THEN 'estagio_revisao_id'
    WHEN 'montagem'  THEN 'estagio_montagem_id'
    WHEN 'fabrica'   THEN 'estagio_fabrica_id'
    ELSE NULL
  END;
  IF v_col IS NULL THEN RETURN NEW; END IF;
  EXECUTE format(
    'UPDATE public.pedidos SET %I = $1 WHERE id = $2 AND %I IS DISTINCT FROM $1',
    v_col, v_col
  ) USING NEW.estagio_id, NEW.pedido_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_kanban_card_sync_pedido ON public.kanban_cards;
CREATE TRIGGER trg_kanban_card_sync_pedido
  AFTER INSERT OR UPDATE OF estagio_id ON public.kanban_cards
  FOR EACH ROW EXECUTE FUNCTION public.fn_kanban_card_sync_pedido();

INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id, iniciado_em)
SELECT p.id, 'revisao', p.estagio_revisao_id, now()
FROM public.pedidos p
WHERE p.estagio_revisao_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.pedido_id = p.id AND k.pipeline = 'revisao');

INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id, iniciado_em)
SELECT p.id, 'pos_venda', p.estagio_pos_venda_id, now()
FROM public.pedidos p
WHERE p.estagio_pos_venda_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.pedido_id = p.id AND k.pipeline = 'pos_venda');

INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id, iniciado_em)
SELECT p.id, 'montagem', p.estagio_montagem_id, now()
FROM public.pedidos p
WHERE p.estagio_montagem_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.pedido_id = p.id AND k.pipeline = 'montagem');

INSERT INTO public.kanban_cards (pedido_id, pipeline, estagio_id, iniciado_em)
SELECT p.id, 'fabrica', p.estagio_fabrica_id, now()
FROM public.pedidos p
WHERE p.estagio_fabrica_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.kanban_cards k WHERE k.pedido_id = p.id AND k.pipeline = 'fabrica');

DROP TRIGGER IF EXISTS trg_iniciar_pipeline_op ON public.pedidos;