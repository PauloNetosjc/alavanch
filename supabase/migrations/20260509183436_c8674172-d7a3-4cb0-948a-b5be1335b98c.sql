
-- 1) SLA por estágio
ALTER TABLE public.pipeline_estagios
  ADD COLUMN IF NOT EXISTS sla_dias_uteis integer;

-- 2) Tabela de automações
CREATE TABLE IF NOT EXISTS public.pipeline_automacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL,
  estagio_origem_id uuid NOT NULL REFERENCES public.pipeline_estagios(id) ON DELETE CASCADE,
  estagio_destino_id uuid NOT NULL REFERENCES public.pipeline_estagios(id) ON DELETE CASCADE,
  evento text NOT NULL,
  condicao_tipo text NOT NULL DEFAULT 'nenhuma',
  condicao_valor text,
  ajustar_prazo_dias integer,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_origem ON public.pipeline_automacoes(estagio_origem_id);
CREATE INDEX IF NOT EXISTS idx_pa_evento ON public.pipeline_automacoes(pipeline, evento);

ALTER TABLE public.pipeline_automacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_select ON public.pipeline_automacoes;
DROP POLICY IF EXISTS pa_admin ON public.pipeline_automacoes;
CREATE POLICY pa_select ON public.pipeline_automacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY pa_admin ON public.pipeline_automacoes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_pa_updated_at BEFORE UPDATE ON public.pipeline_automacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Trigger genérico que aplica SLA do estágio quando o card entra
CREATE OR REPLACE FUNCTION public.kanban_aplicar_sla_estagio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sla int;
  loja uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.estagio_id = OLD.estagio_id THEN
    RETURN NEW;
  END IF;
  SELECT sla_dias_uteis INTO sla FROM public.pipeline_estagios WHERE id = NEW.estagio_id;
  IF sla IS NULL OR sla <= 0 THEN
    RETURN NEW;
  END IF;
  SELECT loja_id INTO loja FROM public.pedidos WHERE id = NEW.pedido_id;
  NEW.prazo := public.add_dias_uteis(CURRENT_DATE, sla, loja);
  NEW.sla_dias_uteis := sla;
  NEW.iniciado_em := now();
  NEW.notificacao_atraso_em := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_kanban_aplicar_sla ON public.kanban_cards;
CREATE TRIGGER trg_kanban_aplicar_sla
  BEFORE INSERT OR UPDATE OF estagio_id ON public.kanban_cards
  FOR EACH ROW EXECUTE FUNCTION public.kanban_aplicar_sla_estagio();

-- 4) Engine genérica de avanço
CREATE OR REPLACE FUNCTION public.pipeline_avancar_card(
  _pedido_id uuid,
  _evento text,
  _contexto jsonb DEFAULT '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  card_rec record;
  reg record;
  loja uuid;
  novo_prazo date;
  cond_ok boolean;
  data_ref date;
  count_mov int := 0;
  est_origem_nome text;
  est_destino_nome text;
BEGIN
  SELECT loja_id INTO loja FROM public.pedidos WHERE id = _pedido_id;

  FOR card_rec IN
    SELECT * FROM public.kanban_cards WHERE pedido_id = _pedido_id
  LOOP
    FOR reg IN
      SELECT * FROM public.pipeline_automacoes
       WHERE ativo = true
         AND evento = _evento
         AND estagio_origem_id = card_rec.estagio_id
       ORDER BY ordem
    LOOP
      cond_ok := true;
      IF reg.condicao_tipo = 'tipo_evento_agenda' THEN
        cond_ok := lower(coalesce(_contexto->>'tipo_evento','')) = lower(coalesce(reg.condicao_valor,''));
      ELSIF reg.condicao_tipo = 'template_checklist' THEN
        cond_ok := coalesce(_contexto->>'template_id','') = coalesce(reg.condicao_valor,'');
      END IF;

      IF NOT cond_ok THEN CONTINUE; END IF;

      novo_prazo := NULL;
      IF reg.ajustar_prazo_dias IS NOT NULL THEN
        data_ref := NULLIF(_contexto->>'data_referencia','')::date;
        IF reg.ajustar_prazo_dias < 0 AND data_ref IS NOT NULL THEN
          novo_prazo := public.sub_dias_uteis(data_ref, abs(reg.ajustar_prazo_dias), loja);
        ELSIF reg.ajustar_prazo_dias > 0 THEN
          novo_prazo := public.add_dias_uteis(COALESCE(data_ref,CURRENT_DATE), reg.ajustar_prazo_dias, loja);
        END IF;
      END IF;

      SELECT nome INTO est_origem_nome FROM public.pipeline_estagios WHERE id = card_rec.estagio_id;
      SELECT nome INTO est_destino_nome FROM public.pipeline_estagios WHERE id = reg.estagio_destino_id;

      UPDATE public.kanban_cards
         SET estagio_id = reg.estagio_destino_id,
             prazo = COALESCE(novo_prazo, prazo),
             iniciado_em = now(),
             notificacao_atraso_em = NULL,
             updated_at = now()
       WHERE id = card_rec.id;

      INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, metadata)
      VALUES ('pedido', _pedido_id, 'kanban_movimento',
        format('[%s] %s → %s (auto: %s)', card_rec.pipeline, est_origem_nome, est_destino_nome, _evento),
        jsonb_build_object('pipeline', card_rec.pipeline, 'de', est_origem_nome,
          'para', est_destino_nome, 'card_id', card_rec.id, 'auto', true,
          'evento', _evento, 'prazo', novo_prazo) || _contexto);

      count_mov := count_mov + 1;
      EXIT; -- só uma regra por card
    END LOOP;
  END LOOP;

  RETURN count_mov;
END $$;
