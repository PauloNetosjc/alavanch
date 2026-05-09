ALTER TABLE public.pedido_documentos
ADD COLUMN IF NOT EXISTS bucket_name text NOT NULL DEFAULT 'pedido-docs';