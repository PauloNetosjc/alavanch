
-- 1. Extend profiles with SaaS fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tipo_usuario text NOT NULL DEFAULT 'usuario_base',
  ADD COLUMN IF NOT EXISTS base_cliente_id uuid REFERENCES public.bases_clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usuario_saas_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cargo_saas text,
  ADD COLUMN IF NOT EXISTS status_saas text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS bloqueado_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_acesso timestamptz,
  ADD COLUMN IF NOT EXISTS convite_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS observacoes_saas text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_tipo_usuario_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_tipo_usuario_check
      CHECK (tipo_usuario IN ('interno_saas','usuario_base'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_saas_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_saas_check
      CHECK (status_saas IN ('ativo','inativo','convite_pendente','bloqueado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_tipo_usuario ON public.profiles(tipo_usuario);
CREATE INDEX IF NOT EXISTS idx_profiles_base_cliente_id ON public.profiles(base_cliente_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status_saas ON public.profiles(status_saas);

-- 2. History table
CREATE TABLE IF NOT EXISTS public.saas_usuarios_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  evento text NOT NULL,
  descricao text,
  dados jsonb,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.saas_usuarios_historico TO authenticated;
GRANT ALL ON public.saas_usuarios_historico TO service_role;

ALTER TABLE public.saas_usuarios_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saas_usuarios_historico_select"
  ON public.saas_usuarios_historico FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'sistema.usuarios_saas','view'));

CREATE POLICY "saas_usuarios_historico_insert"
  ON public.saas_usuarios_historico FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'sistema.usuarios_saas','edit'));

CREATE INDEX IF NOT EXISTS idx_saas_usu_hist_user ON public.saas_usuarios_historico(user_id);
CREATE INDEX IF NOT EXISTS idx_saas_usu_hist_created ON public.saas_usuarios_historico(created_at DESC);

-- 3. Permission catalog entries
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('sistema.usuarios_saas','view','Visualizar usuários do Sistema SaaS','Sistema SaaS'),
  ('sistema.usuarios_saas','edit','Criar e editar usuários do Sistema SaaS','Sistema SaaS'),
  ('sistema.usuarios_saas','delete','Excluir/bloquear usuários do Sistema SaaS','Sistema SaaS')
ON CONFLICT (modulo, acao) DO UPDATE SET
  descricao = COALESCE(EXCLUDED.descricao, public.permissoes_modulos_catalogo.descricao),
  grupo = COALESCE(EXCLUDED.grupo, public.permissoes_modulos_catalogo.grupo);
