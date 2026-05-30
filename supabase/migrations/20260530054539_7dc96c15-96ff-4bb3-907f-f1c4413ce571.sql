
-- ETAPA 2.1 / 2.2 — Financeiro SaaS (estrutura própria)

CREATE TABLE IF NOT EXISTS public.saas_contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, banco text, agencia text, conta text, tipo_conta text, chave_pix text,
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true, observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid, atualizado_por uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_contas_bancarias TO authenticated;
GRANT ALL ON public.saas_contas_bancarias TO service_role;
ALTER TABLE public.saas_contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia saas_contas_bancarias" ON public.saas_contas_bancarias
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_saas_contas_bancarias_upd BEFORE UPDATE ON public.saas_contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.saas_categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, tipo text NOT NULL CHECK (tipo IN ('receita','despesa')),
  parent_id uuid REFERENCES public.saas_categorias_financeiras(id) ON DELETE SET NULL,
  ordem integer NOT NULL DEFAULT 0,
  contabilizar_dre boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid, atualizado_por uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_categorias_financeiras TO authenticated;
GRANT ALL ON public.saas_categorias_financeiras TO service_role;
ALTER TABLE public.saas_categorias_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia saas_categorias_financeiras" ON public.saas_categorias_financeiras
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_saas_categorias_financeiras_upd BEFORE UPDATE ON public.saas_categorias_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.saas_centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, descricao text, ordem integer NOT NULL DEFAULT 0, ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid, atualizado_por uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_centros_custo TO authenticated;
GRANT ALL ON public.saas_centros_custo TO service_role;
ALTER TABLE public.saas_centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia saas_centros_custo" ON public.saas_centros_custo
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_saas_centros_custo_upd BEFORE UPDATE ON public.saas_centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.saas_formas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, tipo text, ativo boolean NOT NULL DEFAULT true, ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_formas_pagamento TO authenticated;
GRANT ALL ON public.saas_formas_pagamento TO service_role;
ALTER TABLE public.saas_formas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia saas_formas_pagamento" ON public.saas_formas_pagamento
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_saas_formas_pagamento_upd BEFORE UPDATE ON public.saas_formas_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.saas_lancamentos_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('receita','despesa')),
  origem text NOT NULL DEFAULT 'manual',
  base_cliente_id uuid REFERENCES public.bases_clientes(id) ON DELETE SET NULL,
  sistema_saas_id uuid REFERENCES public.sistemas_saas(id) ON DELETE SET NULL,
  cobranca_id uuid REFERENCES public.base_cobrancas(id) ON DELETE SET NULL,
  compra_avulsa_id uuid REFERENCES public.base_compras_avulsas(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.base_contratos(id) ON DELETE SET NULL,
  nota_fiscal_id uuid, fornecedor_nome text, descricao text,
  categoria_id uuid REFERENCES public.saas_categorias_financeiras(id) ON DELETE SET NULL,
  centro_custo_id uuid REFERENCES public.saas_centros_custo(id) ON DELETE SET NULL,
  conta_bancaria_id uuid REFERENCES public.saas_contas_bancarias(id) ON DELETE SET NULL,
  forma_pagamento_prevista text, forma_pagamento_real text,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  data_competencia date, data_vencimento date, data_pagamento date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','vencido','cancelado')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid, atualizado_por uuid
);
CREATE INDEX IF NOT EXISTS idx_saas_lanc_status ON public.saas_lancamentos_financeiros(status);
CREATE INDEX IF NOT EXISTS idx_saas_lanc_venc ON public.saas_lancamentos_financeiros(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_saas_lanc_cob ON public.saas_lancamentos_financeiros(cobranca_id);
CREATE INDEX IF NOT EXISTS idx_saas_lanc_compra ON public.saas_lancamentos_financeiros(compra_avulsa_id);
CREATE INDEX IF NOT EXISTS idx_saas_lanc_base ON public.saas_lancamentos_financeiros(base_cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_lancamentos_financeiros TO authenticated;
GRANT ALL ON public.saas_lancamentos_financeiros TO service_role;
ALTER TABLE public.saas_lancamentos_financeiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia saas_lancamentos" ON public.saas_lancamentos_financeiros
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_saas_lancamentos_upd BEFORE UPDATE ON public.saas_lancamentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Seeds
INSERT INTO public.saas_categorias_financeiras (nome, tipo, ordem) VALUES
  ('Mensalidades','receita',1),('Implantação','receita',2),('Usuários adicionais','receita',3),
  ('Lojas adicionais','receita',4),('Armazenamento adicional','receita',5),('Módulos extras','receita',6),
  ('Treinamento','receita',7),('Suporte','receita',8),('Customização','receita',9),
  ('Integração','receita',10),('Outras receitas','receita',99),
  ('Infraestrutura','despesa',1),('Servidores','despesa',2),('Desenvolvimento','despesa',3),
  ('Suporte','despesa',4),('Marketing','despesa',5),('Comercial','despesa',6),('Impostos','despesa',7),
  ('Ferramentas','despesa',8),('Contabilidade','despesa',9),('Despesas administrativas','despesa',10),
  ('Outras despesas','despesa',99);

INSERT INTO public.saas_centros_custo (nome, ordem) VALUES
  ('Administrativo SaaS',1),('Comercial SaaS',2),('Suporte',3),('Desenvolvimento',4),
  ('Infraestrutura',5),('Marketing',6),('Financeiro SaaS',7),('Implantação',8),('Geral',9);

INSERT INTO public.saas_formas_pagamento (nome, tipo, ordem) VALUES
  ('Pix','pix',1),('Boleto','boleto',2),('Cartão de Crédito','cartao_credito',3),
  ('Cartão de Débito','cartao_debito',4),('Transferência','transferencia',5),
  ('Dinheiro','dinheiro',6),('Outro','outro',9);


-- Sync trigger base_cobrancas -> saas_lancamentos_financeiros
CREATE OR REPLACE FUNCTION public.sync_saas_lancamento_from_cobranca()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sistema_id uuid; v_categoria_id uuid; v_centro_id uuid; v_lanc_id uuid; v_status text;
BEGIN
  v_status := CASE NEW.status WHEN 'pago' THEN 'pago' WHEN 'cancelado' THEN 'cancelado' WHEN 'vencido' THEN 'vencido' ELSE 'pendente' END;
  SELECT sistema_saas_id INTO v_sistema_id FROM bases_clientes WHERE id = NEW.base_cliente_id;
  SELECT id INTO v_categoria_id FROM saas_categorias_financeiras
   WHERE tipo='receita' AND lower(nome)= CASE
      WHEN NEW.tipo_cobranca='mensalidade' THEN 'mensalidades'
      WHEN NEW.tipo_cobranca='implantacao' THEN 'implantação'
      WHEN NEW.tipo_cobranca='usuario_adicional' THEN 'usuários adicionais'
      WHEN NEW.tipo_cobranca='loja_adicional' THEN 'lojas adicionais'
      WHEN NEW.tipo_cobranca='armazenamento_adicional' THEN 'armazenamento adicional'
      WHEN NEW.tipo_cobranca='modulo_extra' THEN 'módulos extras'
      WHEN NEW.tipo_cobranca='treinamento' THEN 'treinamento'
      WHEN NEW.tipo_cobranca='suporte' THEN 'suporte'
      WHEN NEW.tipo_cobranca='customizacao' THEN 'customização'
      WHEN NEW.tipo_cobranca='integracao' THEN 'integração'
      ELSE 'outras receitas' END LIMIT 1;
  SELECT id INTO v_centro_id FROM saas_centros_custo WHERE nome='Comercial SaaS' LIMIT 1;
  SELECT id INTO v_lanc_id FROM saas_lancamentos_financeiros WHERE cobranca_id = NEW.id LIMIT 1;

  IF v_lanc_id IS NULL THEN
    INSERT INTO saas_lancamentos_financeiros (
      tipo, origem, base_cliente_id, sistema_saas_id, cobranca_id, contrato_id,
      descricao, categoria_id, centro_custo_id, forma_pagamento_prevista, forma_pagamento_real,
      valor, data_competencia, data_vencimento, data_pagamento, status
    ) VALUES (
      'receita','cobranca_saas', NEW.base_cliente_id, v_sistema_id, NEW.id, NEW.contrato_id,
      COALESCE(NEW.descricao, NEW.tipo_cobranca), v_categoria_id, v_centro_id,
      NEW.forma_pagamento, CASE WHEN NEW.status='pago' THEN NEW.forma_pagamento END,
      NEW.valor,
      CASE WHEN NEW.competencia_ano IS NOT NULL AND NEW.competencia_mes IS NOT NULL
           THEN make_date(NEW.competencia_ano, NEW.competencia_mes, 1) END,
      NEW.data_vencimento, NEW.data_pagamento, v_status);
  ELSE
    UPDATE saas_lancamentos_financeiros SET
      base_cliente_id = NEW.base_cliente_id, sistema_saas_id = v_sistema_id, contrato_id = NEW.contrato_id,
      descricao = COALESCE(NEW.descricao, NEW.tipo_cobranca),
      valor = CASE WHEN status='pago' THEN valor ELSE NEW.valor END,
      data_vencimento = CASE WHEN status='pago' THEN data_vencimento ELSE NEW.data_vencimento END,
      data_pagamento = NEW.data_pagamento,
      forma_pagamento_prevista = COALESCE(forma_pagamento_prevista, NEW.forma_pagamento),
      forma_pagamento_real = CASE WHEN NEW.status='pago' THEN COALESCE(forma_pagamento_real, NEW.forma_pagamento) ELSE forma_pagamento_real END,
      status = v_status
    WHERE id = v_lanc_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_saas_lanc_cob ON public.base_cobrancas;
CREATE TRIGGER trg_sync_saas_lanc_cob
AFTER INSERT OR UPDATE ON public.base_cobrancas
FOR EACH ROW EXECUTE FUNCTION public.sync_saas_lancamento_from_cobranca();

-- Backfill
INSERT INTO public.saas_lancamentos_financeiros (
  tipo, origem, base_cliente_id, sistema_saas_id, cobranca_id, contrato_id,
  descricao, valor, data_competencia, data_vencimento, data_pagamento, status, forma_pagamento_prevista, forma_pagamento_real
)
SELECT 'receita','cobranca_saas', c.base_cliente_id, b.sistema_saas_id, c.id, c.contrato_id,
       COALESCE(c.descricao, c.tipo_cobranca), c.valor,
       CASE WHEN c.competencia_ano IS NOT NULL AND c.competencia_mes IS NOT NULL
            THEN make_date(c.competencia_ano, c.competencia_mes, 1) END,
       c.data_vencimento, c.data_pagamento,
       CASE c.status WHEN 'pago' THEN 'pago' WHEN 'cancelado' THEN 'cancelado' WHEN 'vencido' THEN 'vencido' ELSE 'pendente' END,
       c.forma_pagamento,
       CASE WHEN c.status='pago' THEN c.forma_pagamento END
FROM public.base_cobrancas c
LEFT JOIN public.bases_clientes b ON b.id = c.base_cliente_id
WHERE NOT EXISTS (SELECT 1 FROM public.saas_lancamentos_financeiros l WHERE l.cobranca_id = c.id);

-- Permissões
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('sistema.financeiro_saas_receber','view','Financeiro SaaS - A Receber','sistema'),
  ('sistema.financeiro_saas_pagar','view','Financeiro SaaS - A Pagar','sistema'),
  ('sistema.financeiro_saas_config','view','Financeiro SaaS - Configurações','sistema'),
  ('sistema.financeiro_saas_relatorios','view','Financeiro SaaS - Relatórios','sistema')
ON CONFLICT (modulo, acao) DO NOTHING;
