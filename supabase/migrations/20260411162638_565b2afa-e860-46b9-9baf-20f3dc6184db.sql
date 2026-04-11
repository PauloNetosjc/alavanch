
-- Allow admins to delete orders
CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete clients
CREATE POLICY "Admins can delete clients"
ON public.clients
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete contracts
CREATE POLICY "Admins can delete contracts"
ON public.contracts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete financial_entries
CREATE POLICY "Admins can delete financial_entries"
ON public.financial_entries
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete occurrences
CREATE POLICY "Admins can delete occurrences"
ON public.occurrences
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
