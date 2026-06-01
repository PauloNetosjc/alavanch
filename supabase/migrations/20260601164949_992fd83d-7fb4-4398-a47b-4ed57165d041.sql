CREATE TABLE IF NOT EXISTS public.formas_pagamento_entrada (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NULL,
  forma_pagamento_id UUID NULL REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  forma_pagamento TEXT NOT NULL,
  percentual_desconto NUMERIC NOT NULL DEFAULT 20,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formas_pagamento_entrada TO authenticated;
GRANT ALL ON public.formas_pagamento_entrada TO service_role;

ALTER TABLE public.formas_pagamento_entrada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formas_pagamento_entrada_select"
  ON public.formas_pagamento_entrada FOR SELECT TO authenticated USING (true);
CREATE POLICY "formas_pagamento_entrada_insert"
  ON public.formas_pagamento_entrada FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "formas_pagamento_entrada_update"
  ON public.formas_pagamento_entrada FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "formas_pagamento_entrada_delete"
  ON public.formas_pagamento_entrada FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_formas_pagamento_entrada_updated_at
  BEFORE UPDATE ON public.formas_pagamento_entrada
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.formas_pagamento_entrada (nome, forma_pagamento, percentual_desconto, ativo, observacoes)
VALUES
  ('Entrada à vista', 'Boleto', 20, true, 'Equivale ao desconto de 1x no boleto'),
  ('Entrada PIX', 'PIX', 20, true, 'Desconto padrão para entrada via PIX'),
  ('Entrada transferência', 'Transferência', 20, true, 'Desconto padrão para entrada via transferência')
ON CONFLICT DO NOTHING;