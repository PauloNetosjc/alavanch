-- Fabrica: Requisições de Compra + permissões adicionais

CREATE TABLE IF NOT EXISTS public.fabrica_requisicoes_compra (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NULL,
  cliente_nome TEXT NULL,
  loja_id UUID NULL,
  ambiente TEXT NULL,
  item TEXT NOT NULL,
  descricao TEXT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  unidade TEXT NULL,
  fornecedor_id UUID NULL,
  fornecedor_nome TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  data_prevista DATE NULL,
  observacoes TEXT NULL,
  anexos JSONB NOT NULL DEFAULT '[]'::jsonb,
  comprovante_url TEXT NULL,
  liberado_sem_item BOOLEAN NOT NULL DEFAULT false,
  liberado_por UUID NULL,
  liberado_em TIMESTAMPTZ NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_freq_pedido ON public.fabrica_requisicoes_compra(pedido_id);
CREATE INDEX IF NOT EXISTS idx_freq_loja ON public.fabrica_requisicoes_compra(loja_id);
CREATE INDEX IF NOT EXISTS idx_freq_status ON public.fabrica_requisicoes_compra(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_requisicoes_compra TO authenticated;
GRANT ALL ON public.fabrica_requisicoes_compra TO service_role;

ALTER TABLE public.fabrica_requisicoes_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "freq_all" ON public.fabrica_requisicoes_compra FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_freq_updated BEFORE UPDATE ON public.fabrica_requisicoes_compra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Permissões: workflow + requisições + atalhos
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('fabrica_workflow', 'view', 'Acessar workflow da Fábrica', 'Fábrica'),
  ('fabrica_requisicoes_compra', 'view', 'Visualizar Requisições de Compra', 'Fábrica'),
  ('fabrica_requisicoes_compra', 'edit', 'Criar/editar/aprovar requisições de compra', 'Fábrica'),
  ('fabrica_atelie', 'view', 'Visualizar etapa Ateliê', 'Fábrica'),
  ('fabrica_atelie', 'edit', 'Mover peças e gerenciar Ateliê', 'Fábrica')
ON CONFLICT (modulo, acao) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  grupo = EXCLUDED.grupo;