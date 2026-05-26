
-- Aprovação de lançamentos financeiros
ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS aprovacao_status text NOT NULL DEFAULT 'pendente_aprovacao',
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovacao_motivo text;

CREATE INDEX IF NOT EXISTS idx_lanc_aprov_status ON public.lancamentos_financeiros(aprovacao_status);

-- Marca lançamentos antigos como aprovados (compatibilidade retroativa)
UPDATE public.lancamentos_financeiros
SET aprovacao_status = 'aprovado'
WHERE aprovacao_status = 'pendente_aprovacao' AND created_at < now();

-- Tabela de aprovadores parametrizáveis
CREATE TABLE IF NOT EXISTS public.aprovadores_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  aprova_pagar boolean NOT NULL DEFAULT false,
  aprova_receber boolean NOT NULL DEFAULT false,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, loja_id)
);

ALTER TABLE public.aprovadores_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aprov_select_auth" ON public.aprovadores_financeiros
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "aprov_admin_all" ON public.aprovadores_financeiros
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
