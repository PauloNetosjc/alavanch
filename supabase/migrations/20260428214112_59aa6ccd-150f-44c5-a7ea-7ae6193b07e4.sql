-- ========================================================================
-- RESET COMPLETO + RECRIAÇÃO EM PORTUGUÊS
-- ========================================================================

-- Drop policies que dependem de has_role
DO $$ DECLARE r record;
BEGIN
  FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname='public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Drop tabelas existentes (cascade)
DROP TABLE IF EXISTS public.timeline_events CASCADE;
DROP TABLE IF EXISTS public.attachments CASCADE;
DROP TABLE IF EXISTS public.occurrences CASCADE;
DROP TABLE IF EXISTS public.contracts CASCADE;
DROP TABLE IF EXISTS public.contract_templates CASCADE;
DROP TABLE IF EXISTS public.financial_entries CASCADE;
DROP TABLE IF EXISTS public.financial_categories CASCADE;
DROP TABLE IF EXISTS public.financial_settings CASCADE;
DROP TABLE IF EXISTS public.bank_accounts CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;
DROP TABLE IF EXISTS public.pipeline_stages CASCADE;
DROP TABLE IF EXISTS public.tags_config CASCADE;
DROP TABLE IF EXISTS public.origins_config CASCADE;
DROP TABLE IF EXISTS public.approval_rules CASCADE;
DROP TABLE IF EXISTS public.quote_installments CASCADE;
DROP TABLE IF EXISTS public.quote_items CASCADE;
DROP TABLE IF EXISTS public.quote_environments CASCADE;
DROP TABLE IF EXISTS public.quotes CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.order_environments CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.promob_imports CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.stores CASCADE;

DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.generate_occurrence_code() CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- ========================================================================
-- TYPES
-- ========================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor', 'montador');

-- ========================================================================
-- CORE: lojas, profiles, user_roles
-- ========================================================================
CREATE TABLE public.lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT,
  avatar_url TEXT,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- ========================================================================
-- HELPERS
-- ========================================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_loja_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT loja_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome_completo)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================================================
-- CLIENTES
-- ========================================================================
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  data_nascimento DATE,
  email TEXT,
  telefone TEXT,
  telefone_secundario TEXT,
  endereco_entrega TEXT,
  endereco_cobranca TEXT,
  observacoes TEXT,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- LEADS (CRM)
-- ========================================================================
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  interesse TEXT[] DEFAULT '{}',
  indicador TEXT,
  status TEXT NOT NULL DEFAULT 'novos', -- novos, em_contato, orcamento, negociacao, fechado
  notas TEXT,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- PARCEIROS (indicadores)
-- ========================================================================
CREATE TABLE public.parceiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  percentual_padrao NUMERIC DEFAULT 10,
  ativo BOOLEAN DEFAULT true,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- ORÇAMENTOS
