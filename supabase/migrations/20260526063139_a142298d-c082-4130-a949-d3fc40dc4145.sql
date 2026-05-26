ALTER TABLE public.metodos_pagamento
ADD COLUMN IF NOT EXISTS parcelas_config jsonb NOT NULL DEFAULT '[]'::jsonb;