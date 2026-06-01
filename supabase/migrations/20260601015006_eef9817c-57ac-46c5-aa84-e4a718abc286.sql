
-- =========================================================
-- FASE FISCAL 1 — Estrutura base
-- =========================================================

-- ---------- 1) configuracoes_fiscais ----------
CREATE TABLE IF NOT EXISTS public.configuracoes_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL UNIQUE REFERENCES public.lojas(id) ON DELETE CASCADE,
  razao_social text,
  nome_fantasia text,
  cnpj text,
  inscricao_estadual text,
  inscricao_municipal text,
  regime_tributario text CHECK (regime_tributario IN ('simples_nacional','lucro_presumido','lucro_real')),
  crt smallint,
  cnae_principal text,
  uf text,
  municipio text,
  codigo_municipio_ibge text,
  ambiente text NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao','producao')),
  emitir_nfe boolean NOT NULL DEFAULT false,
  emitir_nfse boolean NOT NULL DEFAULT false,
  serie_nfe integer DEFAULT 1,
  proximo_numero_nfe integer DEFAULT 1,
  serie_nfse integer DEFAULT 1,
  proximo_numero_rps integer DEFAULT 1,
  provedor_nfse text CHECK (provedor_nfse IN ('nacional','prefeitura_sp','ginfes','betha','issnet','webiss','outro')),
  codigo_servico_municipal text,
  aliquota_iss_padrao numeric(6,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_fiscais TO authenticated;
GRANT ALL ON public.configuracoes_fiscais TO service_role;
ALTER TABLE public.configuracoes_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY cf_select ON public.configuracoes_fiscais FOR SELECT TO authenticated
  USING (loja_id = current_loja_id() OR has_role(auth.uid(),'admin'));
CREATE POLICY cf_insert ON public.configuracoes_fiscais FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'fiscal_configuracao','edit'));
CREATE POLICY cf_update ON public.configuracoes_fiscais FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR (loja_id = current_loja_id() AND has_permission(auth.uid(),'fiscal_configuracao','edit')));
CREATE POLICY cf_delete ON public.configuracoes_fiscais FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- ---------- 2) produtos_fiscais ----------
CREATE TABLE IF NOT EXISTS public.produtos_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ncm text,
  cest text,
  cfop_padrao text,
  origem_mercadoria smallint,
  cst_icms text,
  csosn text,
  cst_pis text,
  cst_cofins text,
  cst_ipi text,
  unidade_comercial text,
  unidade_tributavel text,
  aliquota_icms numeric(6,4),
  aliquota_pis numeric(6,4),
  aliquota_cofins numeric(6,4),
  aliquota_ipi numeric(6,4),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_produtos_fiscais_loja ON public.produtos_fiscais(loja_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_fiscais TO authenticated;
GRANT ALL ON public.produtos_fiscais TO service_role;
ALTER TABLE public.produtos_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY pf_select ON public.produtos_fiscais FOR SELECT TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(),'admin'));
CREATE POLICY pf_insert ON public.produtos_fiscais FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'produtos_fiscais','create'));
CREATE POLICY pf_update ON public.produtos_fiscais FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR (has_permission(auth.uid(),'produtos_fiscais','edit') AND (loja_id IS NULL OR loja_id = current_loja_id())));
CREATE POLICY pf_delete ON public.produtos_fiscais FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- ---------- 3) servicos_fiscais ----------
CREATE TABLE IF NOT EXISTS public.servicos_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  codigo_lc116 text,
  codigo_servico_municipal text,
  cnae text,
  aliquota_iss numeric(6,4),
  iss_retido boolean NOT NULL DEFAULT false,
  municipio_incidencia text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_servicos_fiscais_loja ON public.servicos_fiscais(loja_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicos_fiscais TO authenticated;
GRANT ALL ON public.servicos_fiscais TO service_role;
ALTER TABLE public.servicos_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY sf_select ON public.servicos_fiscais FOR SELECT TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(),'admin'));
CREATE POLICY sf_insert ON public.servicos_fiscais FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'servicos_fiscais','create'));
CREATE POLICY sf_update ON public.servicos_fiscais FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR (has_permission(auth.uid(),'servicos_fiscais','edit') AND (loja_id IS NULL OR loja_id = current_loja_id())));
CREATE POLICY sf_delete ON public.servicos_fiscais FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- ---------- 4) Ampliar notas_fiscais ----------
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS contrato_id uuid,
  ADD COLUMN IF NOT EXISTS modelo text,
  ADD COLUMN IF NOT EXISTS ambiente text DEFAULT 'homologacao',
  ADD COLUMN IF NOT EXISTS valor_impostos numeric(14,2),
  ADD COLUMN IF NOT EXISTS mensagem_retorno text,
  ADD COLUMN IF NOT EXISTS codigo_retorno text,
  ADD COLUMN IF NOT EXISTS data_autorizacao timestamptz,
  ADD COLUMN IF NOT EXISTS data_cancelamento timestamptz,
  ADD COLUMN IF NOT EXISTS atualizado_por uuid,
  ADD COLUMN IF NOT EXISTS danfe_storage_path text;

