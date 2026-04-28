
-- Add quote_id to promob_imports for quote-stage imports
ALTER TABLE public.promob_imports
  ADD COLUMN IF NOT EXISTS quote_id uuid,
  ADD COLUMN IF NOT EXISTS quote_environment_id uuid,
  ALTER COLUMN order_id DROP NOT NULL;

-- Create quote_items mirroring order_items but linked to quote_environments
CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL,
  import_id uuid,
  index_num integer,
  quantity integer DEFAULT 1,
  description text NOT NULL,
  width numeric,
  height numeric,
  depth numeric,
  cost numeric DEFAULT 0,
  category text,
  finish text,
  project_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view quote_items" ON public.quote_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert quote_items" ON public.quote_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update quote_items" ON public.quote_items
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete quote_items" ON public.quote_items
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
