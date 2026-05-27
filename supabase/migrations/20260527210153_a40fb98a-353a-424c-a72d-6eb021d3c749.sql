-- Token público de validação (independente do token de assinatura)
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS validation_token text UNIQUE DEFAULT encode(extensions.gen_random_bytes(20), 'hex');

UPDATE public.contratos SET validation_token = encode(extensions.gen_random_bytes(20), 'hex')
  WHERE validation_token IS NULL;

-- Configuração: assinar loja automaticamente ao gerar contrato
ALTER TABLE public.configuracoes_empresa
  ADD COLUMN IF NOT EXISTS assinar_loja_automaticamente boolean NOT NULL DEFAULT false;

-- Política anon para página pública de validação (somente leitura via validation_token)
DROP POLICY IF EXISTS "contratos_validation_anon" ON public.contratos;
CREATE POLICY "contratos_validation_anon" ON public.contratos
  FOR SELECT TO anon
  USING (validation_token IS NOT NULL);

GRANT SELECT ON public.contratos TO anon;
GRANT SELECT ON public.solicitacoes_assinatura TO anon;
GRANT SELECT ON public.pedidos TO anon;
GRANT SELECT ON public.clientes TO anon;
GRANT SELECT ON public.lojas TO anon;

-- Permitir leitura anônima limitada de solicitacoes/pedidos/clientes/lojas vinculados a um contrato com validation_token
DROP POLICY IF EXISTS "solic_anon_via_validation" ON public.solicitacoes_assinatura;
CREATE POLICY "solic_anon_via_validation" ON public.solicitacoes_assinatura
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.contratos c WHERE c.id = solicitacoes_assinatura.contrato_id AND c.validation_token IS NOT NULL));

DROP POLICY IF EXISTS "pedidos_anon_via_validation" ON public.pedidos;
CREATE POLICY "pedidos_anon_via_validation" ON public.pedidos
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.contratos c WHERE c.orcamento_id IN (SELECT id FROM public.orcamentos o WHERE o.id = pedidos.orcamento_id) AND c.validation_token IS NOT NULL));

DROP POLICY IF EXISTS "clientes_anon_via_validation" ON public.clientes;
CREATE POLICY "clientes_anon_via_validation" ON public.clientes
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.contratos c WHERE c.cliente_id = clientes.id AND c.validation_token IS NOT NULL));

DROP POLICY IF EXISTS "lojas_anon_via_validation" ON public.lojas;
CREATE POLICY "lojas_anon_via_validation" ON public.lojas
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.contratos c WHERE c.loja_id = lojas.id AND c.validation_token IS NOT NULL));