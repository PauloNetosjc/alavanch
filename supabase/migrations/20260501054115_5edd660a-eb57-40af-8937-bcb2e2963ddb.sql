
-- Templates de contrato (1 por loja por enquanto, mas permitimos múltiplos)
CREATE TABLE IF NOT EXISTS public.contratos_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Contrato Padrão',
  titulo TEXT NOT NULL DEFAULT 'CONTRATO DE COMPRA E VENDA',
  subtitulo TEXT DEFAULT 'CONTRATO DE COMPRA E VENDA DE PRODUTOS E DE PRESTAÇÃO DE SERVIÇOS',
  clausulas TEXT NOT NULL DEFAULT '',
  observacoes_padrao TEXT DEFAULT '',
  rodape TEXT DEFAULT '',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select" ON public.contratos_template
  FOR SELECT TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "templates_admin_all" ON public.contratos_template
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.contratos_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contratos gerados
CREATE TABLE IF NOT EXISTS public.contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE CASCADE NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.contratos_template(id) ON DELETE SET NULL,
  observacoes_adicionais TEXT,
  conteudo_snapshot JSONB,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aguardando_assinatura',
  signing_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  assinado_em TIMESTAMPTZ,
  assinatura_nome TEXT,
  assinatura_cpf TEXT,
  assinatura_ip TEXT,
  assinatura_data_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

-- Equipe interna
CREATE POLICY "contratos_select_internal" ON public.contratos
  FOR SELECT TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "contratos_insert" ON public.contratos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "contratos_update_internal" ON public.contratos
  FOR UPDATE TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "contratos_delete_admin" ON public.contratos
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Acesso público pelo token de assinatura: leitura e atualização (apenas para assinar)
CREATE POLICY "contratos_select_public_by_token" ON public.contratos
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "contratos_update_public_by_token" ON public.contratos
  FOR UPDATE TO anon
  USING (status = 'aguardando_assinatura')
  WITH CHECK (status IN ('aguardando_assinatura','assinado'));

CREATE TRIGGER trg_contratos_updated BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campo no orcamento para indicar conversão
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMPTZ;
