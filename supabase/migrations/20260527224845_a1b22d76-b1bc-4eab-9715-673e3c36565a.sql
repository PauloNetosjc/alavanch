
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
  v_status_atual public.assinatura_status;
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

  -- Evidência opcional: documento de identificação do cliente
  IF p_doc_cliente_url IS NOT NULL THEN
    INSERT INTO public.assinatura_evidencias (
      solicitacao_id, documento_foto_url, manual, tipo, aceite
    ) VALUES (
      p_solic, p_doc_cliente_url, true, 'documento_cliente_manual', true
    );
  END IF;

  -- Cancela/encerra participantes ainda pendentes (digital substituído por manual)
  -- e invalida os tokens dos links digitais.
  UPDATE public.assinatura_participantes
     SET status = 'cancelado_manual',
         token = NULL,
         updated_at = now()
   WHERE solicitacao_id = p_solic
     AND status NOT IN ('assinado','recusado');

  -- Marca a solicitação como assinada manualmente, registrando PDF final = contrato escaneado
  UPDATE public.solicitacoes_assinatura
     SET status = 'assinado_manual',
         cliente_assinado_em = COALESCE(cliente_assinado_em, now()),
         loja_assinado_em    = COALESCE(loja_assinado_em, now()),
         concluido_em        = COALESCE(concluido_em, now()),
         final_pdf_url       = p_contrato_url,
         final_pdf_storage_path = COALESCE(p_contrato_path, final_pdf_storage_path),
         token               = NULL,
         updated_at          = now()
   WHERE id = p_solic;

  -- Eventos de auditoria
  INSERT INTO public.assinatura_eventos (
    solicitacao_id, tipo_evento, status_novo, descricao, user_id
  ) VALUES (
    p_solic, 'assinado_manual', 'assinado_manual',
    COALESCE(p_observacao, 'Contrato assinado manualmente (upload físico). Fluxo digital pendente foi encerrado.'),
    v_uid
  );

  INSERT INTO public.assinatura_eventos (
    solicitacao_id, tipo_evento, status_novo, descricao, user_id
  ) VALUES (
    p_solic, 'links_digitais_encerrados', 'assinado_manual',
    'Links digitais pendentes foram invalidados após anexar contrato assinado manualmente.',
    v_uid
  );
END;
$function$;
