
CREATE TABLE public.fabrica_volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  lote_id UUID NULL,
  numero_volume INTEGER NOT NULL,
  tipo_volume TEXT NOT NULL DEFAULT 'peca_individual',
  status TEXT NOT NULL DEFAULT 'aberto',
  codigo_barras TEXT NOT NULL UNIQUE,
  quantidade_pecas INTEGER NOT NULL DEFAULT 0,
  observacoes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID NULL,
  atualizado_por UUID NULL
);
CREATE INDEX idx_fab_vol_pedido ON public.fabrica_volumes(pedido_id);
CREATE UNIQUE INDEX uq_fab_vol_pedido_num ON public.fabrica_volumes(pedido_id, numero_volume);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_volumes TO authenticated;
GRANT ALL ON public.fabrica_volumes TO service_role;
ALTER TABLE public.fabrica_volumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fab_vol_all" ON public.fabrica_volumes FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id=pedido_id AND (p.loja_id IS NULL OR p.loja_id=current_loja_id())))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id=pedido_id AND (p.loja_id IS NULL OR p.loja_id=current_loja_id())));
CREATE TRIGGER trg_fab_vol_updated BEFORE UPDATE ON public.fabrica_volumes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fabrica_volume_pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volume_id UUID NOT NULL REFERENCES public.fabrica_volumes(id) ON DELETE CASCADE,
  peca_id UUID NOT NULL REFERENCES public.fabrica_pecas(id) ON DELETE CASCADE,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID NULL,
  UNIQUE (peca_id)
);
CREATE INDEX idx_fab_volp_vol ON public.fabrica_volume_pecas(volume_id);
CREATE INDEX idx_fab_volp_ped ON public.fabrica_volume_pecas(pedido_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_volume_pecas TO authenticated;
GRANT ALL ON public.fabrica_volume_pecas TO service_role;
ALTER TABLE public.fabrica_volume_pecas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fab_volp_all" ON public.fabrica_volume_pecas FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id=pedido_id AND (p.loja_id IS NULL OR p.loja_id=current_loja_id())))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id=pedido_id AND (p.loja_id IS NULL OR p.loja_id=current_loja_id())));

CREATE TABLE public.fabrica_conferencia_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  lote_id UUID NULL,
  peca_id UUID NULL,
  volume_id UUID NULL,
  codigo_bipado TEXT NULL,
  resultado TEXT NOT NULL,
  mensagem TEXT NULL,
  usuario_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fab_conf_hist_pedido ON public.fabrica_conferencia_historico(pedido_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_conferencia_historico TO authenticated;
GRANT ALL ON public.fabrica_conferencia_historico TO service_role;
ALTER TABLE public.fabrica_conferencia_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fab_conf_hist_all" ON public.fabrica_conferencia_historico FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id=pedido_id AND (p.loja_id IS NULL OR p.loja_id=current_loja_id())))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id=pedido_id AND (p.loja_id IS NULL OR p.loja_id=current_loja_id())));

ALTER TABLE public.fabrica_pecas ADD COLUMN IF NOT EXISTS volume_id UUID NULL;

INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('fabrica_conferencia','view','Acessar Conferência da Fábrica','Fábrica'),
  ('fabrica_conferencia','edit','Bipar peças, criar volumes e imprimir etiquetas','Fábrica')
ON CONFLICT DO NOTHING;
