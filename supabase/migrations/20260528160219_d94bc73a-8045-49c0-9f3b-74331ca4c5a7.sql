
-- 1) Estender categorias_financeiras
ALTER TABLE public.categorias_financeiras
  ADD COLUMN IF NOT EXISTS contabilizar_dre boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS loja_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Normalizar tipos antigos -> receita/despesa
UPDATE public.categorias_financeiras SET tipo='receita' WHERE tipo IN ('entrada','receita','RECEITA','Entrada');
UPDATE public.categorias_financeiras SET tipo='despesa' WHERE tipo IN ('saida','saída','despesa','SAIDA','Saída','DESPESA');

-- 2) Tabela centros_custo
CREATE TABLE IF NOT EXISTS public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  atualizado_por uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_custo TO authenticated;
GRANT ALL ON public.centros_custo TO service_role;

ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "centros_custo_select" ON public.centros_custo;
DROP POLICY IF EXISTS "centros_custo_insert" ON public.centros_custo;
DROP POLICY IF EXISTS "centros_custo_update" ON public.centros_custo;
DROP POLICY IF EXISTS "centros_custo_delete" ON public.centros_custo;

CREATE POLICY "centros_custo_select" ON public.centros_custo FOR SELECT TO authenticated USING (true);
CREATE POLICY "centros_custo_insert" ON public.centros_custo FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "centros_custo_update" ON public.centros_custo FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "centros_custo_delete" ON public.centros_custo FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- 3) Adicionar centro_custo_id em lancamentos_financeiros
ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lanc_centro_custo ON public.lancamentos_financeiros(centro_custo_id);

-- 4) Seed centros padrão
INSERT INTO public.centros_custo (nome, ordem) VALUES
  ('Administrativo', 1),
  ('Comercial', 2),
  ('Fábrica', 3),
  ('Montagem', 4),
  ('Entrega', 5),
  ('Marketing', 6),
  ('Financeiro', 7),
  ('RH', 8),
  ('Geral', 99)
ON CONFLICT DO NOTHING;

-- 5) Catálogo de permissões
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('centros_custo','view','Visualizar Centros de Custo','Financeiro'),
  ('centros_custo','edit','Editar Centros de Custo','Financeiro')
ON CONFLICT DO NOTHING;
