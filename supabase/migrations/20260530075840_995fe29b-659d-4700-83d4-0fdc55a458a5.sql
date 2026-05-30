
-- Fase 3 Fábrica: Almoxarifado por leitor e caixas

-- Tabela de itens dentro de cada caixa de almoxarifado
CREATE TABLE public.fabrica_volume_almoxarifado_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volume_id uuid NOT NULL REFERENCES public.fabrica_volumes(id) ON DELETE CASCADE,
  almoxarifado_item_id uuid NOT NULL REFERENCES public.fabrica_almoxarifado_itens(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid
);
CREATE INDEX idx_fab_vai_volume ON public.fabrica_volume_almoxarifado_itens(volume_id);
CREATE INDEX idx_fab_vai_pedido ON public.fabrica_volume_almoxarifado_itens(pedido_id);
CREATE INDEX idx_fab_vai_item ON public.fabrica_volume_almoxarifado_itens(almoxarifado_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_volume_almoxarifado_itens TO authenticated;
GRANT ALL ON public.fabrica_volume_almoxarifado_itens TO service_role;

ALTER TABLE public.fabrica_volume_almoxarifado_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fab_vai_all" ON public.fabrica_volume_almoxarifado_itens
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = fabrica_volume_almoxarifado_itens.pedido_id
        AND (p.loja_id IS NULL OR p.loja_id = current_loja_id())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = fabrica_volume_almoxarifado_itens.pedido_id
        AND (p.loja_id IS NULL OR p.loja_id = current_loja_id())
    )
  );

-- Histórico de bipagem do almoxarifado
CREATE TABLE public.fabrica_almoxarifado_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.fabrica_almoxarifado_itens(id) ON DELETE SET NULL,
  volume_id uuid REFERENCES public.fabrica_volumes(id) ON DELETE SET NULL,
  codigo_bipado text,
  resultado text NOT NULL,
  mensagem text,
  quantidade numeric,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fab_alm_hist_pedido ON public.fabrica_almoxarifado_historico(pedido_id);
CREATE INDEX idx_fab_alm_hist_volume ON public.fabrica_almoxarifado_historico(volume_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_almoxarifado_historico TO authenticated;
GRANT ALL ON public.fabrica_almoxarifado_historico TO service_role;

ALTER TABLE public.fabrica_almoxarifado_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fab_alm_hist_all" ON public.fabrica_almoxarifado_historico
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = fabrica_almoxarifado_historico.pedido_id
        AND (p.loja_id IS NULL OR p.loja_id = current_loja_id())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = fabrica_almoxarifado_historico.pedido_id
        AND (p.loja_id IS NULL OR p.loja_id = current_loja_id())
    )
  );

-- Registrar permissões da aba Almoxarifado
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('fabrica_almoxarifado', 'view', 'Acessar Almoxarifado da Fábrica', 'Fábrica'),
  ('fabrica_almoxarifado', 'edit', 'Bipar itens, criar caixas e imprimir etiquetas do almoxarifado', 'Fábrica')
ON CONFLICT (modulo, acao) DO NOTHING;