-- ========================================================================
CREATE TABLE public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome_projeto TEXT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  parceiro_id UUID REFERENCES public.parceiros(id) ON DELETE SET NULL,
  parceiro_perc NUMERIC DEFAULT 0,
  projetista_id UUID REFERENCES auth.users(id),
  consultor_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'negociacao', -- negociacao, vendido, cancelado
  subtotal NUMERIC DEFAULT 0,
  desconto_perc NUMERIC DEFAULT 0,
  desconto_valor NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ambientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  prazo_dias INTEGER,
  custo_aquisicao NUMERIC DEFAULT 0,
  custo_fabrica NUMERIC DEFAULT 0,
  custo_loja NUMERIC DEFAULT 0,
  preco_sugerido NUMERIC DEFAULT 0,
  markup NUMERIC DEFAULT 0,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sub_itens_ambiente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambiente_id UUID NOT NULL REFERENCES public.ambientes(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade INTEGER DEFAULT 1,
  largura NUMERIC,
  altura NUMERIC,
  profundidade NUMERIC,
  custo_fabrica NUMERIC DEFAULT 0,
  custo_loja NUMERIC DEFAULT 0,
  custo_cliente NUMERIC DEFAULT 0,
  cor TEXT,
  categoria TEXT,
  codigo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pagamentos_orcamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  metodo TEXT NOT NULL,
  parcelas INTEGER DEFAULT 1,
  data_vencimento DATE,
  valor NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.promob_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  ambiente_id UUID REFERENCES public.ambientes(id) ON DELETE SET NULL,
  raw_content TEXT,
  parsed_data JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- PEDIDOS (orçamento confirmado vira pedido)
-- ========================================================================
CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  status TEXT NOT NULL DEFAULT 'em_producao',
  valor_total NUMERIC DEFAULT 0,
  data_envio_fabrica DATE,
  data_montagem DATE,
  data_vistoria DATE,
  loja_id UUID REFERENCES public.lojas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- ASSISTÊNCIAS
-- ========================================================================
CREATE TABLE public.assistencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  tipo TEXT NOT NULL,
  prioridade TEXT DEFAULT 'media',
  descricao TEXT,
  tecnico_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'triagem',
  data_agendamento DATE,
  hora_agendamento TIME,
  material_necessario BOOLEAN DEFAULT false,
  observacoes TEXT,
  loja_id UUID REFERENCES public.lojas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.materiais_assistencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistencia_id UUID NOT NULL REFERENCES public.assistencias(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade INTEGER DEFAULT 1,
  origem TEXT DEFAULT 'deposito',
  disponivel BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.fotos_assistencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistencia_id UUID NOT NULL REFERENCES public.assistencias(id) ON DELETE CASCADE,
  tipo TEXT,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistencia_id UUID NOT NULL REFERENCES public.assistencias(id) ON DELETE CASCADE,
  montador_id UUID REFERENCES auth.users(id),
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistencia_id UUID NOT NULL REFERENCES public.assistencias(id) ON DELETE CASCADE,
  assinatura_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- OCORRÊNCIAS
-- ========================================================================
CREATE TABLE public.ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  tipo TEXT NOT NULL,
  prioridade TEXT DEFAULT 'media',
  descricao TEXT,
  foto_url TEXT,
  responsavel_id UUID REFERENCES auth.users(id),
  prazo_resolucao DATE,
  status TEXT DEFAULT 'aberta',
  loja_id UUID REFERENCES public.lojas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- TIMELINE
-- ========================================================================
CREATE TABLE public.timeline_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade_tipo TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  metadata JSONB,
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- CONFIG: contas bancárias, categorias, tags, métodos pagamento, templates, aprovações, pipelines
-- ========================================================================
CREATE TABLE public.contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  saldo_inicial NUMERIC DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.categorias_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- receita, despesa
  parent_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE CASCADE,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lancamentos_financeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL, -- receita, despesa
  descricao TEXT,
  valor NUMERIC NOT NULL,
  data_vencimento DATE,
  data_pagamento DATE,
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  conta_id UUID REFERENCES public.contas_bancarias(id),
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pendente', -- pendente, pago, vencido
  recorrente BOOLEAN DEFAULT false,
  conciliado BOOLEAN DEFAULT false,
  loja_id UUID REFERENCES public.lojas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.origens_lead (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.metodos_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.templates_mensagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'whatsapp',
  conteudo TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.regras_aprovacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  desconto_max_perc NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pipeline_estagios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline TEXT NOT NULL,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  cor TEXT DEFAULT '#6b7280',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- TRIGGERS de updated_at
-- ========================================================================
DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['lojas','profiles','clientes','leads','orcamentos','pedidos','assistencias','ocorrencias','lancamentos_financeiros']) LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- ========================================================================
-- ENABLE RLS + POLICIES
-- ========================================================================
DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'lojas','profiles','user_roles','clientes','leads','parceiros','orcamentos','ambientes',
    'sub_itens_ambiente','pagamentos_orcamento','promob_imports','pedidos','assistencias',
    'materiais_assistencia','fotos_assistencia','checkins','assinaturas','ocorrencias',
    'timeline_eventos','contas_bancarias','categorias_financeiras','lancamentos_financeiros',
    'origens_lead','metodos_pagamento','templates_mensagem','regras_aprovacao','pipeline_estagios'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- lojas
CREATE POLICY "lojas_select" ON public.lojas FOR SELECT TO authenticated USING (true);
CREATE POLICY "lojas_admin" ON public.lojas FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Loja-scoped tables: select por loja, insert/update authenticated, delete admin
DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['clientes','leads','parceiros','orcamentos','pedidos','assistencias','ocorrencias','lancamentos_financeiros']) LOOP
    EXECUTE format($p$CREATE POLICY "%1$s_select" ON public.%1$I FOR SELECT TO authenticated USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(),'admin'))$p$, t);
    EXECUTE format($p$CREATE POLICY "%1$s_insert" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (true)$p$, t);
    EXECUTE format($p$CREATE POLICY "%1$s_update" ON public.%1$I FOR UPDATE TO authenticated USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(),'admin'))$p$, t);
    EXECUTE format($p$CREATE POLICY "%1$s_delete" ON public.%1$I FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'))$p$, t);
  END LOOP;
END $$;

-- Tabelas filhas / sem loja_id direto: liberadas para authenticated
DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'ambientes','sub_itens_ambiente','pagamentos_orcamento','promob_imports',
    'materiais_assistencia','fotos_assistencia','checkins','assinaturas',
    'timeline_eventos','contas_bancarias','categorias_financeiras',
    'origens_lead','metodos_pagamento','templates_mensagem','regras_aprovacao','pipeline_estagios'
  ]) LOOP
    EXECUTE format($p$CREATE POLICY "%1$s_select" ON public.%1$I FOR SELECT TO authenticated USING (true)$p$, t);
    EXECUTE format($p$CREATE POLICY "%1$s_insert" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (true)$p$, t);
    EXECUTE format($p$CREATE POLICY "%1$s_update" ON public.%1$I FOR UPDATE TO authenticated USING (true)$p$, t);
    EXECUTE format($p$CREATE POLICY "%1$s_delete" ON public.%1$I FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'))$p$, t);
  END LOOP;
END $$;

-- ========================================================================
-- SEEDS mínimos
-- ========================================================================
INSERT INTO public.lojas (nome, cnpj, ativo) VALUES ('Loja Principal', '00.000.000/0001-00', true);

INSERT INTO public.metodos_pagamento (nome) VALUES
  ('PIX'),('Boleto'),('Cartão Crédito'),('Cartão Débito'),
  ('Transferência'),('Cheque'),('Financiamento'),('Outros');

INSERT INTO public.origens_lead (nome) VALUES
  ('Google'),('Instagram'),('Facebook'),('Indicação'),('Site'),('WhatsApp');

INSERT INTO public.regras_aprovacao (role, desconto_max_perc) VALUES
  ('admin', 100),('vendedor', 10),('montador', 0);

-- Categorias DRE base
INSERT INTO public.categorias_financeiras (nome, tipo, ordem) VALUES
  ('Receita Bruta','receita',1),
  ('Deduções','despesa',2),
  ('CMV','despesa',3),
  ('Despesas Operacionais','despesa',4),
  ('Despesas Administrativas','despesa',5),
  ('Despesas Financeiras','despesa',6);

INSERT INTO public.pipeline_estagios (pipeline, nome, ordem, cor) VALUES
  ('leads','Novos',1,'#3B82F6'),
  ('leads','Em Contato',2,'#F97316'),
  ('leads','Orçamento',3,'#8B5CF6'),
  ('leads','Negociação',4,'#CA8A04'),
  ('leads','Fechado',5,'#10B981');