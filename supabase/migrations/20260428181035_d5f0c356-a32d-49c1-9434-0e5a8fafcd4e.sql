ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS final_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS factory_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_cost numeric DEFAULT 0;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS final_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS factory_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_cost numeric DEFAULT 0;

ALTER TABLE public.quote_environments
  ADD COLUMN IF NOT EXISTS factory_cost numeric DEFAULT 0;

ALTER TABLE public.order_environments
  ADD COLUMN IF NOT EXISTS factory_cost numeric DEFAULT 0;