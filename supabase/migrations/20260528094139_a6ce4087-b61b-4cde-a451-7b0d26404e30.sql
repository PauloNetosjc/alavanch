ALTER TABLE public.solicitacoes_assinatura
  ADD COLUMN IF NOT EXISTS metodo_assinatura TEXT,
  ADD COLUMN IF NOT EXISTS assinado_manual_por UUID,
  ADD COLUMN IF NOT EXISTS assinado_manual_em TIMESTAMP WITH TIME ZONE;