
ALTER TABLE public.ambientes
  ADD COLUMN IF NOT EXISTS negociavel boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.orcamento_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  storage_path text NOT NULL,
  tamanho bigint,
  mime_type text,
  origem text DEFAULT 'upload',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orcamento_documentos_orc ON public.orcamento_documentos(orcamento_id);
ALTER TABLE public.orcamento_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orc_docs_select" ON public.orcamento_documentos;
CREATE POLICY "orc_docs_select" ON public.orcamento_documentos FOR SELECT TO authenticated
  USING (public.pode_acessar_loja(public.loja_de_orcamento(orcamento_id)));
DROP POLICY IF EXISTS "orc_docs_insert" ON public.orcamento_documentos;
CREATE POLICY "orc_docs_insert" ON public.orcamento_documentos FOR INSERT TO authenticated
  WITH CHECK (public.pode_acessar_loja(public.loja_de_orcamento(orcamento_id)));
DROP POLICY IF EXISTS "orc_docs_delete" ON public.orcamento_documentos;
CREATE POLICY "orc_docs_delete" ON public.orcamento_documentos FOR DELETE TO authenticated
  USING (public.pode_acessar_loja(public.loja_de_orcamento(orcamento_id)));

INSERT INTO storage.buckets (id, name, public)
VALUES ('orcamento-docs', 'orcamento-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "orc-docs read" ON storage.objects;
CREATE POLICY "orc-docs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'orcamento-docs');
DROP POLICY IF EXISTS "orc-docs write" ON storage.objects;
CREATE POLICY "orc-docs write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'orcamento-docs');
DROP POLICY IF EXISTS "orc-docs delete" ON storage.objects;
CREATE POLICY "orc-docs delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'orcamento-docs');
