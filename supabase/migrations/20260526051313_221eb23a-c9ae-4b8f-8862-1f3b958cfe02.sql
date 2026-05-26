
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID,
  codigo_barra TEXT,
  codigo_interno TEXT,
  descricao TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  unidade_medida TEXT NOT NULL CHECK (unidade_medida IN ('kilo','metro_quadrado','metro_linear','metro_cubico','litro','unidade')),
  preco_custo NUMERIC NOT NULL DEFAULT 0,
  preco_venda NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view produtos"
ON public.produtos FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated can insert produtos"
ON public.produtos FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update produtos"
ON public.produtos FOR UPDATE
TO authenticated USING (true);

CREATE POLICY "Authenticated can delete produtos"
ON public.produtos FOR DELETE
TO authenticated USING (true);

CREATE TRIGGER update_produtos_updated_at
BEFORE UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_produtos_loja ON public.produtos(loja_id);
CREATE INDEX idx_produtos_codigo_barra ON public.produtos(codigo_barra);
CREATE INDEX idx_produtos_codigo_interno ON public.produtos(codigo_interno);
