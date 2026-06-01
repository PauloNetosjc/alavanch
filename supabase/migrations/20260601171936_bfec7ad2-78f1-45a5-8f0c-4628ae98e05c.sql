
-- 1. origem_ambiente
ALTER TABLE public.ambientes ADD COLUMN IF NOT EXISTS origem_ambiente text NOT NULL DEFAULT 'manual';

-- 2. orcamento_negociacoes (histórico/versões)
CREATE TABLE IF NOT EXISTS public.orcamento_negociacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  loja_id uuid,
  versao integer NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  valor_bruto numeric NOT NULL DEFAULT 0,
  percentual_desconto_manual numeric NOT NULL DEFAULT 0,
  valor_desconto_manual numeric NOT NULL DEFAULT 0,
  forma_pagamento_id uuid,
  percentual_desconto_forma_pagamento numeric NOT NULL DEFAULT 0,
  valor_desconto_forma_pagamento numeric NOT NULL DEFAULT 0,
  valor_apos_desconto_forma_pagamento numeric NOT NULL DEFAULT 0,
  valor_entrada numeric NOT NULL DEFAULT 0,
  forma_pagamento_entrada_id uuid,
  percentual_desconto_entrada numeric NOT NULL DEFAULT 0,
  valor_desconto_entrada numeric NOT NULL DEFAULT 0,
  valor_final_negociado numeric NOT NULL DEFAULT 0,
  saldo_a_parcelar numeric NOT NULL DEFAULT 0,
  quantidade_parcelas integer NOT NULL DEFAULT 1,
  valor_parcela numeric NOT NULL DEFAULT 0,
  observacoes text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_negociacoes TO authenticated;
GRANT ALL ON public.orcamento_negociacoes TO service_role;

ALTER TABLE public.orcamento_negociacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "neg_select" ON public.orcamento_negociacoes FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR pode_acessar_loja(loja_de_orcamento(orcamento_id)));
CREATE POLICY "neg_insert" ON public.orcamento_negociacoes FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_orcamento(orcamento_id)));
CREATE POLICY "neg_update" ON public.orcamento_negociacoes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR pode_acessar_loja(loja_de_orcamento(orcamento_id)));
CREATE POLICY "neg_delete" ON public.orcamento_negociacoes FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE UNIQUE INDEX IF NOT EXISTS idx_orc_neg_versao ON public.orcamento_negociacoes(orcamento_id, versao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orc_neg_uma_ativa
  ON public.orcamento_negociacoes(orcamento_id) WHERE status = 'ativa';

CREATE OR REPLACE FUNCTION public.tg_orcamento_negociacoes_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_orc_neg_updated_at ON public.orcamento_negociacoes;
CREATE TRIGGER trg_orc_neg_updated_at BEFORE UPDATE ON public.orcamento_negociacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_orcamento_negociacoes_updated_at();

-- Catálogo de permissão (opcional, ignora erro se não existir)
DO $$ BEGIN
  INSERT INTO public.permissoes_modulos_catalogo (chave, modulo, descricao)
  VALUES ('orcamento.negociacao_tab','Comercial','Acessar aba Negociação no editor de orçamento')
  ON CONFLICT (chave) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;
