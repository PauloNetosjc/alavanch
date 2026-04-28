-- VPL columns on quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS npv_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_rate_monthly numeric DEFAULT 1.5;

-- VPL columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS npv_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_rate_monthly numeric DEFAULT 1.5;

-- Cost on quote_environments
ALTER TABLE public.quote_environments
  ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;

-- Financial settings (singleton)
CREATE TABLE IF NOT EXISTS public.financial_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_discount_rate_monthly numeric NOT NULL DEFAULT 1.5,
  vpl_alert_threshold numeric NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view financial_settings"
  ON public.financial_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage financial_settings"
  ON public.financial_settings FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_financial_settings_updated_at
  BEFORE UPDATE ON public.financial_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default row
INSERT INTO public.financial_settings (default_discount_rate_monthly, vpl_alert_threshold)
SELECT 1.5, 15
WHERE NOT EXISTS (SELECT 1 FROM public.financial_settings);