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
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;

  IF p_solic IS NULL OR p_contrato_url IS NULL THEN
    RAISE EXCEPTION 'Solicitação e arquivo do contrato assinado são obrigatórios.';
  END IF;

  SELECT status INTO v_status_atual FROM public.solicitacoes_assinatura WHERE id = p_solic;
  IF v_status_atual = 'concluido' THEN
    RAISE EXCEPTION 'Este contrato já foi assinado digitalmente. Para substituir, cancele a assinatura digital primeiro.';
  END IF;

  -- Evidência principal: contrato assinado escaneado
  INSERT INTO public.assinatura_evidencias (
    solicitacao_id, assinatura_url, manual, tipo, aceite, aceite_texto
  ) VALUES (
    p_solic, p_contrato_url, true, 'contrato_assinado_manual', true,
    COALESCE(p_observacao, 'Assinatura manual registrada via upload do contrato físico.')
  );

  IF p_doc_cliente_url IS NOT NULL THEN
    INSERT INTO public.assinatura_evidencias (
      solicitacao_id, documento_foto_url, manual, tipo, aceite
    ) VALUES (
      p_solic, p_doc_cliente_url, true, 'documento_cliente_manual', true
    );
  END IF;

  -- Reutiliza participantes existentes; invalida token rotacionando-o (NOT NULL constraint)
  SELECT EXISTS(SELECT 1 FROM public.assinatura_participantes WHERE solicitacao_id = p_solic AND tipo = 'loja') INTO v_has_loja;
  SELECT EXISTS(SELECT 1 FROM public.assinatura_participantes WHERE solicitacao_id = p_solic AND tipo = 'cliente') INTO v_has_cliente;

  -- Pendentes -> cancelado_manual + token rotacionado (invalida link antigo sem violar NOT NULL)
  UPDATE public.assinatura_participantes
     SET status = 'cancelado_manual',
         token = encode(extensions.gen_random_bytes(32), 'hex'),
         updated_at = now()
   WHERE solicitacao_id = p_solic
     AND status NOT IN ('assinado','recusado');

  -- Cria os faltantes já como cancelado_manual (com token gerado) para manter trilha
  IF NOT v_has_loja THEN
    INSERT INTO public.assinatura_participantes (solicitacao_id, tipo, status, token)
    VALUES (p_solic, 'loja', 'cancelado_manual', encode(extensions.gen_random_bytes(32), 'hex'));
  END IF;
  IF NOT v_has_cliente THEN
    INSERT INTO public.assinatura_participantes (solicitacao_id, tipo, status, token)
    VALUES (p_solic, 'cliente', 'cancelado_manual', encode(extensions.gen_random_bytes(32), 'hex'));
  END IF;

  -- Solicitação: marca assinado_manual e rotaciona token (NOT NULL)
  UPDATE public.solicitacoes_assinatura
     SET status = 'assinado_manual',
         cliente_assinado_em = COALESCE(cliente_assinado_em, now()),
         loja_assinado_em    = COALESCE(loja_assinado_em, now()),
         concluido_em        = COALESCE(concluido_em, now()),
         final_pdf_url       = p_contrato_url,
         final_pdf_storage_path = COALESCE(p_contrato_path, final_pdf_storage_path),
         token               = encode(extensions.gen_random_bytes(32), 'hex'),
         updated_at          = now()
   WHERE id = p_solic;

  INSERT INTO public.assinatura_eventos (solicitacao_id, tipo_evento, status_novo, descricao, user_id)
  VALUES (p_solic, 'assinado_manual', 'assinado_manual',
    COALESCE(p_observacao, 'Contrato assinado manualmente (upload físico). Fluxo digital pendente foi encerrado.'), v_uid);

  INSERT INTO public.assinatura_eventos (solicitacao_id, tipo_evento, status_novo, descricao, user_id)
  VALUES (p_solic, 'links_digitais_encerrados', 'assinado_manual',
    'Links digitais pendentes foram invalidados após anexar contrato assinado manualmente.', v_uid);
END;
$function$;