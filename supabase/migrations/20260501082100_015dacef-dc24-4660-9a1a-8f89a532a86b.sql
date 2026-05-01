ALTER TABLE public.assistencias 
  ADD COLUMN IF NOT EXISTS motivo_nao_conclusao text,
  ADD COLUMN IF NOT EXISTS concluida_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false;