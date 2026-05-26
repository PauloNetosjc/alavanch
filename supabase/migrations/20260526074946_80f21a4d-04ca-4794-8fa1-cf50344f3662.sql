CREATE TABLE public.formas_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formas_pagamento_select" ON public.formas_pagamento FOR SELECT USING (true);
CREATE POLICY "formas_pagamento_insert" ON public.formas_pagamento FOR INSERT WITH CHECK (true);
CREATE POLICY "formas_pagamento_update" ON public.formas_pagamento FOR UPDATE USING (true);
CREATE POLICY "formas_pagamento_delete" ON public.formas_pagamento FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.formas_pagamento (nome, ordem) VALUES
  ('Boleto', 1),
  ('PIX', 2),
  ('Cartão de Crédito', 3),
  ('Cartão de Débito', 4),
  ('Dinheiro', 5),
  ('Transferência', 6),
  ('Cheque', 7),
  ('Crediário Próprio', 8)
ON CONFLICT (nome) DO NOTHING;