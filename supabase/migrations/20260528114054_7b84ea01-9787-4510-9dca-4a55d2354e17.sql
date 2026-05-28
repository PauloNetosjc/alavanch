-- 1) Novos campos em configuracoes_empresa
ALTER TABLE public.configuracoes_empresa
  ADD COLUMN IF NOT EXISTS prazo_entrega_tipo_dias text NOT NULL DEFAULT 'corridos',
  ADD COLUMN IF NOT EXISTS prazo_entrega_inicio_contagem text NOT NULL DEFAULT 'assinatura_contrato',
  ADD COLUMN IF NOT EXISTS prazo_montagem_dias integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS prazo_montagem_tipo_dias text NOT NULL DEFAULT 'uteis',
  ADD COLUMN IF NOT EXISTS prazo_montagem_inicio_contagem text NOT NULL DEFAULT 'entrega_realizada';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_prazo_entrega_tipo_dias') THEN
    ALTER TABLE public.configuracoes_empresa
      ADD CONSTRAINT ck_prazo_entrega_tipo_dias CHECK (prazo_entrega_tipo_dias IN ('uteis','corridos'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_prazo_entrega_inicio') THEN
    ALTER TABLE public.configuracoes_empresa
      ADD CONSTRAINT ck_prazo_entrega_inicio CHECK (prazo_entrega_inicio_contagem IN ('assinatura_contrato','assinatura_pdf_final'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_prazo_montagem_tipo_dias') THEN
    ALTER TABLE public.configuracoes_empresa
      ADD CONSTRAINT ck_prazo_montagem_tipo_dias CHECK (prazo_montagem_tipo_dias IN ('uteis','corridos'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_prazo_montagem_inicio') THEN
    ALTER TABLE public.configuracoes_empresa
      ADD CONSTRAINT ck_prazo_montagem_inicio CHECK (prazo_montagem_inicio_contagem IN ('entrega_realizada','fim_prazo_entrega'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_prazo_montagem_dias_min') THEN
    ALTER TABLE public.configuracoes_empresa
      ADD CONSTRAINT ck_prazo_montagem_dias_min CHECK (prazo_montagem_dias >= 0);
  END IF;
END$$;

-- 2) Colunas em pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS data_limite_entrega date,
  ADD COLUMN IF NOT EXISTS data_limite_inicio_montagem date;

CREATE INDEX IF NOT EXISTS idx_pedidos_data_limite_entrega ON public.pedidos(data_limite_entrega);
CREATE INDEX IF NOT EXISTS idx_pedidos_data_limite_inicio_montagem ON public.pedidos(data_limite_inicio_montagem);

-- 3) Helper: somar dias úteis (sáb/dom como não úteis)
CREATE OR REPLACE FUNCTION public.add_business_days(p_base date, p_days integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_date date := p_base;
  v_added integer := 0;
BEGIN
  IF p_base IS NULL THEN RETURN NULL; END IF;
  IF p_days IS NULL OR p_days <= 0 THEN RETURN p_base; END IF;
  WHILE v_added < p_days LOOP
    v_date := v_date + 1;
    IF EXTRACT(ISODOW FROM v_date) < 6 THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;
  RETURN v_date;
END;
$$;

-- 4) Função central: recalcular_prazos_operacionais_pedido
CREATE OR REPLACE FUNCTION public.recalcular_prazos_operacionais_pedido(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido            record;
  v_cfg               record;
  v_base_entrega      date;
  v_base_montagem     date;
  v_limite_entrega    date;
  v_limite_montagem   date;
  v_contrato_assinado date;
BEGIN
  SELECT p.id, p.loja_id, p.orcamento_id,
         p.data_assinatura_pdf_final, p.data_entrega
    INTO v_pedido
    FROM public.pedidos p
   WHERE p.id = p_pedido_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Configuração da loja (fallback: qualquer config)
  SELECT prazo_padrao_dias, prazo_entrega_tipo_dias, prazo_entrega_inicio_contagem,
         prazo_montagem_dias, prazo_montagem_tipo_dias, prazo_montagem_inicio_contagem
    INTO v_cfg
    FROM public.configuracoes_empresa
   WHERE loja_id = v_pedido.loja_id
   LIMIT 1;
  IF NOT FOUND THEN
    SELECT prazo_padrao_dias, prazo_entrega_tipo_dias, prazo_entrega_inicio_contagem,
           prazo_montagem_dias, prazo_montagem_tipo_dias, prazo_montagem_inicio_contagem
      INTO v_cfg
      FROM public.configuracoes_empresa
     LIMIT 1;
  END IF;
  IF NOT FOUND THEN RETURN; END IF;

  -- Data base para entrega
  IF coalesce(v_cfg.prazo_entrega_inicio_contagem,'assinatura_contrato') = 'assinatura_pdf_final' THEN
    v_base_entrega := v_pedido.data_assinatura_pdf_final;
  ELSE
    -- assinatura do contrato: pega o contrato mais recente assinado do mesmo orçamento
    SELECT (c.assinado_em AT TIME ZONE 'America/Sao_Paulo')::date
      INTO v_contrato_assinado
      FROM public.contratos c
     WHERE c.orcamento_id = v_pedido.orcamento_id
       AND c.assinado_em IS NOT NULL
     ORDER BY c.assinado_em DESC
     LIMIT 1;
    v_base_entrega := v_contrato_assinado;
  END IF;

  IF v_base_entrega IS NOT NULL AND coalesce(v_cfg.prazo_padrao_dias,0) > 0 THEN
    IF coalesce(v_cfg.prazo_entrega_tipo_dias,'corridos') = 'uteis' THEN
      v_limite_entrega := public.add_business_days(v_base_entrega, v_cfg.prazo_padrao_dias);
    ELSE
      v_limite_entrega := v_base_entrega + v_cfg.prazo_padrao_dias;
    END IF;
  ELSE
    v_limite_entrega := NULL;
  END IF;

  -- Data base para montagem
  IF coalesce(v_cfg.prazo_montagem_inicio_contagem,'entrega_realizada') = 'fim_prazo_entrega' THEN
    v_base_montagem := v_limite_entrega;
  ELSE
    v_base_montagem := v_pedido.data_entrega;
  END IF;

  IF v_base_montagem IS NOT NULL AND coalesce(v_cfg.prazo_montagem_dias,0) >= 0 THEN
    IF coalesce(v_cfg.prazo_montagem_tipo_dias,'uteis') = 'uteis' THEN
      v_limite_montagem := public.add_business_days(v_base_montagem, v_cfg.prazo_montagem_dias);
    ELSE
      v_limite_montagem := v_base_montagem + v_cfg.prazo_montagem_dias;
    END IF;
  ELSE
    v_limite_montagem := NULL;
  END IF;

  UPDATE public.pedidos
     SET data_limite_entrega = v_limite_entrega,
         data_limite_inicio_montagem = v_limite_montagem
   WHERE id = p_pedido_id
     AND (coalesce(data_limite_entrega::text,'') IS DISTINCT FROM coalesce(v_limite_entrega::text,'')
       OR coalesce(data_limite_inicio_montagem::text,'') IS DISTINCT FROM coalesce(v_limite_montagem::text,''));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'recalcular_prazos_operacionais_pedido(%): %', p_pedido_id, SQLERRM;
END;
$$;

-- 5) Trigger: ao atualizar pedidos.data_assinatura_pdf_final / data_entrega / loja_id / orcamento_id
CREATE OR REPLACE FUNCTION public.trg_pedido_recalc_prazos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.data_assinatura_pdf_final IS DISTINCT FROM OLD.data_assinatura_pdf_final
     OR NEW.data_entrega IS DISTINCT FROM OLD.data_entrega
     OR NEW.loja_id IS DISTINCT FROM OLD.loja_id
     OR NEW.orcamento_id IS DISTINCT FROM OLD.orcamento_id
  THEN
    PERFORM public.recalcular_prazos_operacionais_pedido(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_recalc_prazos ON public.pedidos;
CREATE TRIGGER trg_pedido_recalc_prazos
AFTER INSERT OR UPDATE OF data_assinatura_pdf_final, data_entrega, loja_id, orcamento_id
ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.trg_pedido_recalc_prazos();

-- 6) Trigger: ao assinar contrato (contratos.assinado_em set)
CREATE OR REPLACE FUNCTION public.trg_contrato_recalc_prazos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.assinado_em IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.assinado_em IS DISTINCT FROM OLD.assinado_em)
  THEN
    FOR r IN SELECT id FROM public.pedidos WHERE orcamento_id = NEW.orcamento_id LOOP
      PERFORM public.recalcular_prazos_operacionais_pedido(r.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrato_recalc_prazos ON public.contratos;
CREATE TRIGGER trg_contrato_recalc_prazos
AFTER INSERT OR UPDATE OF assinado_em ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.trg_contrato_recalc_prazos();

-- 7) Trigger: ao alterar configuração de prazo de uma loja, recalcula pedidos ativos
CREATE OR REPLACE FUNCTION public.trg_config_recalc_prazos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF TG_OP = 'UPDATE' AND (
       NEW.prazo_padrao_dias IS DISTINCT FROM OLD.prazo_padrao_dias
    OR NEW.prazo_entrega_tipo_dias IS DISTINCT FROM OLD.prazo_entrega_tipo_dias
    OR NEW.prazo_entrega_inicio_contagem IS DISTINCT FROM OLD.prazo_entrega_inicio_contagem
    OR NEW.prazo_montagem_dias IS DISTINCT FROM OLD.prazo_montagem_dias
    OR NEW.prazo_montagem_tipo_dias IS DISTINCT FROM OLD.prazo_montagem_tipo_dias
    OR NEW.prazo_montagem_inicio_contagem IS DISTINCT FROM OLD.prazo_montagem_inicio_contagem
  ) THEN
    FOR r IN
      SELECT id FROM public.pedidos
       WHERE loja_id = NEW.loja_id
         AND coalesce(arquivado,false) = false
         AND coalesce(status,'') NOT IN ('Cancelado','Concluido','Concluído')
    LOOP
      PERFORM public.recalcular_prazos_operacionais_pedido(r.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_config_recalc_prazos ON public.configuracoes_empresa;
CREATE TRIGGER trg_config_recalc_prazos
AFTER UPDATE ON public.configuracoes_empresa
FOR EACH ROW EXECUTE FUNCTION public.trg_config_recalc_prazos();

-- 8) Backfill inicial
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.pedidos WHERE coalesce(arquivado,false) = false LOOP
    PERFORM public.recalcular_prazos_operacionais_pedido(r.id);
  END LOOP;
END$$;