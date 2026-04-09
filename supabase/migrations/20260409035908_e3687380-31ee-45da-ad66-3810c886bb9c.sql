-- quote_installments already has ALL policy, but let's verify delete works
-- Add explicit delete policy for quote_installments
CREATE POLICY "Authenticated can delete quote_installments"
ON public.quote_installments
FOR DELETE
TO authenticated
USING (true);