-- ---------- 5) notas_fiscais_itens ----------
CREATE TABLE IF NOT EXISTS public.notas_fiscais_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  tipo_item text NOT NULL CHECK (tipo_item IN ('produto','servico')),
  produto_fiscal_id uuid REFERENCES public.produtos_fiscais(id) ON DELETE SET NULL,
  servico_fiscal_id uuid REFERENCES public.servicos_fiscais(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  quantidade numeric(14,4) NOT NULL DEFAULT 1,
  unidade text,
  valor_unitario numeric(14,4) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  ncm text,
  cfop text,
  cst text,
  csosn text,
  aliquota numeric(6,4),
  valor_imposto numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nfi_nota ON public.notas_fiscais_itens(nota_fiscal_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais_itens TO authenticated;
GRANT ALL ON public.notas_fiscais_itens TO service_role;
ALTER TABLE public.notas_fiscais_itens ENABLE ROW LEVEL SECURITY;

-- Visibilidade segue a nota fiscal pai
CREATE POLICY nfi_select ON public.notas_fiscais_itens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notas_fiscais n WHERE n.id = notas_fiscais_itens.nota_fiscal_id
      AND (n.loja_id IS NULL OR n.loja_id = current_loja_id() OR has_role(auth.uid(),'admin'))
  ));
CREATE POLICY nfi_insert ON public.notas_fiscais_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.notas_fiscais n WHERE n.id = notas_fiscais_itens.nota_fiscal_id
      AND (n.loja_id IS NULL OR n.loja_id = current_loja_id() OR has_role(auth.uid(),'admin'))
  ));
CREATE POLICY nfi_update ON public.notas_fiscais_itens FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notas_fiscais n WHERE n.id = notas_fiscais_itens.nota_fiscal_id
      AND (n.loja_id IS NULL OR n.loja_id = current_loja_id() OR has_role(auth.uid(),'admin'))
  ));
CREATE POLICY nfi_delete ON public.notas_fiscais_itens FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notas_fiscais n WHERE n.id = notas_fiscais_itens.nota_fiscal_id
      AND (n.loja_id IS NULL OR n.loja_id = current_loja_id() OR has_role(auth.uid(),'admin'))
  ));

-- ---------- 6) notas_fiscais_eventos ----------
CREATE TABLE IF NOT EXISTS public.notas_fiscais_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL,
  status_anterior text,
  status_novo text,
  codigo_retorno text,
  mensagem text,
  xml_evento_storage_path text,
  protocolo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid
);
CREATE INDEX IF NOT EXISTS idx_nfe_nota ON public.notas_fiscais_eventos(nota_fiscal_id);

GRANT SELECT, INSERT ON public.notas_fiscais_eventos TO authenticated;
GRANT ALL ON public.notas_fiscais_eventos TO service_role;
ALTER TABLE public.notas_fiscais_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY nfev_select ON public.notas_fiscais_eventos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notas_fiscais n WHERE n.id = notas_fiscais_eventos.nota_fiscal_id
      AND (n.loja_id IS NULL OR n.loja_id = current_loja_id() OR has_role(auth.uid(),'admin'))
  ));
