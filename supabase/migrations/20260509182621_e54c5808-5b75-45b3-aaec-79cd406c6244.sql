
-- Helper: subtrai N dias úteis
CREATE OR REPLACE FUNCTION public.sub_dias_uteis(_fim date, _n integer, _loja uuid)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d date := _fim; contados int := 0;
BEGIN
  IF _n <= 0 THEN RETURN _fim; END IF;
  WHILE contados < _n LOOP
    d := d - 1;
    IF public.is_dia_util(d, _loja) THEN contados := contados + 1; END IF;
  END LOOP;
  RETURN d;
END $$;

-- Trigger: define prazo automático ao entrar em estágios do pipeline Revisão
CREATE OR REPLACE FUNCTION public.kanban_revisao_set_prazo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  est_nome text;
  loja uuid;
  sla int := 0;
  base_inicio date := CURRENT_DATE;
BEGIN
  IF NEW.pipeline <> 'revisao' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.estagio_id = OLD.estagio_id THEN RETURN NEW; END IF;

  SELECT lower(nome) INTO est_nome FROM public.pipeline_estagios WHERE id = NEW.estagio_id;
  SELECT loja_id INTO loja FROM public.pedidos WHERE id = NEW.pedido_id;

  -- "Preparo PJ Final" tem prazo definido externamente (a partir da data de revisão final)
  IF est_nome LIKE '%preparo pj final%' THEN RETURN NEW; END IF;

  IF est_nome LIKE '%análise revisão%' OR est_nome LIKE '%analise revisao%' THEN
    sla := 2; base_inicio := COALESCE(NEW.created_at::date, CURRENT_DATE);
  ELSIF est_nome LIKE '%venda entrega futura%' THEN
    sla := 0;  -- sem prazo fixo
  ELSIF est_nome LIKE '%revisão loja%' OR est_nome LIKE '%revisao loja%' THEN
    sla := 15;
  ELSIF est_nome LIKE '%preparo pdf final%' THEN
    sla := 7;
  ELSIF est_nome LIKE '%assinatura pdf final%' THEN
    sla := 7;
  ELSIF est_nome LIKE '%envio fábrica%' OR est_nome LIKE '%envio fabrica%' THEN
    sla := 7;
  END IF;

  IF sla > 0 THEN
    NEW.prazo := public.add_dias_uteis(base_inicio, sla, loja);
    NEW.sla_dias_uteis := sla;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_kanban_revisao_set_prazo ON public.kanban_cards;
CREATE TRIGGER trg_kanban_revisao_set_prazo
BEFORE INSERT OR UPDATE OF estagio_id ON public.kanban_cards
FOR EACH ROW EXECUTE FUNCTION public.kanban_revisao_set_prazo();

-- Função chamada pela agenda quando uma medição técnica + revisão final são agendadas
CREATE OR REPLACE FUNCTION public.revisao_avancar_preparo_pj_final(_pedido_id uuid, _revisao_data date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  card_rec record;
  preparo_id uuid;
  loja uuid;
  novo_prazo date;
  est_origem_nome text;
BEGIN
  SELECT id INTO preparo_id FROM public.pipeline_estagios
   WHERE pipeline = 'revisao' AND ativo = true
     AND lower(nome) LIKE '%preparo pj final%' ORDER BY ordem LIMIT 1;
  IF preparo_id IS NULL THEN RETURN; END IF;

  SELECT loja_id INTO loja FROM public.pedidos WHERE id = _pedido_id;

  SELECT kc.* INTO card_rec
    FROM public.kanban_cards kc
    JOIN public.pipeline_estagios pe ON pe.id = kc.estagio_id
   WHERE kc.pipeline = 'revisao' AND kc.pedido_id = _pedido_id
     AND (lower(pe.nome) LIKE '%análise revisão%'
       OR lower(pe.nome) LIKE '%analise revisao%'
       OR lower(pe.nome) LIKE '%venda entrega futura%')
   LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  novo_prazo := public.sub_dias_uteis(_revisao_data, 7, loja);

  SELECT nome INTO est_origem_nome FROM public.pipeline_estagios WHERE id = card_rec.estagio_id;

  UPDATE public.kanban_cards
     SET estagio_id = preparo_id,
         prazo = novo_prazo,
         sla_dias_uteis = 7,
         iniciado_em = now(),
         notificacao_atraso_em = NULL,
         updated_at = now()
   WHERE id = card_rec.id;

  INSERT INTO public.timeline_eventos (entidade_tipo, entidade_id, tipo, descricao, metadata)
  VALUES ('pedido', _pedido_id, 'kanban_movimento',
    format('[revisao] %s → Preparo PJ Final (Conferente) (medição técnica agendada)', est_origem_nome),
    jsonb_build_object('pipeline','revisao','de',est_origem_nome,'para','1 - Preparo PJ Final (Conferente)','card_id',card_rec.id,'auto',true,'revisao_data',_revisao_data,'prazo',novo_prazo));
END $$;
