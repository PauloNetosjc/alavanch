CREATE TABLE public.pedido_comissao_divisoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  papel TEXT NOT NULL DEFAULT 'Vendedor/Consultor',
  percentual NUMERIC(6,3) NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pcd_pedido ON public.pedido_comissao_divisoes(pedido_id);
CREATE INDEX idx_pcd_user ON public.pedido_comissao_divisoes(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_comissao_divisoes TO authenticated;
GRANT ALL ON public.pedido_comissao_divisoes TO service_role;

ALTER TABLE public.pedido_comissao_divisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view comissao divisoes"
  ON public.pedido_comissao_divisoes FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Authenticated can insert comissao divisoes"
  ON public.pedido_comissao_divisoes FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update comissao divisoes"
  ON public.pedido_comissao_divisoes FOR UPDATE
  TO authenticated USING (true);
CREATE POLICY "Authenticated can delete comissao divisoes"
  ON public.pedido_comissao_divisoes FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER set_pcd_updated_at
  BEFORE UPDATE ON public.pedido_comissao_divisoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();