-- Role system
CREATE TYPE public.app_role AS ENUM ('admin', 'diretoria', 'gerente_loja', 'vendedor', 'revisao', 'financeiro', 'montagem', 'pos_venda');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Stores (before profiles, since profiles references stores)
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  cnpj TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stores viewable by authenticated" ON public.stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage stores" ON public.stores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  store_id UUID REFERENCES public.stores(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN INSERT INTO public.profiles (user_id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name'); RETURN NEW; END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cpf TEXT,
  birth_date DATE,
  email TEXT,
  phone TEXT,
  phone_secondary TEXT,
  delivery_address TEXT,
  billing_address TEXT,
  notes TEXT,
  store_id UUID REFERENCES public.stores(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE INDEX idx_clients_cpf ON public.clients(cpf);
CREATE INDEX idx_clients_phone ON public.clients(phone);
CREATE INDEX idx_clients_email ON public.clients(email);

-- Quotes
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES public.clients(id),
  store_id UUID REFERENCES public.stores(id),
  seller_id UUID REFERENCES auth.users(id),
  focal_point TEXT,
  origin TEXT,
  start_date DATE,
  expiry_date DATE,
  urgency TEXT DEFAULT 'normal',
  total_value NUMERIC(12,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_value NUMERIC(12,2) DEFAULT 0,
  interest_percent NUMERIC(5,2) DEFAULT 0,
  surcharge NUMERIC(12,2) DEFAULT 0,
  final_value NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'novo_lead',
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view quotes" ON public.quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update quotes" ON public.quotes FOR UPDATE TO authenticated USING (true);

-- Quote environments
CREATE TABLE public.quote_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  value NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_environments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage quote_environments" ON public.quote_environments FOR ALL TO authenticated USING (true);

-- Quote installments
CREATE TABLE public.quote_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  due_date DATE,
  value NUMERIC(12,2) NOT NULL,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage quote_installments" ON public.quote_installments FOR ALL TO authenticated USING (true);

-- Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  quote_id UUID REFERENCES public.quotes(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  store_id UUID REFERENCES public.stores(id),
  seller_id UUID REFERENCES auth.users(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  factory_send_date DATE,
  tags TEXT[],
  internal_comments TEXT,
  contract_notes TEXT,
  contract_status TEXT DEFAULT 'pendente',
  revision_status TEXT DEFAULT 'pendente',
  financial_status TEXT DEFAULT 'pendente',
  assembly_status TEXT DEFAULT 'pendente',
  post_assembly_status TEXT DEFAULT 'pendente',
  occurrence_status TEXT DEFAULT 'sem_ocorrencias',
  total_value NUMERIC(12,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_value NUMERIC(12,2) DEFAULT 0,
  final_value NUMERIC(12,2) DEFAULT 0,
  snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update orders" ON public.orders FOR UPDATE TO authenticated USING (true);

-- Order environments
CREATE TABLE public.order_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  value NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_environments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage order_environments" ON public.order_environments FOR ALL TO authenticated USING (true);

-- Order items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES public.order_environments(id) ON DELETE CASCADE,
  import_id UUID,
  index_num INTEGER,
  quantity INTEGER DEFAULT 1,
  description TEXT NOT NULL,
  width NUMERIC(8,2),
  height NUMERIC(8,2),
  depth NUMERIC(8,2),
  cost NUMERIC(12,2) DEFAULT 0,
  project_ref TEXT,
  category TEXT,
  finish TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage order_items" ON public.order_items FOR ALL TO authenticated USING (true);

-- Promob imports
CREATE TABLE public.promob_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  environment_id UUID REFERENCES public.order_environments(id),
  version INTEGER DEFAULT 1,
  project_id TEXT,
  promob_version TEXT,
  import_date TIMESTAMPTZ,
  store_name TEXT,
  client_name TEXT,
  address TEXT,
  neighborhood TEXT,
  phone TEXT,
  cpf TEXT,
  delivery_address TEXT,
  raw_content TEXT,
  status TEXT DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.promob_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage promob_imports" ON public.promob_imports FOR ALL TO authenticated USING (true);

-- Contracts
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  store_id UUID REFERENCES public.stores(id),
  template_id UUID,
  version INTEGER DEFAULT 1,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  signature_link TEXT,
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  pdf_url TEXT,
  notes TEXT,
  footer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view contracts" ON public.contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contracts" ON public.contracts FOR UPDATE TO authenticated USING (true);

-- Bank accounts
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bank TEXT,
  agency TEXT,
  account_number TEXT,
  balance NUMERIC(14,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view bank_accounts" ON public.bank_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage bank_accounts" ON public.bank_accounts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Financial categories
CREATE TABLE public.financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id UUID REFERENCES public.financial_categories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view financial_categories" ON public.financial_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage financial_categories" ON public.financial_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Financial entries
CREATE TABLE public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id),
  category_id UUID REFERENCES public.financial_categories(id),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  type TEXT NOT NULL,
  description TEXT,
  value NUMERIC(12,2) NOT NULL,
  due_date DATE,
  paid_date DATE,
  paid_value NUMERIC(12,2),
  surcharge NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pendente',
  payment_method TEXT,
  installment_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view financial_entries" ON public.financial_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert financial_entries" ON public.financial_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update financial_entries" ON public.financial_entries FOR UPDATE TO authenticated USING (true);

-- Occurrences
CREATE TABLE public.occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  type TEXT NOT NULL,
  priority TEXT DEFAULT 'media',
  description TEXT,
  responsible_id UUID REFERENCES auth.users(id),
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'aberta',
  solution TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view occurrences" ON public.occurrences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert occurrences" ON public.occurrences FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update occurrences" ON public.occurrences FOR UPDATE TO authenticated USING (true);

-- Attachments
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage attachments" ON public.attachments FOR ALL TO authenticated USING (true);

-- Timeline events
CREATE TABLE public.timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view timeline" ON public.timeline_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert timeline" ON public.timeline_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_timeline_entity ON public.timeline_events(entity_type, entity_id);

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_financial_entries_updated_at BEFORE UPDATE ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_occurrences_updated_at BEFORE UPDATE ON public.occurrences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequences for auto-codes
CREATE SEQUENCE public.quote_code_seq START 1000;
CREATE SEQUENCE public.order_code_seq START 1000;
