
-- Storage bucket para evidências de assinatura (público para leitura)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('assinaturas-evidencias', 'assinaturas-evidencias', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/jpg','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

-- Policies do bucket
DROP POLICY IF EXISTS "ae_storage_select_public" ON storage.objects;
CREATE POLICY "ae_storage_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'assinaturas-evidencias');

DROP POLICY IF EXISTS "ae_storage_insert_anon" ON storage.objects;
CREATE POLICY "ae_storage_insert_anon" ON storage.objects
  FOR INSERT TO anon WITH CHECK (
    bucket_id = 'assinaturas-evidencias'
    AND EXISTS (
      SELECT 1 FROM public.solicitacoes_assinatura s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND s.token IS NOT NULL
        AND s.expira_em > now()
    )
  );

DROP POLICY IF EXISTS "ae_storage_insert_auth" ON storage.objects;
CREATE POLICY "ae_storage_insert_auth" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'assinaturas-evidencias');

-- Adiciona campos snapshot ao solicitacoes_assinatura
ALTER TABLE public.solicitacoes_assinatura
  ADD COLUMN IF NOT EXISTS cliente_email text,
  ADD COLUMN IF NOT EXISTS cliente_telefone text,
  ADD COLUMN IF NOT EXISTS cliente_nome text,
  ADD COLUMN IF NOT EXISTS cliente_ip text,
  ADD COLUMN IF NOT EXISTS cliente_user_agent text,
  ADD COLUMN IF NOT EXISTS assinatura_cliente_url text,
  ADD COLUMN IF NOT EXISTS assinatura_loja_url text,
  ADD COLUMN IF NOT EXISTS doc_foto_url text,
  ADD COLUMN IF NOT EXISTS selfie_url text;

-- RPC para criar solicitação de assinatura para qualquer documento (uso interno)
CREATE OR REPLACE FUNCTION public.criar_solic_assinatura_documento(
  p_pedido_id uuid,
  p_pedido_documento_id uuid,
  p_tipo_slug text DEFAULT 'projeto_inicial',
  p_dias_validade int DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ped record; v_doc record; v_tipo uuid; v_existing uuid; v_id uuid;
BEGIN
  SELECT id, cliente_id, loja_id INTO v_ped FROM pedidos WHERE id = p_pedido_id;
  IF v_ped.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  SELECT * INTO v_doc FROM pedido_documentos WHERE id = p_pedido_documento_id;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Documento não encontrado'; END IF;
  SELECT id INTO v_tipo FROM tipos_documento WHERE slug = p_tipo_slug LIMIT 1;
  IF v_tipo IS NULL THEN RAISE EXCEPTION 'Tipo de documento não cadastrado: %', p_tipo_slug; END IF;

  SELECT id INTO v_existing FROM solicitacoes_assinatura
   WHERE pedido_documento_id = p_pedido_documento_id AND status NOT IN ('cancelado','expirado','recusado')
   LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO solicitacoes_assinatura (
    pedido_id, tipo_documento_id, cliente_id, loja_id, pedido_documento_id,
    file_name, file_url, storage_path, status, expira_em, created_by
  ) VALUES (
    v_ped.id, v_tipo, v_ped.cliente_id, v_ped.loja_id, v_doc.id,
    coalesce(v_doc.nome, p_tipo_slug),
    null,
    v_doc.storage_path,
    'aguardando_cliente',
    now() + (p_dias_validade || ' days')::interval,
    auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO assinatura_eventos(solicitacao_id, tipo_evento, status_anterior, status_novo, descricao)
  VALUES (v_id, 'criado_manual', null, 'aguardando_cliente', 'Solicitação criada para documento ' || coalesce(v_doc.nome,''));

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.criar_solic_assinatura_documento(uuid,uuid,text,int) TO authenticated;
