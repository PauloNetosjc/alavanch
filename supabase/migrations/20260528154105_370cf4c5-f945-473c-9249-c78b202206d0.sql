
ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS entidade_tipo text,
  ADD COLUMN IF NOT EXISTS entidade_id uuid,
  ADD COLUMN IF NOT EXISTS entidade_nome text;

CREATE INDEX IF NOT EXISTS idx_lancamentos_entidade
  ON public.lancamentos_financeiros (entidade_tipo, entidade_id);
