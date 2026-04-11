
-- Fix user_roles: change policies from public to authenticated
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Tighten orders: only admins can update
DROP POLICY IF EXISTS "Authenticated can update orders" ON public.orders;
CREATE POLICY "Admins can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tighten financial_entries: only admins can insert/update/delete
DROP POLICY IF EXISTS "Authenticated can insert financial_entries" ON public.financial_entries;
DROP POLICY IF EXISTS "Authenticated can update financial_entries" ON public.financial_entries;

CREATE POLICY "Admins can insert financial_entries"
ON public.financial_entries
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update financial_entries"
ON public.financial_entries
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tighten contracts: only admins can update/delete
DROP POLICY IF EXISTS "Authenticated can update contracts" ON public.contracts;
CREATE POLICY "Admins can update contracts"
ON public.contracts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tighten attachments: uploaded_by must match current user on insert
DROP POLICY IF EXISTS "Authenticated can manage attachments" ON public.attachments;
CREATE POLICY "Authenticated can view attachments"
ON public.attachments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert attachments"
ON public.attachments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated can update own attachments"
ON public.attachments
FOR UPDATE
TO authenticated
USING (auth.uid() = uploaded_by);

CREATE POLICY "Admins can delete attachments"
ON public.attachments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tighten occurrences: only admins can update
DROP POLICY IF EXISTS "Authenticated can update occurrences" ON public.occurrences;
CREATE POLICY "Admins can update occurrences"
ON public.occurrences
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tighten order_environments and order_items: split ALL into granular
DROP POLICY IF EXISTS "Authenticated can manage order_environments" ON public.order_environments;
CREATE POLICY "Authenticated can view order_environments"
ON public.order_environments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert order_environments"
ON public.order_environments
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update order_environments"
ON public.order_environments
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete order_environments"
ON public.order_environments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can manage order_items" ON public.order_items;
CREATE POLICY "Authenticated can view order_items"
ON public.order_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert order_items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update order_items"
ON public.order_items
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete order_items"
ON public.order_items
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tighten promob_imports
DROP POLICY IF EXISTS "Authenticated can manage promob_imports" ON public.promob_imports;
CREATE POLICY "Authenticated can view promob_imports"
ON public.promob_imports
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert promob_imports"
ON public.promob_imports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update promob_imports"
ON public.promob_imports
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete promob_imports"
ON public.promob_imports
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tighten quote_environments
DROP POLICY IF EXISTS "Authenticated can manage quote_environments" ON public.quote_environments;
CREATE POLICY "Authenticated can view quote_environments"
ON public.quote_environments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert quote_environments"
ON public.quote_environments
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update quote_environments"
ON public.quote_environments
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete quote_environments"
ON public.quote_environments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tighten quote_installments
DROP POLICY IF EXISTS "Authenticated can manage quote_installments" ON public.quote_installments;
DROP POLICY IF EXISTS "Authenticated can delete quote_installments" ON public.quote_installments;
CREATE POLICY "Authenticated can view quote_installments"
ON public.quote_installments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert quote_installments"
ON public.quote_installments
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update quote_installments"
ON public.quote_installments
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Admins can delete quote_installments"
ON public.quote_installments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
