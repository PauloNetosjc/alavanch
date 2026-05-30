
-- Add attachment fields to comunicados_saas
ALTER TABLE public.comunicados_saas
  ADD COLUMN IF NOT EXISTS anexo_tipo text,
  ADD COLUMN IF NOT EXISTS anexo_url text,
  ADD COLUMN IF NOT EXISTS anexo_nome text,
  ADD COLUMN IF NOT EXISTS anexo_mime text,
  ADD COLUMN IF NOT EXISTS anexo_tamanho_bytes numeric,
  ADD COLUMN IF NOT EXISTS anexo_texto_botao text;

-- Storage bucket público (anexos visualizáveis por URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('comunicados-saas', 'comunicados-saas', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policies do bucket
DROP POLICY IF EXISTS "Comunicados SaaS anexos públicos leitura" ON storage.objects;
CREATE POLICY "Comunicados SaaS anexos públicos leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'comunicados-saas');

DROP POLICY IF EXISTS "Comunicados SaaS anexos upload autenticado" ON storage.objects;
CREATE POLICY "Comunicados SaaS anexos upload autenticado"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comunicados-saas');

DROP POLICY IF EXISTS "Comunicados SaaS anexos update autenticado" ON storage.objects;
CREATE POLICY "Comunicados SaaS anexos update autenticado"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'comunicados-saas');

DROP POLICY IF EXISTS "Comunicados SaaS anexos delete autenticado" ON storage.objects;
CREATE POLICY "Comunicados SaaS anexos delete autenticado"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'comunicados-saas');
