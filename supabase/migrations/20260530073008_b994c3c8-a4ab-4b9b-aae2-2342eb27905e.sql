
-- ============================================================
-- FÁBRICA — FASE 1 (estrutura base)
-- ============================================================

-- 1) ARQUIVOS DE PRODUÇÃO
CREATE TABLE public.fabrica_arquivos_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  lote_id UUID NULL,
  tipo_arquivo TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  url_arquivo TEXT NOT NULL,
  mime_type TEXT NULL,
  tamanho_bytes BIGINT NULL,
  obrigatorio BOOLEAN NOT NULL DEFAULT FALSE,
  processado BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID NULL,
  atualizado_por UUID NULL
);
CREATE INDEX idx_fab_arq_pedido ON public.fabrica_arquivos_producao(pedido_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_arquivos_producao TO authenticated;
GRANT ALL ON public.fabrica_arquivos_producao TO service_role;
ALTER TABLE public.fabrica_arquivos_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fab_arq_select" ON public.fabrica_arquivos_producao FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
             AND (p.loja_id IS NULL OR p.loja_id = current_loja_id()))
);
CREATE POLICY "fab_arq_insert" ON public.fabrica_arquivos_producao FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
             AND (p.loja_id IS NULL OR p.loja_id = current_loja_id()))
);
CREATE POLICY "fab_arq_update" ON public.fabrica_arquivos_producao FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
             AND (p.loja_id IS NULL OR p.loja_id = current_loja_id()))
);
CREATE POLICY "fab_arq_delete" ON public.fabrica_arquivos_producao FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
             AND (p.loja_id IS NULL OR p.loja_id = current_loja_id()))
);

CREATE TRIGGER trg_fab_arq_updated BEFORE UPDATE ON public.fabrica_arquivos_producao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) MÓDULOS DE PRODUÇÃO
CREATE TABLE public.fabrica_modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  lote_id UUID NULL,
  codigo_modulo TEXT NOT NULL,
  nome_modulo TEXT NULL,
  ambiente TEXT NULL,
  descricao TEXT NULL,
  ordem INTEGER NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID NULL,
  atualizado_por UUID NULL,
  UNIQUE(pedido_id, codigo_modulo)
);
CREATE INDEX idx_fab_mod_pedido ON public.fabrica_modulos(pedido_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_modulos TO authenticated;
GRANT ALL ON public.fabrica_modulos TO service_role;
ALTER TABLE public.fabrica_modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fab_mod_all" ON public.fabrica_modulos FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
             AND (p.loja_id IS NULL OR p.loja_id = current_loja_id()))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
             AND (p.loja_id IS NULL OR p.loja_id = current_loja_id()))
);
CREATE TRIGGER trg_fab_mod_updated BEFORE UPDATE ON public.fabrica_modulos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) PEÇAS
CREATE TABLE public.fabrica_pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  lote_id UUID NULL,
  modulo_id UUID NULL REFERENCES public.fabrica_modulos(id) ON DELETE SET NULL,
  codigo_peca TEXT NOT NULL,
  referencia TEXT NULL,
  descricao TEXT NULL,
  medida_largura NUMERIC NULL,
  medida_altura NUMERIC NULL,
  medida_profundidade NUMERIC NULL,
  medida_texto TEXT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  unidade TEXT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando_producao',
  codigo_barras TEXT NULL,
  observacoes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID NULL,
  atualizado_por UUID NULL
);
CREATE INDEX idx_fab_pec_pedido ON public.fabrica_pecas(pedido_id);
CREATE INDEX idx_fab_pec_modulo ON public.fabrica_pecas(modulo_id);
CREATE UNIQUE INDEX uq_fab_pec_pedido_mod_codigo ON public.fabrica_pecas(pedido_id, COALESCE(modulo_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo_peca);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_pecas TO authenticated;
GRANT ALL ON public.fabrica_pecas TO service_role;
ALTER TABLE public.fabrica_pecas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fab_pec_all" ON public.fabrica_pecas FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
             AND (p.loja_id IS NULL OR p.loja_id = current_loja_id()))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
             AND (p.loja_id IS NULL OR p.loja_id = current_loja_id()))
);
CREATE TRIGGER trg_fab_pec_updated BEFORE UPDATE ON public.fabrica_pecas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) ALMOXARIFADO
CREATE TABLE public.fabrica_almoxarifado_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  lote_id UUID NULL,
  referencia TEXT NOT NULL,
  descricao TEXT NULL,
  quantidade_necessaria NUMERIC NOT NULL DEFAULT 0,
  unidade TEXT NULL,
  quantidade_separada NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  codigo_barras TEXT NULL,
  estoque_atual NUMERIC NULL,
  observacoes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID NULL,
  atualizado_por UUID NULL,
  UNIQUE(pedido_id, referencia)
);
CREATE INDEX idx_fab_alm_pedido ON public.fabrica_almoxarifado_itens(pedido_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_almoxarifado_itens TO authenticated;
GRANT ALL ON public.fabrica_almoxarifado_itens TO service_role;
ALTER TABLE public.fabrica_almoxarifado_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fab_alm_all" ON public.fabrica_almoxarifado_itens FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
             AND (p.loja_id IS NULL OR p.loja_id = current_loja_id()))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_id
             AND (p.loja_id IS NULL OR p.loja_id = current_loja_id()))
);
CREATE TRIGGER trg_fab_alm_updated BEFORE UPDATE ON public.fabrica_almoxarifado_itens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) BUCKET de arquivos
INSERT INTO storage.buckets (id, name, public) VALUES ('fabrica-arquivos', 'fabrica-arquivos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fab_arq_storage_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'fabrica-arquivos');
CREATE POLICY "fab_arq_storage_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'fabrica-arquivos');
CREATE POLICY "fab_arq_storage_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'fabrica-arquivos');
CREATE POLICY "fab_arq_storage_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'fabrica-arquivos');

-- 6) Catálogo de permissões
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('fabrica_painel', 'view', 'Acesso ao Painel da Fábrica', 'Fábrica'),
  ('fabrica_importar_producao', 'view', 'Acessar Importar Produção', 'Fábrica'),
  ('fabrica_importar_producao', 'edit', 'Importar arquivos e dados de produção', 'Fábrica'),
  ('fabrica_producao_pedido', 'view', 'Acessar Produção por Pedido', 'Fábrica'),
  ('fabrica_producao_pedido', 'edit', 'Editar módulos, peças e itens da produção', 'Fábrica'),
  ('fabrica_editar_status', 'edit', 'Alterar status da fábrica nos pedidos', 'Fábrica'),
  ('fabrica_arquivos', 'view', 'Visualizar arquivos de produção', 'Fábrica'),
  ('fabrica_arquivos', 'edit', 'Anexar e gerenciar arquivos de produção', 'Fábrica')
ON CONFLICT (modulo, acao) DO NOTHING;
