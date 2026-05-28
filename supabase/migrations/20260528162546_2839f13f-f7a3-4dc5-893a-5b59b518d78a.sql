
-- Tabela auxiliar para ajustes no relatório "Receita por Pedido"
CREATE TABLE IF NOT EXISTS public.resultado_pedido_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL UNIQUE REFERENCES public.pedidos(id) ON DELETE CASCADE,
  loja_id uuid REFERENCES public.lojas(id),
  valor_venda_liquida_ajustado numeric,
  custo_revisao_ajustado numeric,
  atualizado_por uuid,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resultado_pedido_ajustes TO authenticated;
GRANT ALL ON public.resultado_pedido_ajustes TO service_role;

ALTER TABLE public.resultado_pedido_ajustes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rpa_select" ON public.resultado_pedido_ajustes
  FOR SELECT TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(),'diretoria','view'));

CREATE POLICY "rpa_insert" ON public.resultado_pedido_ajustes
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'admin'::app_role)
    OR has_permission(auth.uid(),'relatorios_financeiros','editar_resultado_pedido')
  );

CREATE POLICY "rpa_update" ON public.resultado_pedido_ajustes
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_permission(auth.uid(),'relatorios_financeiros','editar_resultado_pedido')
  );

CREATE POLICY "rpa_delete" ON public.resultado_pedido_ajustes
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_rpa_loja ON public.resultado_pedido_ajustes(loja_id);

-- Registrar permissões no catálogo
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('relatorios_financeiros','view','Visualizar Relatórios Financeiros','Financeiro'),
  ('relatorios_financeiros','export','Exportar Relatórios Financeiros','Financeiro'),
  ('relatorios_financeiros','editar_resultado_pedido','Editar Valor Líquido / Custo Revisão no relatório por pedido','Financeiro')
ON CONFLICT (modulo, acao) DO NOTHING;
