
CREATE TABLE IF NOT EXISTS public.etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#7E4FA0',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etiquetas_select_all" ON public.etiquetas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "etiquetas_admin_all" ON public.etiquetas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.pedido_etiquetas (
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  etiqueta_id uuid NOT NULL REFERENCES public.etiquetas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pedido_id, etiqueta_id)
);

ALTER TABLE public.pedido_etiquetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedido_etiquetas_select_all" ON public.pedido_etiquetas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pedido_etiquetas_insert_all" ON public.pedido_etiquetas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pedido_etiquetas_delete_all" ON public.pedido_etiquetas
  FOR DELETE TO authenticated USING (true);
