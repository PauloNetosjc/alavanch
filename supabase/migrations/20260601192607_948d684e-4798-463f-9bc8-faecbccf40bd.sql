CREATE TABLE public.orcamento_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Padrão',
  ativo BOOLEAN NOT NULL DEFAULT true,
  titulo TEXT,
  subtitulo TEXT,
  mostrar_logo BOOLEAN NOT NULL DEFAULT true,
  mostrar_dados_empresa BOOLEAN NOT NULL DEFAULT true,
  mostrar_dados_cliente BOOLEAN NOT NULL DEFAULT true,
  mostrar_descricao_ambientes BOOLEAN NOT NULL DEFAULT false,
  mostrar_itens_tecnicos BOOLEAN NOT NULL DEFAULT false,
  mostrar_resumo_descontos BOOLEAN NOT NULL DEFAULT true,
  mostrar_forma_pagamento BOOLEAN NOT NULL DEFAULT true,
  mostrar_condicoes_gerais BOOLEAN NOT NULL DEFAULT true,
  condicoes_gerais_html TEXT,
  rodape_html TEXT,
  observacoes_internas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_templates TO authenticated;
GRANT ALL ON public.orcamento_templates TO service_role;

ALTER TABLE public.orcamento_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view orcamento_templates"
  ON public.orcamento_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage orcamento_templates"
  ON public.orcamento_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_orcamento_templates_updated_at
  BEFORE UPDATE ON public.orcamento_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_orcamento_templates_loja ON public.orcamento_templates(loja_id);