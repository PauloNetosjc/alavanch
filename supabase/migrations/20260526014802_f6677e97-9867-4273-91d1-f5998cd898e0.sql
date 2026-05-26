
CREATE TABLE public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID,
  nome TEXT NOT NULL,
  documento TEXT,
  tipo_documento TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  contato TEXT,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  pix TEXT,
  categoria TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY fornecedores_select ON public.fornecedores FOR SELECT TO authenticated
USING ((loja_id IS NULL) OR (loja_id = current_loja_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY fornecedores_insert ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY fornecedores_update ON public.fornecedores FOR UPDATE TO authenticated
USING ((loja_id IS NULL) OR (loja_id = current_loja_id()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY fornecedores_delete ON public.fornecedores FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_fornecedores_updated_at
BEFORE UPDATE ON public.fornecedores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_fornecedores_loja ON public.fornecedores(loja_id);
CREATE INDEX idx_fornecedores_ativo ON public.fornecedores(ativo);
