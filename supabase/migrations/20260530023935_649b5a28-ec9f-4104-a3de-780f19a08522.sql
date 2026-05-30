
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.status_lote_producao AS ENUM ('rascunho','em_producao','concluido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABLE: etapas_kanban_fabrica ============
CREATE TABLE IF NOT EXISTS public.etapas_kanban_fabrica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  cor_hex text DEFAULT '#8b7355',
  prazo_dias_uteis integer DEFAULT NULL,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ekf_loja_chave ON public.etapas_kanban_fabrica(COALESCE(loja_id::text,''), chave);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.etapas_kanban_fabrica TO authenticated;
GRANT ALL ON public.etapas_kanban_fabrica TO service_role;
ALTER TABLE public.etapas_kanban_fabrica ENABLE ROW LEVEL SECURITY;

CREATE POLICY ekf_select ON public.etapas_kanban_fabrica
  FOR SELECT TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY ekf_admin_write ON public.etapas_kanban_fabrica
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'diretor'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'diretor'::app_role));

INSERT INTO public.etapas_kanban_fabrica (chave,nome,ordem,cor_hex,prazo_dias_uteis,loja_id,ativo) VALUES
  ('corte','Corte',1,'#7c3aed',2,NULL,true),
  ('borda','Borda',2,'#2563eb',2,NULL,true),
  ('furacao','Furação',3,'#0891b2',2,NULL,true),
  ('acabamento','Acabamento',4,'#d97706',3,NULL,true),
  ('embalagem','Embalagem',5,'#16a34a',1,NULL,true),
  ('expedicao','Expedição',6,'#b45309',1,NULL,true)
ON CONFLICT DO NOTHING;

-- ============ TABLE: lotes_producao ============
CREATE TABLE IF NOT EXISTS public.lotes_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_lote text NOT NULL,
  descricao text,
  data_criacao date NOT NULL DEFAULT CURRENT_DATE,
  data_previsao_conclusao date,
  status_lote public.status_lote_producao NOT NULL DEFAULT 'rascunho',
  responsavel_id uuid,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, numero_lote)
);

CREATE INDEX IF NOT EXISTS idx_lotes_producao_status ON public.lotes_producao(status_lote);
CREATE INDEX IF NOT EXISTS idx_lotes_producao_loja ON public.lotes_producao(loja_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lotes_producao TO authenticated;
GRANT ALL ON public.lotes_producao TO service_role;
ALTER TABLE public.lotes_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY lp_select ON public.lotes_producao
  FOR SELECT TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY lp_write ON public.lotes_producao
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'diretor'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'diretor'::app_role));

-- ============ TABLE: lote_pedidos ============
CREATE TABLE IF NOT EXISTS public.lote_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.lotes_producao(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  data_inclusao timestamptz NOT NULL DEFAULT now(),
  posicao_ordem integer DEFAULT 0,
  etapa_atual text DEFAULT 'corte',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lote_pedidos_lote ON public.lote_pedidos(lote_id);
CREATE INDEX IF NOT EXISTS idx_lote_pedidos_pedido ON public.lote_pedidos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_lote_pedidos_etapa ON public.lote_pedidos(etapa_atual);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lote_pedidos TO authenticated;
GRANT ALL ON public.lote_pedidos TO service_role;
ALTER TABLE public.lote_pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY lp_pd_select ON public.lote_pedidos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lotes_producao l WHERE l.id = lote_id
                 AND (l.loja_id IS NULL OR l.loja_id = current_loja_id() OR has_role(auth.uid(),'admin'::app_role))));

CREATE POLICY lp_pd_write ON public.lote_pedidos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'diretor'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'diretor'::app_role));

-- Garante 1 pedido em 1 lote ATIVO (rascunho/em_producao) via trigger
CREATE OR REPLACE FUNCTION public.fn_lote_pedidos_unico_ativo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existe int;
BEGIN
  SELECT COUNT(*) INTO v_existe
    FROM public.lote_pedidos lp
    JOIN public.lotes_producao l ON l.id = lp.lote_id
   WHERE lp.pedido_id = NEW.pedido_id
     AND lp.id IS DISTINCT FROM NEW.id
     AND l.status_lote IN ('rascunho','em_producao');
  IF v_existe > 0 THEN
    RAISE EXCEPTION 'Pedido já está em um lote ativo (rascunho/em_producao).';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lote_pedidos_unico_ativo ON public.lote_pedidos;
