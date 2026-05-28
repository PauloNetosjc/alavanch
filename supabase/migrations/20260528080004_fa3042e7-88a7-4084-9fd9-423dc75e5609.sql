
CREATE OR REPLACE FUNCTION public.registrar_assinatura_manual(
  p_solic uuid,
  p_contrato_url text,
  p_contrato_path text,
  p_doc_cliente_url text DEFAULT NULL::text,
  p_doc_cliente_path text DEFAULT NULL::text,
  p_observacao text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_solic record;
  v_pedido record;
  v_pasta_id uuid;
  v_doc_id uuid;
  v_contrato_size bigint;
  v_doc_size bigint;
  v_contrato_mime text;
  v_doc_mime text;
  v_nome_contrato text;
  v_nome_doc text;
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;

  IF p_solic IS NULL OR p_contrato_url IS NULL THEN
    RAISE EXCEPTION 'Solicitação e arquivo do contrato assinado são obrigatórios.';
  END IF;

  SELECT * INTO v_solic FROM public.solicitacoes_assinatura WHERE id = p_solic;
  IF v_solic.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF v_solic.status = 'concluido' THEN
    RAISE EXCEPTION 'Este contrato já foi assinado digitalmente. Para substituir, cancele a assinatura digital primeiro.';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = v_solic.pedido_id;

  SELECT (metadata->>'size')::bigint, metadata->>'mimetype'
    INTO v_contrato_size, v_contrato_mime
    FROM storage.objects
   WHERE bucket_id = 'assinaturas-evidencias' AND name = p_contrato_path
   LIMIT 1;

  IF p_doc_cliente_path IS NOT NULL THEN
    SELECT (metadata->>'size')::bigint, metadata->>'mimetype'
      INTO v_doc_size, v_doc_mime
      FROM storage.objects
     WHERE bucket_id = 'assinaturas-evidencias' AND name = p_doc_cliente_path
     LIMIT 1;
  END IF;

  -- Atualiza solicitação
  UPDATE public.solicitacoes_assinatura
     SET status = 'assinado_manual'::public.assinatura_status,
         metodo_assinatura = 'manual',
         observacao_manual = COALESCE(p_observacao, observacao_manual),
         assinado_manual_por = v_uid,
         assinado_manual_em = now(),
         updated_at = now()
   WHERE id = p_solic;

  -- Atualiza contrato vinculado
  IF v_solic.contrato_id IS NOT NULL THEN
    UPDATE public.contratos
       SET status               = 'assinado',
           metodo_assinatura    = 'manual',
           pdf_assinado_url     = p_contrato_url,
           documento_cliente_url = COALESCE(p_doc_cliente_url, documento_cliente_url),
           assinado_em          = COALESCE(assinado_em, now()),
           updated_at           = now()
     WHERE id = v_solic.contrato_id;
  END IF;

  -- Pasta "Documentos"
  IF v_pedido.id IS NOT NULL THEN
    SELECT id INTO v_pasta_id FROM public.pedido_pastas
     WHERE pedido_id = v_pedido.id AND lower(nome) = 'documentos'
     ORDER BY created_at ASC LIMIT 1;
    IF v_pasta_id IS NULL THEN
      INSERT INTO public.pedido_pastas (pedido_id, nome, ordem)
      VALUES (v_pedido.id, 'Documentos', 99)
      RETURNING id INTO v_pasta_id;
    END IF;

    v_nome_contrato := 'Contrato contratado - ' || COALESCE(v_pedido.codigo,'') || '.pdf';

    SELECT id INTO v_doc_id FROM public.pedido_documentos
     WHERE pedido_id = v_pedido.id
       AND solicitacao_id = p_solic
       AND bucket_name = 'assinaturas-evidencias'
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_doc_id IS NULL THEN
      INSERT INTO public.pedido_documentos
        (pedido_id, pasta_id, solicitacao_id, nome, bucket_name, storage_path, mime_type, tamanho, created_by, assinado_em, ativo)
      VALUES
        (v_pedido.id, v_pasta_id, p_solic, v_nome_contrato, 'assinaturas-evidencias',
         p_contrato_path, v_contrato_mime, v_contrato_size, v_uid, now(), true);
    ELSE
      UPDATE public.pedido_documentos
         SET nome = v_nome_contrato,
             bucket_name = 'assinaturas-evidencias',
             storage_path = p_contrato_path,
             mime_type = v_contrato_mime,
             tamanho   = v_contrato_size,
             pasta_id  = v_pasta_id,
             ativo     = true,
             assinado_em = COALESCE(assinado_em, now())
       WHERE id = v_doc_id;
    END IF;

    -- Documento do cliente (opcional) — não é contrato contratado
    IF p_doc_cliente_path IS NOT NULL THEN
      v_nome_doc := 'Documento do cliente - ' || COALESCE(v_pedido.codigo,'') || '.' ||
                    COALESCE(NULLIF(regexp_replace(p_doc_cliente_path, '.*\.', ''), p_doc_cliente_path), 'pdf');
      INSERT INTO public.pedido_documentos
        (pedido_id, pasta_id, solicitacao_id, nome, bucket_name, storage_path, mime_type, tamanho, created_by)
      SELECT v_pedido.id, v_pasta_id, p_solic, v_nome_doc, 'assinaturas-evidencias',
             p_doc_cliente_path, v_doc_mime, v_doc_size, v_uid
       WHERE NOT EXISTS (
         SELECT 1 FROM public.pedido_documentos
          WHERE pedido_id = v_pedido.id
            AND solicitacao_id = p_solic
            AND storage_path = p_doc_cliente_path
       );
    END IF;
  END IF;
END;
$function$;
