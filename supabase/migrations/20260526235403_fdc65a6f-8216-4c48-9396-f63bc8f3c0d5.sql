
CREATE TABLE public.rh_setores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_setores TO authenticated;
GRANT ALL ON public.rh_setores TO service_role;
ALTER TABLE public.rh_setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_setores all" ON public.rh_setores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.rh_cargos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  setor_id UUID REFERENCES public.rh_setores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_cargos TO authenticated;
GRANT ALL ON public.rh_cargos TO service_role;
ALTER TABLE public.rh_cargos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_cargos all" ON public.rh_cargos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.rh_funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  foto_url TEXT,
  cpf TEXT,
  rg TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  cargo_id UUID REFERENCES public.rh_cargos(id) ON DELETE SET NULL,
  setor_id UUID REFERENCES public.rh_setores(id) ON DELETE SET NULL,
  salario NUMERIC(12,2),
  data_admissao DATE,
  tipo_contrato TEXT NOT NULL DEFAULT 'clt' CHECK (tipo_contrato IN ('clt','pj','terceirizado','autonomo')),
  data_fim_experiencia DATE,
  data_fim_contrato DATE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','afastado','ferias','desligado')),
  data_desligamento DATE,
  observacoes TEXT,
  loja_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_funcionarios TO authenticated;
GRANT ALL ON public.rh_funcionarios TO service_role;
ALTER TABLE public.rh_funcionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_funcionarios all" ON public.rh_funcionarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.rh_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nome_arquivo TEXT,
  url TEXT NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_documentos TO authenticated;
GRANT ALL ON public.rh_documentos TO service_role;
ALTER TABLE public.rh_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_documentos all" ON public.rh_documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.rh_ferias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'programada' CHECK (status IN ('programada','em_andamento','finalizada')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_ferias TO authenticated;
GRANT ALL ON public.rh_ferias TO service_role;
ALTER TABLE public.rh_ferias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_ferias all" ON public.rh_ferias FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.rh_ocorrencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL,
  descricao TEXT,
  responsavel TEXT,
  anexo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_ocorrencias TO authenticated;
GRANT ALL ON public.rh_ocorrencias TO service_role;
ALTER TABLE public.rh_ocorrencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_ocorrencias all" ON public.rh_ocorrencias FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('rh', 'rh', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "rh bucket public read" ON storage.objects FOR SELECT USING (bucket_id = 'rh');
CREATE POLICY "rh bucket auth insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'rh');
CREATE POLICY "rh bucket auth update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'rh');
CREATE POLICY "rh bucket auth delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'rh');

INSERT INTO public.rh_setores (nome) VALUES
  ('Comercial'),('Projetos'),('Montagem'),('Logística'),
  ('Financeiro'),('Administrativo'),('Produção'),('RH')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('rh','view','Visualizar RH','Financeiro'),
  ('rh','manage','Gerenciar funcionários, férias e documentos','Financeiro')
ON CONFLICT (modulo, acao) DO NOTHING;