CREATE POLICY nfev_insert ON public.notas_fiscais_eventos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.notas_fiscais n WHERE n.id = notas_fiscais_eventos.nota_fiscal_id
      AND (n.loja_id IS NULL OR n.loja_id = current_loja_id() OR has_role(auth.uid(),'admin'))
  ));

-- ---------- 7) Ampliar certificados_digitais ----------
ALTER TABLE public.certificados_digitais
  ADD COLUMN IF NOT EXISTS configuracao_fiscal_id uuid REFERENCES public.configuracoes_fiscais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_certificado text NOT NULL DEFAULT 'A1',
  ADD COLUMN IF NOT EXISTS cnpj_certificado text,
  ADD COLUMN IF NOT EXISTS razao_social_certificado text,
  ADD COLUMN IF NOT EXISTS ultimo_teste_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_uso_em timestamptz;

-- Restringir SELECT por loja (atual está só admin)
DROP POLICY IF EXISTS cert_select_admin ON public.certificados_digitais;
CREATE POLICY cert_select ON public.certificados_digitais FOR SELECT TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(),'admin'));

-- ---------- 8) Catálogo de permissões ----------
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('fiscal_configuracao','view','Visualizar configurações fiscais','Fiscal'),
  ('fiscal_configuracao','edit','Editar configurações fiscais','Fiscal'),
  ('certificados_digitais','view','Visualizar certificados digitais','Fiscal'),
  ('certificados_digitais','edit','Enviar/substituir certificados digitais','Fiscal'),
  ('produtos_fiscais','view','Visualizar produtos fiscais','Fiscal'),
  ('produtos_fiscais','create','Criar produtos fiscais','Fiscal'),
  ('produtos_fiscais','edit','Editar produtos fiscais','Fiscal'),
  ('produtos_fiscais','delete','Excluir produtos fiscais','Fiscal'),
  ('servicos_fiscais','view','Visualizar serviços fiscais','Fiscal'),
  ('servicos_fiscais','create','Criar serviços fiscais','Fiscal'),
  ('servicos_fiscais','edit','Editar serviços fiscais','Fiscal'),
  ('servicos_fiscais','delete','Excluir serviços fiscais','Fiscal')
ON CONFLICT (modulo, acao) DO NOTHING;

-- ---------- 9) Trigger de updated_at ----------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS cf_updated_at ON public.configuracoes_fiscais;
CREATE TRIGGER cf_updated_at BEFORE UPDATE ON public.configuracoes_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS pf_updated_at ON public.produtos_fiscais;
CREATE TRIGGER pf_updated_at BEFORE UPDATE ON public.produtos_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS sf_updated_at ON public.servicos_fiscais;
CREATE TRIGGER sf_updated_at BEFORE UPDATE ON public.servicos_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- 10) Storage policies ----------
-- Bucket certificados-digitais (privado) — admin gerencia; usuários só veem pelo backend.
DROP POLICY IF EXISTS "cert_storage_admin_all" ON storage.objects;
CREATE POLICY "cert_storage_admin_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'certificados-digitais' AND has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'certificados-digitais' AND has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "cert_storage_upload_perm" ON storage.objects;
CREATE POLICY "cert_storage_upload_perm" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificados-digitais' AND has_permission(auth.uid(),'certificados_digitais','edit'));

-- Bucket notas-fiscais (privado) — leitura por usuário autenticado da loja, escrita por admin/backend.
DROP POLICY IF EXISTS "nf_storage_read" ON storage.objects;
CREATE POLICY "nf_storage_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'notas-fiscais');

DROP POLICY IF EXISTS "nf_storage_write_admin" ON storage.objects;
CREATE POLICY "nf_storage_write_admin" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'notas-fiscais' AND has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'notas-fiscais' AND has_role(auth.uid(),'admin'));
