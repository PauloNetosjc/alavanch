
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.assinatura_status AS ENUM (
    'rascunho','aguardando_cliente','assinado_cliente','aguardando_loja',
    'assinado_loja','concluido','recusado','cancelado','expirado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.assinatura_participante_tipo AS ENUM ('cliente','loja');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.documento_origem_tipo AS ENUM ('sistema','upload');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TIPOS DE DOCUMENTO ============
CREATE TABLE IF NOT EXISTS public.tipos_documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  origem public.documento_origem_tipo NOT NULL,
  requer_assinatura_cliente boolean NOT NULL DEFAULT true,
  requer_assinatura_loja boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tipos_documento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "td_select_all" ON public.tipos_documento;
CREATE POLICY "td_select_all" ON public.tipos_documento FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "td_admin_all" ON public.tipos_documento;
CREATE POLICY "td_admin_all" ON public.tipos_documento FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "td_select_anon" ON public.tipos_documento;
CREATE POLICY "td_select_anon" ON public.tipos_documento FOR SELECT TO anon USING (true);

INSERT INTO public.tipos_documento (slug,nome,origem,requer_assinatura_cliente,requer_assinatura_loja) VALUES
  ('contrato','Contrato','sistema',true,true),
  ('adendo','Adendo de contrato','sistema',true,true),
  ('complemento','Complemento','sistema',true,true),
  ('projeto_inicial','Projeto inicial','upload',true,true),
  ('pdf_final','PDF final','upload',true,false),
  ('vistoria','Vistoria','upload',true,false)
ON CONFLICT (slug) DO NOTHING;

-- ============ SOLICITACOES ============
CREATE TABLE IF NOT EXISTS public.solicitacoes_assinatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  tipo_documento_id uuid NOT NULL REFERENCES public.tipos_documento(id),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  pedido_documento_id uuid REFERENCES public.pedido_documentos(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  storage_path text,
  file_url text,
  file_name text,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32),'hex'),
  status public.assinatura_status NOT NULL DEFAULT 'aguardando_cliente',
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cliente_assinado_em timestamptz,
  loja_assinado_em timestamptz,
  concluido_em timestamptz,
  cancelado_em timestamptz,
  created_by uuid,
  responsavel_interno_id uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sa_pedido ON public.solicitacoes_assinatura(pedido_id);
CREATE INDEX IF NOT EXISTS idx_sa_token ON public.solicitacoes_assinatura(token);
CREATE INDEX IF NOT EXISTS idx_sa_status ON public.solicitacoes_assinatura(status);
ALTER TABLE public.solicitacoes_assinatura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sa_select" ON public.solicitacoes_assinatura;
CREATE POLICY "sa_select" ON public.solicitacoes_assinatura FOR SELECT TO authenticated
  USING (public.pode_acessar_loja(loja_id));
DROP POLICY IF EXISTS "sa_insert" ON public.solicitacoes_assinatura;
CREATE POLICY "sa_insert" ON public.solicitacoes_assinatura FOR INSERT TO authenticated
  WITH CHECK (public.pode_acessar_loja(loja_id));
DROP POLICY IF EXISTS "sa_update" ON public.solicitacoes_assinatura;
CREATE POLICY "sa_update" ON public.solicitacoes_assinatura FOR UPDATE TO authenticated
  USING (public.pode_acessar_loja(loja_id));
DROP POLICY IF EXISTS "sa_delete" ON public.solicitacoes_assinatura;
CREATE POLICY "sa_delete" ON public.solicitacoes_assinatura FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "sa_select_anon" ON public.solicitacoes_assinatura;
CREATE POLICY "sa_select_anon" ON public.solicitacoes_assinatura FOR SELECT TO anon
  USING (token IS NOT NULL);
DROP POLICY IF EXISTS "sa_update_anon" ON public.solicitacoes_assinatura;
CREATE POLICY "sa_update_anon" ON public.solicitacoes_assinatura FOR UPDATE TO anon
  USING (token IS NOT NULL AND status IN ('aguardando_cliente','rascunho') AND expira_em > now());

CREATE TRIGGER trg_sa_updated BEFORE UPDATE ON public.solicitacoes_assinatura
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PARTICIPANTES ============
CREATE TABLE IF NOT EXISTS public.assinatura_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_assinatura(id) ON DELETE CASCADE,
  tipo public.assinatura_participante_tipo NOT NULL,
  nome text,
  email text,
  telefone text,
  documento text,
  user_id uuid,
  cargo text,
  status text NOT NULL DEFAULT 'pendente',
  assinado_em timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_solicit ON public.assinatura_participantes(solicitacao_id);
ALTER TABLE public.assinatura_participantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ap_select" ON public.assinatura_participantes;
CREATE POLICY "ap_select" ON public.assinatura_participantes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id AND public.pode_acessar_loja(s.loja_id)));
DROP POLICY IF EXISTS "ap_all" ON public.assinatura_participantes;
CREATE POLICY "ap_all" ON public.assinatura_participantes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id AND public.pode_acessar_loja(s.loja_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id AND public.pode_acessar_loja(s.loja_id)));
DROP POLICY IF EXISTS "ap_select_anon" ON public.assinatura_participantes;
CREATE POLICY "ap_select_anon" ON public.assinatura_participantes FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id));
DROP POLICY IF EXISTS "ap_insert_anon" ON public.assinatura_participantes;
CREATE POLICY "ap_insert_anon" ON public.assinatura_participantes FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id AND s.expira_em > now() AND s.status IN ('aguardando_cliente','rascunho')));
DROP POLICY IF EXISTS "ap_update_anon" ON public.assinatura_participantes;
CREATE POLICY "ap_update_anon" ON public.assinatura_participantes FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id AND s.expira_em > now()));

