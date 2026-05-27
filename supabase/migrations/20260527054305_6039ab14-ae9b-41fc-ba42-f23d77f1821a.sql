ALTER TABLE public.configuracoes_empresa
ADD COLUMN IF NOT EXISTS formacao_preco_extras JSONB NOT NULL DEFAULT '[]'::jsonb;