CREATE TRIGGER trg_lote_pedidos_unico_ativo
  BEFORE INSERT OR UPDATE ON public.lote_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_lote_pedidos_unico_ativo();

-- ============ TABLE: pedido_etapa_fabrica (histórico) ============
CREATE TABLE IF NOT EXISTS public.pedido_etapa_fabrica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  lote_id uuid REFERENCES public.lotes_producao(id) ON DELETE SET NULL,
  etapa_chave text NOT NULL,
  data_entrada timestamptz NOT NULL DEFAULT now(),
  data_saida timestamptz,
  responsavel_id uuid,
  movido_por uuid DEFAULT auth.uid(),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pef_pedido ON public.pedido_etapa_fabrica(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pef_lote ON public.pedido_etapa_fabrica(lote_id);
CREATE INDEX IF NOT EXISTS idx_pef_etapa ON public.pedido_etapa_fabrica(etapa_chave);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_etapa_fabrica TO authenticated;
GRANT ALL ON public.pedido_etapa_fabrica TO service_role;
ALTER TABLE public.pedido_etapa_fabrica ENABLE ROW LEVEL SECURITY;

CREATE POLICY pef_select ON public.pedido_etapa_fabrica
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
                 AND (p.loja_id IS NULL OR p.loja_id = current_loja_id() OR has_role(auth.uid(),'admin'::app_role))));

CREATE POLICY pef_write ON public.pedido_etapa_fabrica
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'diretor'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'diretor'::app_role));

-- ============ FUNÇÃO: próximo número de lote ============
CREATE OR REPLACE FUNCTION public.proximo_numero_lote(_loja_id uuid, _ano integer DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano integer := COALESCE(_ano, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  v_seq integer;
BEGIN
  SELECT COALESCE(MAX( (regexp_replace(numero_lote, '^.*-(\d+)$', '\1'))::int ), 0) + 1
    INTO v_seq
    FROM public.lotes_producao
   WHERE (loja_id = _loja_id OR (_loja_id IS NULL AND loja_id IS NULL))
     AND numero_lote LIKE 'LOTE-' || v_ano || '-%';
  RETURN 'LOTE-' || v_ano || '-' || lpad(v_seq::text, 3, '0');
END $$;

-- ============ TRIGGER: updated_at ============
CREATE OR REPLACE FUNCTION public._touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_lotes_producao_touch ON public.lotes_producao;
CREATE TRIGGER trg_lotes_producao_touch BEFORE UPDATE ON public.lotes_producao
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

DROP TRIGGER IF EXISTS trg_etapas_kanban_fabrica_touch ON public.etapas_kanban_fabrica;
CREATE TRIGGER trg_etapas_kanban_fabrica_touch BEFORE UPDATE ON public.etapas_kanban_fabrica
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- ============ REALTIME ============
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.lotes_producao;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.lote_pedidos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pedido_etapa_fabrica;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ CATÁLOGO DE PERMISSÕES ============
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('fabrica_lotes','view','Visualizar lotes de produção','Fábrica'),
  ('fabrica_lotes','edit','Criar/editar/mover lotes e cards no Kanban','Fábrica'),
  ('fabrica_etapas','view','Visualizar configuração de etapas','Fábrica'),
  ('fabrica_etapas','edit','Configurar etapas do Kanban da fábrica','Fábrica'),
  ('almoxarifado','view','Visualizar separação de materiais','Fábrica'),
  ('almoxarifado','edit','Registrar baixa/separação de materiais','Fábrica'),
  ('expedicao','view','Visualizar pedidos prontos para expedição','Fábrica'),
  ('expedicao','edit','Registrar saída de pedidos da fábrica','Fábrica')
ON CONFLICT (modulo, acao) DO NOTHING;
