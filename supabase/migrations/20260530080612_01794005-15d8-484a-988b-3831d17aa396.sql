ALTER TABLE public.fabrica_volumes
  ADD COLUMN IF NOT EXISTS carregado_em timestamptz,
  ADD COLUMN IF NOT EXISTS carregado_por uuid,
  ADD COLUMN IF NOT EXISTS problema_expedicao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS observacao_expedicao text;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS fabrica_expedido_em timestamptz,
  ADD COLUMN IF NOT EXISTS fabrica_expedido_por uuid;

CREATE TABLE IF NOT EXISTS public.fabrica_expedicao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  volume_id uuid REFERENCES public.fabrica_volumes(id) ON DELETE SET NULL,
  codigo_bipado text,
  resultado text NOT NULL,
  mensagem text,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fab_exp_hist_pedido ON public.fabrica_expedicao_historico(pedido_id);
CREATE INDEX IF NOT EXISTS idx_fab_exp_hist_created ON public.fabrica_expedicao_historico(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_expedicao_historico TO authenticated;
GRANT ALL ON public.fabrica_expedicao_historico TO service_role;

ALTER TABLE public.fabrica_expedicao_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fab_exp_hist_all" ON public.fabrica_expedicao_historico;
CREATE POLICY "fab_exp_hist_all" ON public.fabrica_expedicao_historico
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = fabrica_expedicao_historico.pedido_id
        AND (p.loja_id IS NULL OR p.loja_id = current_loja_id())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = fabrica_expedicao_historico.pedido_id
        AND (p.loja_id IS NULL OR p.loja_id = current_loja_id())
    )
  );

INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('fabrica_expedicao', 'view', 'Ver aba Expedição da Fábrica', 'Fábrica'),
  ('fabrica_expedicao', 'edit', 'Bipar volumes, marcar problemas e finalizar expedição', 'Fábrica')
ON CONFLICT (modulo, acao) DO UPDATE SET descricao = EXCLUDED.descricao, grupo = EXCLUDED.grupo;