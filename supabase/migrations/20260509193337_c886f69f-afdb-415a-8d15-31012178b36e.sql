
-- Helper: avalia se a condição da regra é satisfeita
CREATE OR REPLACE FUNCTION public.avaliar_condicao_automacao(
  _regra_id uuid,
  _pedido_id uuid,
  _card_id uuid,
  _contexto jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reg record;
  v_estagio uuid;
  v_match boolean;
BEGIN
  SELECT * INTO reg FROM public.pipeline_automacoes WHERE id = _regra_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF reg.condicao_tipo IS NULL OR reg.condicao_tipo = 'nenhuma' THEN RETURN true; END IF;

  IF reg.condicao_tipo = 'tipo_evento_agenda' THEN
    RETURN lower(coalesce(_contexto->>'tipo_evento','')) = lower(coalesce(reg.condicao_valor,''));
  ELSIF reg.condicao_tipo = 'template_checklist' THEN
    RETURN coalesce(_contexto->>'template_id','') = coalesce(reg.condicao_valor,'');
  ELSIF reg.condicao_tipo = 'item_checklist' THEN
    -- Verifica se item com essa descrição está concluído no estágio atual do card
    SELECT estagio_id INTO v_estagio FROM public.kanban_cards WHERE id = _card_id;
    SELECT EXISTS(
      SELECT 1 FROM public.pedido_estagio_checklist
       WHERE pedido_id = _pedido_id
         AND (estagio_id = v_estagio OR estagio_id IS NULL)
         AND descricao = reg.condicao_valor
         AND concluido = true
    ) INTO v_match;
    RETURN v_match;
  END IF;
  RETURN true;
END;
$$;

-- Atualiza trigger card_chegou para usar o avaliador de condição
CREATE OR REPLACE FUNCTION public.kanban_card_chegou()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reg record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.estagio_id = OLD.estagio_id THEN
    RETURN NEW;
  END IF;
  FOR reg IN
    SELECT * FROM public.pipeline_automacoes
     WHERE ativo = true AND evento = 'card_chegou'
       AND estagio_origem_id = NEW.estagio_id
     ORDER BY ordem
  LOOP
    IF public.avaliar_condicao_automacao(reg.id, NEW.pedido_id, NEW.id, '{}'::jsonb) THEN
      PERFORM public.executar_automacao_acao(reg.id, NEW.pedido_id, NEW.id, 'card_chegou', '{}'::jsonb);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Trigger: quando um item do checklist do pedido é concluído, dispara avaliação de regras
CREATE OR REPLACE FUNCTION public.checklist_item_disparar_automacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reg record;
  card_rec record;
  ctx jsonb;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF OLD.concluido = NEW.concluido THEN RETURN NEW; END IF;
  IF NEW.concluido <> true THEN RETURN NEW; END IF;

  ctx := jsonb_build_object('item_descricao', NEW.descricao, 'estagio_id', NEW.estagio_id);

  -- Localiza card(s) deste pedido nesse estágio (ou em qualquer estágio se item não tem estágio)
  FOR card_rec IN
    SELECT * FROM public.kanban_cards
     WHERE pedido_id = NEW.pedido_id
       AND (NEW.estagio_id IS NULL OR estagio_id = NEW.estagio_id)
  LOOP
    FOR reg IN
      SELECT * FROM public.pipeline_automacoes
       WHERE ativo = true
         AND evento IN ('checklist_item_marcado','checklist_concluido','card_chegou')
         AND estagio_origem_id = card_rec.estagio_id
       ORDER BY ordem
    LOOP
      IF public.avaliar_condicao_automacao(reg.id, NEW.pedido_id, card_rec.id, ctx) THEN
        PERFORM public.executar_automacao_acao(reg.id, NEW.pedido_id, card_rec.id, 'checklist_item_marcado', ctx);
      END IF;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_item_disparar ON public.pedido_estagio_checklist;
CREATE TRIGGER trg_checklist_item_disparar
AFTER UPDATE OF concluido ON public.pedido_estagio_checklist
FOR EACH ROW EXECUTE FUNCTION public.checklist_item_disparar_automacao();
