
-- fiscal_cfops (global)
CREATE TABLE IF NOT EXISTS public.fiscal_cfops (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  tipo_movimento text NOT NULL CHECK (tipo_movimento IN ('entrada','saida')),
  categoria text NOT NULL CHECK (categoria IN ('venda','compra','devolucao','remessa','retorno','entrega_futura','industrializacao','transferencia','outro')),
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_cfops TO authenticated;
GRANT ALL ON public.fiscal_cfops TO service_role;
ALTER TABLE public.fiscal_cfops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiscal_cfops_select_auth" ON public.fiscal_cfops FOR SELECT TO authenticated USING (true);
CREATE POLICY "fiscal_cfops_insert_admin" ON public.fiscal_cfops FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "fiscal_cfops_update_admin" ON public.fiscal_cfops FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "fiscal_cfops_delete_admin" ON public.fiscal_cfops FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_fiscal_cfops_updated_at BEFORE UPDATE ON public.fiscal_cfops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- fiscal_operacoes
CREATE TABLE IF NOT EXISTS public.fiscal_operacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  cfop_id uuid REFERENCES public.fiscal_cfops(id) ON DELETE RESTRICT,
  codigo_cfop text,
  finalidade_nfe text NOT NULL DEFAULT 'normal' CHECK (finalidade_nfe IN ('normal','complementar','ajuste','devolucao')),
  tipo_nota text NOT NULL DEFAULT 'saida' CHECK (tipo_nota IN ('entrada','saida')),
  padrao boolean NOT NULL DEFAULT false,
  remessa_industrializacao boolean NOT NULL DEFAULT false,
  movimenta_estoque boolean NOT NULL DEFAULT true,
  movimenta_financeiro boolean NOT NULL DEFAULT true,
  exige_pedido boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fiscal_operacoes_loja ON public.fiscal_operacoes(loja_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_operacoes_cfop ON public.fiscal_operacoes(cfop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_operacoes TO authenticated;
GRANT ALL ON public.fiscal_operacoes TO service_role;
ALTER TABLE public.fiscal_operacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiscal_operacoes_select" ON public.fiscal_operacoes FOR SELECT TO authenticated USING (
  loja_id IS NULL OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = fiscal_operacoes.loja_id)
);
CREATE POLICY "fiscal_operacoes_insert" ON public.fiscal_operacoes FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (loja_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = fiscal_operacoes.loja_id))
);
CREATE POLICY "fiscal_operacoes_update" ON public.fiscal_operacoes FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR (loja_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = fiscal_operacoes.loja_id))
);
CREATE POLICY "fiscal_operacoes_delete" ON public.fiscal_operacoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_fiscal_operacoes_updated_at BEFORE UPDATE ON public.fiscal_operacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- fiscal_configuracoes_tributarias
CREATE TABLE IF NOT EXISTS public.fiscal_configuracoes_tributarias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  operacao_fiscal_id uuid NOT NULL REFERENCES public.fiscal_operacoes(id) ON DELETE CASCADE,
  grupo_tributario text NOT NULL DEFAULT 'nacional' CHECK (grupo_tributario IN ('nacional','importado','substituicao_tributaria','isento','outro')),
  destino_uf text,
  indicador_ie_destinatario text CHECK (indicador_ie_destinatario IN ('contribuinte_icms','contribuinte_isento','nao_contribuinte')),
  consumidor_final boolean NOT NULL DEFAULT true,
  contribuinte_icms boolean NOT NULL DEFAULT false,
  cfop_id uuid REFERENCES public.fiscal_cfops(id) ON DELETE RESTRICT,
  codigo_cfop text,
  icms_cst text, icms_csosn text, icms_origem text DEFAULT '0',
  icms_modalidade_bc text, icms_aliquota numeric(7,4) DEFAULT 0, icms_reducao_bc numeric(7,4) DEFAULT 0,
  icms_mva numeric(7,4) DEFAULT 0, icms_aliquota_st numeric(7,4) DEFAULT 0, icms_reducao_bc_st numeric(7,4) DEFAULT 0,
  icms_credito_simples_aliquota numeric(7,4) DEFAULT 0, icms_fcp_aliquota numeric(7,4) DEFAULT 0,
  icms_partilha_modo_calculo text,
  icms_interestadual_aliquota numeric(7,4) DEFAULT 0, icms_interno_aliquota numeric(7,4) DEFAULT 0,
  pis_cst text, pis_aliquota numeric(7,4) DEFAULT 0, pis_base_calculo numeric(7,4) DEFAULT 0,
  cofins_cst text, cofins_aliquota numeric(7,4) DEFAULT 0, cofins_base_calculo numeric(7,4) DEFAULT 0,
  ipi_cst text, ipi_aliquota numeric(7,4) DEFAULT 0, ipi_enquadramento text,
  adicionar_ipi_base_icms boolean NOT NULL DEFAULT false,
  adicionar_frete_base_icms boolean NOT NULL DEFAULT false,
  adicionar_seguro_base_icms boolean NOT NULL DEFAULT false,
  adicionar_outras_despesas_base_icms boolean NOT NULL DEFAULT false,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fct_loja ON public.fiscal_configuracoes_tributarias(loja_id);
