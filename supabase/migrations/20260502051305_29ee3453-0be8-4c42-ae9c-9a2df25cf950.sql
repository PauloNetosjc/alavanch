-- Tabela de metas mensais (por loja e opcionalmente por vendedor)
CREATE TABLE IF NOT EXISTS public.metas_vendas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid NOT NULL,
  vendedor_id uuid NULL,
  ano int NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta_valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, vendedor_id, ano, mes)
);

ALTER TABLE public.metas_vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY metas_vendas_select ON public.metas_vendas FOR SELECT TO authenticated
  USING (loja_id = current_loja_id() OR has_role(auth.uid(),'admin'));
CREATE POLICY metas_vendas_admin ON public.metas_vendas FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_metas_vendas_updated BEFORE UPDATE ON public.metas_vendas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de configurações da empresa (uma por loja)
CREATE TABLE IF NOT EXISTS public.configuracoes_empresa (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid NOT NULL UNIQUE,
  -- Dados básicos
  nome_empresa text,
  cnpj text,
  inscricao_estadual text,
  telefone text,
  email text,
  website text,
  endereco text,
  -- Políticas
  markup_padrao numeric DEFAULT 298,
  desconto_maximo numeric DEFAULT 10,
  prazo_padrao_dias int DEFAULT 60,
  mostrar_desconto_contrato boolean DEFAULT true,
  -- Formação de preço
  frete_compra_perc numeric DEFAULT 15,
  icms_compra_perc numeric DEFAULT 0,
  montagem_perc numeric DEFAULT 6,
  imp_saida_perc numeric DEFAULT 4,
  outros_perc numeric DEFAULT 1,
  -- Tabela de comissões consultores (faixas)
  comissao_bronze_ate numeric DEFAULT 180000,
  comissao_bronze_perc numeric DEFAULT 3,
  comissao_prata_ate numeric DEFAULT 300000,
  comissao_prata_perc numeric DEFAULT 4,
  comissao_ouro_perc numeric DEFAULT 5,
  -- Taxas financeiras
  taxa_modo text DEFAULT 'variavel', -- 'fixa' | 'variavel'
  taxa_responsavel text DEFAULT 'cliente', -- 'cliente' | 'empresa'
  taxa_fixa_perc numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY config_empresa_select ON public.configuracoes_empresa FOR SELECT TO authenticated
  USING (loja_id = current_loja_id() OR has_role(auth.uid(),'admin'));
CREATE POLICY config_empresa_admin ON public.configuracoes_empresa FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_config_empresa_updated BEFORE UPDATE ON public.configuracoes_empresa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();