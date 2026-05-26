ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS baixado_por uuid,
  ADD COLUMN IF NOT EXISTS baixado_em timestamptz;