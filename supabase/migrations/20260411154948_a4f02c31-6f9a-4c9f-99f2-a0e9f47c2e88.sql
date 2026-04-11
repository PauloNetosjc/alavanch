
-- Payment methods
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view payment_methods" ON public.payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage payment_methods" ON public.payment_methods FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Tags config
CREATE TABLE public.tags_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'orcamento',
  color text DEFAULT '#6b7280',
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tags_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view tags_config" ON public.tags_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tags_config" ON public.tags_config FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Origins config
CREATE TABLE public.origins_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.origins_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view origins_config" ON public.origins_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage origins_config" ON public.origins_config FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Contract templates
CREATE TABLE public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text,
  store_id uuid REFERENCES public.stores(id),
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view contract_templates" ON public.contract_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage contract_templates" ON public.contract_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Approval rules
CREATE TABLE public.approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type text NOT NULL DEFAULT 'desconto',
  max_percent numeric DEFAULT 0,
  approver_role text NOT NULL DEFAULT 'gerente_loja',
  description text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view approval_rules" ON public.approval_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage approval_rules" ON public.approval_rules FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