CREATE TRIGGER trg_ap_updated BEFORE UPDATE ON public.assinatura_participantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ EVIDENCIAS (imutável) ============
CREATE TABLE IF NOT EXISTS public.assinatura_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_assinatura(id) ON DELETE CASCADE,
  participante_id uuid REFERENCES public.assinatura_participantes(id) ON DELETE SET NULL,
  documento_foto_url text,
  selfie_url text,
  assinatura_url text,
  aceite boolean NOT NULL DEFAULT false,
  aceite_texto text,
  ip text,
  user_agent text,
  assinado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ae_solicit ON public.assinatura_evidencias(solicitacao_id);
ALTER TABLE public.assinatura_evidencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ae_select" ON public.assinatura_evidencias;
CREATE POLICY "ae_select" ON public.assinatura_evidencias FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id AND public.pode_acessar_loja(s.loja_id)));
DROP POLICY IF EXISTS "ae_insert_auth" ON public.assinatura_evidencias;
CREATE POLICY "ae_insert_auth" ON public.assinatura_evidencias FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id AND public.pode_acessar_loja(s.loja_id)));
DROP POLICY IF EXISTS "ae_insert_anon" ON public.assinatura_evidencias;
CREATE POLICY "ae_insert_anon" ON public.assinatura_evidencias FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id AND s.expira_em > now() AND s.status IN ('aguardando_cliente','rascunho','assinado_cliente')));

-- bloquear UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.evidencia_imutavel() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'Evidências de assinatura são imutáveis.';
END $$;
DROP TRIGGER IF EXISTS trg_ae_imut ON public.assinatura_evidencias;
CREATE TRIGGER trg_ae_imut BEFORE UPDATE OR DELETE ON public.assinatura_evidencias
  FOR EACH ROW EXECUTE FUNCTION public.evidencia_imutavel();

-- ============ EVENTOS (imutável) ============
CREATE TABLE IF NOT EXISTS public.assinatura_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_assinatura(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL,
  status_anterior text,
  status_novo text,
  descricao text,
  user_id uuid,
  participante_id uuid,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aev_solicit ON public.assinatura_eventos(solicitacao_id);
ALTER TABLE public.assinatura_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aev_select" ON public.assinatura_eventos;
CREATE POLICY "aev_select" ON public.assinatura_eventos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id AND public.pode_acessar_loja(s.loja_id)));
DROP POLICY IF EXISTS "aev_insert_auth" ON public.assinatura_eventos;
CREATE POLICY "aev_insert_auth" ON public.assinatura_eventos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "aev_insert_anon" ON public.assinatura_eventos;
CREATE POLICY "aev_insert_anon" ON public.assinatura_eventos FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id));
DROP POLICY IF EXISTS "aev_select_anon" ON public.assinatura_eventos;
CREATE POLICY "aev_select_anon" ON public.assinatura_eventos FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id));

DROP TRIGGER IF EXISTS trg_aev_imut ON public.assinatura_eventos;
CREATE TRIGGER trg_aev_imut BEFORE UPDATE OR DELETE ON public.assinatura_eventos
  FOR EACH ROW EXECUTE FUNCTION public.evidencia_imutavel();

-- ============ DOCUMENTOS ASSINADOS ============
CREATE TABLE IF NOT EXISTS public.documentos_assinados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_assinatura(id) ON DELETE CASCADE,
  final_file_url text,
  storage_path text,
  codigo_validacao text NOT NULL UNIQUE,
  concluido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.documentos_assinados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "da_select" ON public.documentos_assinados;
CREATE POLICY "da_select" ON public.documentos_assinados FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id AND public.pode_acessar_loja(s.loja_id)));
DROP POLICY IF EXISTS "da_insert" ON public.documentos_assinados;
CREATE POLICY "da_insert" ON public.documentos_assinados FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "da_select_anon" ON public.documentos_assinados;
CREATE POLICY "da_select_anon" ON public.documentos_assinados FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.solicitacoes_assinatura s WHERE s.id = solicitacao_id));

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public) VALUES ('assinaturas','assinaturas', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "assin_anon_insert" ON storage.objects;
CREATE POLICY "assin_anon_insert" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'assinaturas');
DROP POLICY IF EXISTS "assin_anon_select" ON storage.objects;
CREATE POLICY "assin_anon_select" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'assinaturas');
DROP POLICY IF EXISTS "assin_auth_all" ON storage.objects;
CREATE POLICY "assin_auth_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'assinaturas') WITH CHECK (bucket_id = 'assinaturas');

-- ============ PERMISSAO assinar_loja ============
INSERT INTO public.role_permissoes (role, modulo, acao) VALUES
  ('admin','assinaturas','edit'),
  ('admin','assinaturas','assinar_loja'),
  ('admin','assinaturas','cancelar'),
  ('gerente','assinaturas','edit'),
  ('gerente','assinaturas','assinar_loja')
ON CONFLICT DO NOTHING;
