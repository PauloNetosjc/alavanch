
ALTER TABLE public.certificados_digitais
  ADD COLUMN IF NOT EXISTS senha_cifrada text,
  ADD COLUMN IF NOT EXISTS senha_iv text,
  ADD COLUMN IF NOT EXISTS senha_tag text,
  ADD COLUMN IF NOT EXISTS senha_algoritmo text DEFAULT 'AES-256-GCM';

ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS chave_acesso text,
  ADD COLUMN IF NOT EXISTS protocolo_autorizacao text,
  ADD COLUMN IF NOT EXISTS data_autorizacao timestamptz,
  ADD COLUMN IF NOT EXISTS mensagem_retorno text,
  ADD COLUMN IF NOT EXISTS xml_url text,
  ADD COLUMN IF NOT EXISTS xml_autorizado_url text,
  ADD COLUMN IF NOT EXISTS retorno_sefaz_url text,
  ADD COLUMN IF NOT EXISTS danfe_url text,
  ADD COLUMN IF NOT EXISTS numero_lote text,
  ADD COLUMN IF NOT EXISTS numero_recibo text,
  ADD COLUMN IF NOT EXISTS ambiente text DEFAULT 'homologacao',
  ADD COLUMN IF NOT EXISTS numero_nf integer,
  ADD COLUMN IF NOT EXISTS digest_value text;

CREATE TABLE IF NOT EXISTS public.notas_fiscais_logs_tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  loja_id uuid,
  etapa text NOT NULL,
  payload_resumido jsonb,
  retorno_resumido jsonb,
  erro text,
  duracao_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.notas_fiscais_logs_tecnicos TO authenticated;
GRANT ALL ON public.notas_fiscais_logs_tecnicos TO service_role;

ALTER TABLE public.notas_fiscais_logs_tecnicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_select_loja" ON public.notas_fiscais_logs_tecnicos;
CREATE POLICY "logs_select_loja" ON public.notas_fiscais_logs_tecnicos
FOR SELECT TO authenticated
USING (
  loja_id IS NULL OR EXISTS (
    SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = notas_fiscais_logs_tecnicos.loja_id
  ) OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "logs_insert_service" ON public.notas_fiscais_logs_tecnicos;
CREATE POLICY "logs_insert_service" ON public.notas_fiscais_logs_tecnicos
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_logs_tec_nota ON public.notas_fiscais_logs_tecnicos(nota_fiscal_id, created_at DESC);

DROP POLICY IF EXISTS "nf_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "nf_storage_delete" ON storage.objects;

CREATE POLICY "nf_storage_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'notas-fiscais' AND (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.user_lojas ul
      WHERE ul.user_id = auth.uid()
        AND ul.loja_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "nf_storage_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'notas-fiscais' AND (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.user_lojas ul
      WHERE ul.user_id = auth.uid()
        AND ul.loja_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "nf_storage_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'notas-fiscais' AND (
    public.has_role(auth.uid(), 'admin') OR EXISTS (
      SELECT 1 FROM public.user_lojas ul
      WHERE ul.user_id = auth.uid()
        AND ul.loja_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "nf_storage_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'notas-fiscais' AND public.has_role(auth.uid(), 'admin')
);

INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, grupo, descricao) VALUES
  ('notas_fiscais', 'view', 'Fiscal', 'Visualizar notas fiscais'),
  ('notas_fiscais', 'create', 'Fiscal', 'Criar/emitir notas fiscais'),
  ('notas_fiscais', 'edit', 'Fiscal', 'Editar notas fiscais')
ON CONFLICT DO NOTHING;
