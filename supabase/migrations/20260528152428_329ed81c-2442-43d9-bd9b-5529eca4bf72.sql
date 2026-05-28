ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS endereco_cobranca text,
  ADD COLUMN IF NOT EXISTS endereco_entrega text;