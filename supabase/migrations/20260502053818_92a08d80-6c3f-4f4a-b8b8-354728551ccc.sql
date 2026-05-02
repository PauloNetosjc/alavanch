
-- Adiciona logo e nome fantasia na configuração da empresa
ALTER TABLE public.configuracoes_empresa
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text;

-- Bucket público para logos das lojas
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket branding
DROP POLICY IF EXISTS "Branding publicly readable" ON storage.objects;
CREATE POLICY "Branding publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "Admins manage branding" ON storage.objects;
CREATE POLICY "Admins manage branding"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role));

-- Permitir leitura de configuracoes_empresa para qualquer usuário autenticado (necessário para mostrar branding no sidebar)
DROP POLICY IF EXISTS "config_empresa_select" ON public.configuracoes_empresa;
CREATE POLICY "config_empresa_select"
  ON public.configuracoes_empresa FOR SELECT
  TO authenticated
  USING (true);
