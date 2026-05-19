-- Política de juros (por loja e faixa de parcelas)
CREATE TABLE IF NOT EXISTS public.politica_juros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  responsavel text NOT NULL DEFAULT 'cliente' CHECK (responsavel IN ('cliente','loja')),
  faixa_min int NOT NULL DEFAULT 1,
  faixa_max int NOT NULL DEFAULT 12,
  perc_mes numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.politica_juros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS politica_juros_select ON public.politica_juros;
CREATE POLICY politica_juros_select ON public.politica_juros
  FOR SELECT TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS politica_juros_admin ON public.politica_juros;
CREATE POLICY politica_juros_admin ON public.politica_juros
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_politica_juros_loja ON public.politica_juros(loja_id);

-- RT repassado em comissões
ALTER TABLE public.parceiro_comissoes
  ADD COLUMN IF NOT EXISTS repassado boolean NOT NULL DEFAULT false;

-- Cache de juros/RT no pedido + líquido calculado
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS juros_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rt_repassado numeric NOT NULL DEFAULT 0;

-- valor_liquido como coluna gerada (apaga se já houver para recriar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pedidos' AND column_name='valor_liquido'
  ) THEN
    EXECUTE 'ALTER TABLE public.pedidos ADD COLUMN valor_liquido numeric GENERATED ALWAYS AS (COALESCE(valor_total,0) - COALESCE(juros_total,0) - COALESCE(rt_repassado,0)) STORED';
  END IF;
END $$;