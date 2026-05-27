ALTER TABLE public.configuracoes_empresa
ADD COLUMN IF NOT EXISTS formacao_preco_labels JSONB NOT NULL DEFAULT '{}'::jsonb;