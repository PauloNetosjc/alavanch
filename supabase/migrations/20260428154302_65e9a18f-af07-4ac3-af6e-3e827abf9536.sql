-- ─── ORDERS: aprovação + montagem ───
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'nao_requer',
  ADD COLUMN IF NOT EXISTS approval_reason text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS assembly_date date,
  ADD COLUMN IF NOT EXISTS assembler_id uuid,
  ADD COLUMN IF NOT EXISTS inspection_date date,
  ADD COLUMN IF NOT EXISTS installments_generated boolean DEFAULT false;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'nao_requer',
  ADD COLUMN IF NOT EXISTS approval_reason text,
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.occurrences
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS photo_url text;

CREATE OR REPLACE FUNCTION public.generate_occurrence_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  yr text := to_char(now(), 'YYYY');
  next_num int;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX(CAST(split_part(code, '-', 3) AS int)), 0) + 1
    INTO next_num
    FROM public.occurrences
    WHERE code LIKE 'OCR-' || yr || '-%';
  NEW.code := 'OCR-' || yr || '-' || lpad(next_num::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_occurrences_code ON public.occurrences;
CREATE TRIGGER trg_occurrences_code
  BEFORE INSERT ON public.occurrences
  FOR EACH ROW EXECUTE FUNCTION public.generate_occurrence_code();

-- Backfill de códigos antigos via CTE
WITH numbered AS (
  SELECT id, opened_at,
         ROW_NUMBER() OVER (PARTITION BY to_char(opened_at, 'YYYY') ORDER BY opened_at) AS rn
    FROM public.occurrences
   WHERE code IS NULL OR code = ''
)
UPDATE public.occurrences o
   SET code = 'OCR-' || to_char(n.opened_at, 'YYYY') || '-' || lpad(n.rn::text, 4, '0')
  FROM numbered n
 WHERE o.id = n.id;

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS reconciled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciled_by uuid,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('order-attachments', 'order-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated can view order attachments" ON storage.objects;
CREATE POLICY "Authenticated can view order attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'order-attachments');

DROP POLICY IF EXISTS "Authenticated can upload order attachments" ON storage.objects;
CREATE POLICY "Authenticated can upload order attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'order-attachments' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can update own order attachments" ON storage.objects;
CREATE POLICY "Authenticated can update own order attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'order-attachments' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Owners or admins can delete order attachments" ON storage.objects;
CREATE POLICY "Owners or admins can delete order attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'order-attachments'
    AND (auth.uid() = owner OR public.has_role(auth.uid(), 'admin'))
  );

CREATE INDEX IF NOT EXISTS idx_financial_entries_order_id ON public.financial_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_due_date ON public.financial_entries(due_date);
CREATE INDEX IF NOT EXISTS idx_orders_assembly_date ON public.orders(assembly_date);
CREATE INDEX IF NOT EXISTS idx_orders_factory_send_date ON public.orders(factory_send_date);
CREATE INDEX IF NOT EXISTS idx_orders_approval_status ON public.orders(approval_status);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON public.attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_entity ON public.timeline_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_occurrences_order_id ON public.occurrences(order_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_status ON public.occurrences(status);