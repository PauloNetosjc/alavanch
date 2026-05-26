
ALTER TABLE public.pedido_itens_avulsos
  ADD COLUMN IF NOT EXISTS produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantidade NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS preco_custo_unit NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pia_produto ON public.pedido_itens_avulsos(produto_id);
