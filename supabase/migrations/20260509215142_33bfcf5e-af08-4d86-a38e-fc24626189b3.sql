
-- Anon SELECT para clientes referenciados em uma solicitação ativa
DROP POLICY IF EXISTS "clientes_anon_via_assinatura" ON public.clientes;
CREATE POLICY "clientes_anon_via_assinatura"
ON public.clientes FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.solicitacoes_assinatura s
  WHERE s.cliente_id = clientes.id AND s.token IS NOT NULL
));

-- Anon SELECT para pedidos referenciados
DROP POLICY IF EXISTS "pedidos_anon_via_assinatura" ON public.pedidos;
CREATE POLICY "pedidos_anon_via_assinatura"
ON public.pedidos FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.solicitacoes_assinatura s
  WHERE s.pedido_id = pedidos.id AND s.token IS NOT NULL
));

-- Anon SELECT para lojas referenciadas
DROP POLICY IF EXISTS "lojas_anon_via_assinatura" ON public.lojas;
CREATE POLICY "lojas_anon_via_assinatura"
ON public.lojas FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.solicitacoes_assinatura s
  WHERE s.loja_id = lojas.id AND s.token IS NOT NULL
));

-- Anon SELECT para contratos referenciados (visualização do documento)
DROP POLICY IF EXISTS "contratos_anon_via_assinatura" ON public.contratos;
CREATE POLICY "contratos_anon_via_assinatura"
ON public.contratos FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.solicitacoes_assinatura s
  WHERE s.contrato_id = contratos.id AND s.token IS NOT NULL
));
