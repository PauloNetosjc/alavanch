
CREATE TABLE public.base_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_cliente_id uuid NOT NULL REFERENCES public.bases_clientes(id) ON DELETE CASCADE,
  plano text NOT NULL DEFAULT 'personalizado',
  status_assinatura text NOT NULL DEFAULT 'ativa',
  valor_implantacao numeric(14,2) NOT NULL DEFAULT 0,
  implantacao_paga boolean NOT NULL DEFAULT false,
  valor_mensal numeric(14,2) NOT NULL DEFAULT 0,
  dia_vencimento int NOT NULL DEFAULT 10,
  forma_pagamento text,
  lojas_incluidas int NOT NULL DEFAULT 1,
  usuarios_incluidos int NOT NULL DEFAULT 5,
  valor_loja_adicional numeric(14,2) NOT NULL DEFAULT 0,
  valor_usuario_adicional numeric(14,2) NOT NULL DEFAULT 0,
  armazenamento_incluido_mb numeric(14,2) NOT NULL DEFAULT 0,
  armazenamento_adicional_mb numeric(14,2) NOT NULL DEFAULT 0,
  valor_por_gb_adicional numeric(14,2) NOT NULL DEFAULT 0,
  armazenamento_usado_mb numeric(14,2) NOT NULL DEFAULT 0,
  observacoes text,
  data_inicio date,
  data_cancelamento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  atualizado_por uuid
);
CREATE INDEX idx_base_assinaturas_base ON public.base_assinaturas(base_cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_assinaturas TO authenticated;
GRANT ALL ON public.base_assinaturas TO service_role;
ALTER TABLE public.base_assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin pode gerenciar assinaturas" ON public.base_assinaturas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.base_cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_cliente_id uuid NOT NULL REFERENCES public.bases_clientes(id) ON DELETE CASCADE,
  assinatura_id uuid REFERENCES public.base_assinaturas(id) ON DELETE SET NULL,
  tipo_cobranca text NOT NULL,
  descricao text,
  competencia_mes int,
  competencia_ano int,
  data_vencimento date,
  data_pagamento date,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  forma_pagamento text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  atualizado_por uuid
);
CREATE INDEX idx_base_cobrancas_base ON public.base_cobrancas(base_cliente_id);
CREATE INDEX idx_base_cobrancas_status ON public.base_cobrancas(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_cobrancas TO authenticated;
GRANT ALL ON public.base_cobrancas TO service_role;
ALTER TABLE public.base_cobrancas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin pode gerenciar cobrancas" ON public.base_cobrancas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.base_compras_avulsas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_cliente_id uuid NOT NULL REFERENCES public.bases_clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  quantidade_armazenamento_mb numeric(14,2) DEFAULT 0,
  data_compra date NOT NULL DEFAULT current_date,
  status_pagamento text NOT NULL DEFAULT 'pendente',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  atualizado_por uuid
);
CREATE INDEX idx_base_compras_base ON public.base_compras_avulsas(base_cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_compras_avulsas TO authenticated;
GRANT ALL ON public.base_compras_avulsas TO service_role;
ALTER TABLE public.base_compras_avulsas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin pode gerenciar compras avulsas" ON public.base_compras_avulsas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_base_assinaturas_updated BEFORE UPDATE ON public.base_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_base_cobrancas_updated BEFORE UPDATE ON public.base_cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_base_compras_updated BEFORE UPDATE ON public.base_compras_avulsas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo)
VALUES ('sistema.cobranca_bases', 'view', 'Gerenciar assinatura e cobrança das bases/clientes do SaaS', 'sistema')
ON CONFLICT DO NOTHING;