CREATE INDEX IF NOT EXISTS idx_fct_operacao ON public.fiscal_configuracoes_tributarias(operacao_fiscal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_configuracoes_tributarias TO authenticated;
GRANT ALL ON public.fiscal_configuracoes_tributarias TO service_role;
ALTER TABLE public.fiscal_configuracoes_tributarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fct_select" ON public.fiscal_configuracoes_tributarias FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = fiscal_configuracoes_tributarias.loja_id)
);
CREATE POLICY "fct_insert" ON public.fiscal_configuracoes_tributarias FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = fiscal_configuracoes_tributarias.loja_id)
);
CREATE POLICY "fct_update" ON public.fiscal_configuracoes_tributarias FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = fiscal_configuracoes_tributarias.loja_id)
);
CREATE POLICY "fct_delete" ON public.fiscal_configuracoes_tributarias FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_fct_updated_at BEFORE UPDATE ON public.fiscal_configuracoes_tributarias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vínculos
ALTER TABLE public.produtos_fiscais
  ADD COLUMN IF NOT EXISTS grupo_tributario text,
  ADD COLUMN IF NOT EXISTS operacao_fiscal_padrao_id uuid REFERENCES public.fiscal_operacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS configuracao_tributaria_padrao_id uuid REFERENCES public.fiscal_configuracoes_tributarias(id) ON DELETE SET NULL;

ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS operacao_fiscal_id uuid REFERENCES public.fiscal_operacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS configuracao_tributaria_id uuid REFERENCES public.fiscal_configuracoes_tributarias(id) ON DELETE SET NULL;

ALTER TABLE public.notas_fiscais_itens ADD COLUMN IF NOT EXISTS cfop text;

-- Permissões
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('fiscal_cfops','visualizar','Visualizar CFOPs','Fiscal'),
  ('fiscal_cfops','criar','Criar CFOPs','Fiscal'),
  ('fiscal_cfops','editar','Editar CFOPs','Fiscal'),
  ('fiscal_cfops','excluir','Excluir CFOPs','Fiscal'),
  ('fiscal_operacoes','visualizar','Visualizar Operações Fiscais','Fiscal'),
  ('fiscal_operacoes','criar','Criar Operações Fiscais','Fiscal'),
  ('fiscal_operacoes','editar','Editar Operações Fiscais','Fiscal'),
  ('fiscal_operacoes','excluir','Excluir Operações Fiscais','Fiscal'),
  ('fiscal_configuracoes_tributarias','visualizar','Visualizar Configurações Tributárias','Fiscal'),
  ('fiscal_configuracoes_tributarias','criar','Criar Configurações Tributárias','Fiscal'),
  ('fiscal_configuracoes_tributarias','editar','Editar Configurações Tributárias','Fiscal'),
  ('fiscal_configuracoes_tributarias','excluir','Excluir Configurações Tributárias','Fiscal')
ON CONFLICT (modulo, acao) DO NOTHING;

-- Seeds CFOPs
INSERT INTO public.fiscal_cfops (codigo, descricao, tipo_movimento, categoria) VALUES
  ('5102','Venda de mercadoria adquirida ou recebida de terceiros','saida','venda'),
  ('5117','Venda de mercadoria adquirida ou recebida de terceiros para entrega futura','saida','entrega_futura'),
  ('5922','Lançamento efetuado a título de simples faturamento decorrente de venda para entrega futura','saida','entrega_futura'),
  ('1949','Outra entrada de mercadoria ou prestação de serviço não especificada','entrada','outro'),
  ('1202','Devolução de venda de mercadoria adquirida ou recebida de terceiros','entrada','devolucao'),
  ('5202','Devolução de compra para comercialização','saida','devolucao'),
  ('6102','Venda de mercadoria adquirida ou recebida de terceiros fora do estado','saida','venda')
ON CONFLICT (codigo) DO NOTHING;
