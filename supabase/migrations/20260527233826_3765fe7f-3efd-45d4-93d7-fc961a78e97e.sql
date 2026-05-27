
CREATE OR REPLACE FUNCTION public.registrar_assinatura_manual(
  p_solic uuid,
  p_contrato_url text,
  p_contrato_path text,
  p_doc_cliente_url text DEFAULT NULL,
  p_doc_cliente_path text DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_status_atual public.assinatura_status;
  v_has_loja boolean;
  v_has_cliente boolean;
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

  -- Tenta extrair tamanho/mime do storage
  SELECT (metadata->>'size')::bigint, metadata->>'mimetype'
    INTO v_contrato_size, v_contrato_mime
    FROM storage.objects
   WHERE bucket_id = 'assinaturas-evidencias' AND name = p_contrato_path;
  v_contrato_mime := COALESCE(v_contrato_mime, 'application/pdf');

  IF p_doc_cliente_path IS NOT NULL THEN
    SELECT (metadata->>'size')::bigint, metadata->>'mimetype'
      INTO v_doc_size, v_doc_mime
      FROM storage.objects
     WHERE bucket_id = 'assinaturas-evidencias' AND name = p_doc_cliente_path;
    v_doc_mime := COALESCE(v_doc_mime, 'application/octet-stream');
  END IF;

  -- Evidências
  INSERT INTO public.assinatura_evidencias (solicitacao_id, assinatura_url, manual, tipo, aceite, aceite_texto)
  VALUES (p_solic, p_contrato_url, true, 'contrato_assinado_manual', true,
          COALESCE(p_observacao, 'Assinatura manual registrada via upload do contrato físico.'));

  IF p_doc_cliente_url IS NOT NULL THEN
    INSERT INTO public.assinatura_evidencias (solicitacao_id, documento_foto_url, manual, tipo, aceite)
    VALUES (p_solic, p_doc_cliente_url, true, 'documento_cliente_manual', true);
  END IF;

  -- Participantes — invalida tokens
  SELECT EXISTS(SELECT 1 FROM public.assinatura_participantes WHERE solicitacao_id = p_solic AND tipo = 'loja') INTO v_has_loja;
  SELECT EXISTS(SELECT 1 FROM public.assinatura_participantes WHERE solicitacao_id = p_solic AND tipo = 'cliente') INTO v_has_cliente;

  UPDATE public.assinatura_participantes
     SET status = 'cancelado_manual',
         token  = encode(extensions.gen_random_bytes(32), 'hex'),
         updated_at = now()
   WHERE solicitacao_id = p_solic
     AND status NOT IN ('assinado','recusado');

  IF NOT v_has_loja THEN
    INSERT INTO public.assinatura_participantes (solicitacao_id, tipo, status, token)
    VALUES (p_solic, 'loja', 'cancelado_manual', encode(extensions.gen_random_bytes(32), 'hex'));
  END IF;
  IF NOT v_has_cliente THEN
    INSERT INTO public.assinatura_participantes (solicitacao_id, tipo, status, token)
    VALUES (p_solic, 'cliente', 'cancelado_manual', encode(extensions.gen_random_bytes(32), 'hex'));
  END IF;

  -- Solicitação
  UPDATE public.solicitacoes_assinatura
     SET status = 'assinado_manual',
         cliente_assinado_em    = COALESCE(cliente_assinado_em, now()),
         loja_assinado_em       = COALESCE(loja_assinado_em, now()),
         concluido_em           = COALESCE(concluido_em, now()),
         final_pdf_url          = p_contrato_url,
         final_pdf_storage_path = COALESCE(p_contrato_path, final_pdf_storage_path),
         token                  = encode(extensions.gen_random_bytes(32), 'hex'),
         updated_at             = now()
   WHERE id = p_solic;

  -- Contrato: marca assinado_manual + método manual + pdf assinado
  IF v_solic.contrato_id IS NOT NULL THEN
    UPDATE public.contratos
       SET status               = 'assinado_manual',
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

    v_nome_contrato := 'Contrato assinado manualmente - ' || COALESCE(v_pedido.codigo,'') || '.pdf';

    -- Upsert do contrato manual em pedido_documentos (idempotente por solicitacao+nome)
    SELECT id INTO v_doc_id FROM public.pedido_documentos
     WHERE pedido_id = v_pedido.id
       AND solicitacao_id = p_solic
       AND nome = v_nome_contrato
     LIMIT 1;

    IF v_doc_id IS NULL THEN
      INSERT INTO public.pedido_documentos
        (pedido_id, pasta_id, solicitacao_id, nome, bucket_name, storage_path, mime_type, tamanho, created_by, assinado_em)
      VALUES
        (v_pedido.id, v_pasta_id, p_solic, v_nome_contrato, 'assinaturas-evidencias',
         p_contrato_path, v_contrato_mime, v_contrato_size, v_uid, now());
    ELSE
      UPDATE public.pedido_documentos
         SET bucket_name = 'assinaturas-evidencias',
             storage_path = p_contrato_path,
             mime_type = v_contrato_mime,
             tamanho   = v_contrato_size,
             pasta_id  = v_pasta_id,
             assinado_em = COALESCE(assinado_em, now())
       WHERE id = v_doc_id;
    END IF;

    -- Documento do cliente (opcional)
    IF p_doc_cliente_path IS NOT NULL THEN
      v_nome_doc := 'Documento do cliente - ' || COALESCE(v_pedido.codigo,'');
      SELECT id INTO v_doc_id FROM public.pedido_documentos
       WHERE pedido_id = v_pedido.id
         AND solicitacao_id = p_solic
         AND nome = v_nome_doc
       LIMIT 1;
      IF v_doc_id IS NULL THEN
        INSERT INTO public.pedido_documentos
          (pedido_id, pasta_id, solicitacao_id, nome, bucket_name, storage_path, mime_type, tamanho, created_by)
        VALUES
          (v_pedido.id, v_pasta_id, p_solic, v_nome_doc, 'assinaturas-evidencias',
           p_doc_cliente_path, v_doc_mime, v_doc_size, v_uid);
      ELSE
        UPDATE public.pedido_documentos
           SET bucket_name = 'assinaturas-evidencias',
               storage_path = p_doc_cliente_path,
               mime_type = v_doc_mime,
               tamanho   = v_doc_size,
               pasta_id  = v_pasta_id
         WHERE id = v_doc_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.assinatura_eventos (solicitacao_id, tipo_evento, status_novo, descricao, user_id)
  VALUES (p_solic, 'assinado_manual', 'assinado_manual',
    COALESCE(p_observacao, 'Contrato assinado manualmente (upload físico). Fluxo digital pendente foi encerrado.'), v_uid);

  INSERT INTO public.assinatura_eventos (solicitacao_id, tipo_evento, status_novo, descricao, user_id)
  VALUES (p_solic, 'links_digitais_encerrados', 'assinado_manual',
    'Links digitais pendentes foram invalidados após anexar contrato assinado manualmente.', v_uid);
END;
$function$;
