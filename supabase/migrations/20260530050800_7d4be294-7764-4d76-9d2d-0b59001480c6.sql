CREATE TABLE IF NOT EXISTS public.sistemas_saas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  descricao text,
  status text NOT NULL DEFAULT 'ativo',
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  atualizado_por uuid,
  CONSTRAINT sistemas_saas_status_chk CHECK (status IN ('ativo','inativo','em_desenvolvimento','descontinuado'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistemas_saas TO authenticated;
GRANT ALL ON public.sistemas_saas TO service_role;

ALTER TABLE public.sistemas_saas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sistemas_saas_select_auth" ON public.sistemas_saas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sistemas_saas_admin_write" ON public.sistemas_saas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.empresa_saas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text,
  nome_fantasia text,
  cnpj text,
  inscricao_estadual text,
  inscricao_municipal text,
  endereco text,
  cidade text,
  estado text,
  cep text,
  telefone text,
  email text,
  site text,
  responsavel_legal text,
  responsavel_cpf text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_saas_config TO authenticated;
GRANT ALL ON public.empresa_saas_config TO service_role;

ALTER TABLE public.empresa_saas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_saas_config_select_auth" ON public.empresa_saas_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "empresa_saas_config_admin_write" ON public.empresa_saas_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.bases_clientes
  ADD COLUMN IF NOT EXISTS sistema_saas_id uuid REFERENCES public.sistemas_saas(id);

CREATE TRIGGER trg_sistemas_saas_updated
  BEFORE UPDATE ON public.sistemas_saas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_empresa_saas_config_updated
  BEFORE UPDATE ON public.empresa_saas_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sistemas_saas (nome, slug, descricao, status, ativo, ordem) VALUES
  ('Alavanch ERP', 'alavanch-erp', 'ERP completo: comercial, financeiro, fábrica, contratos e workflow operacional.', 'ativo', true, 1),
  ('Sistema RH', 'sistema-rh', 'Sistema de gestão de pessoas: cadastro, ponto, escalas e relatórios de RH.', 'em_desenvolvimento', true, 2)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.bases_clientes
  SET sistema_saas_id = (SELECT id FROM public.sistemas_saas WHERE slug = 'alavanch-erp')
  WHERE sistema_saas_id IS NULL;

INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('sistema.empresa_saas', 'view', 'Visualizar dados da empresa SaaS', 'Sistema SaaS'),
  ('sistema.empresa_saas', 'edit', 'Editar dados da empresa SaaS', 'Sistema SaaS'),
  ('sistema.sistemas_saas', 'view', 'Visualizar catálogo de sistemas vendidos', 'Sistema SaaS'),
  ('sistema.sistemas_saas', 'edit', 'Editar catálogo de sistemas vendidos', 'Sistema SaaS')
ON CONFLICT (modulo, acao) DO NOTHING;
