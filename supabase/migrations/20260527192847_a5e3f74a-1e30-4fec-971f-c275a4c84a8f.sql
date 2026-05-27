CREATE OR REPLACE FUNCTION public.registrar_assinatura_manual(
  p_solic uuid,
  p_contrato_url text,
  p_contrato_path text,
  p_doc_cliente_url text DEFAULT NULL,
  p_doc_cliente_path text DEFAULT NULL,
  p_observacao text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;

  IF p_solic IS NULL OR p_contrato_url IS NULL THEN
    RAISE EXCEPTION 'Solicitação e arquivo do contrato assinado são obrigatórios.';
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

  -- Marca a solicitação como assinada manualmente
  UPDATE public.solicitacoes_assinatura
     SET status = 'assinado_manual',
         cliente_assinado_em = COALESCE(cliente_assinado_em, now()),
         loja_assinado_em    = COALESCE(loja_assinado_em, now()),
         concluido_em        = COALESCE(concluido_em, now()),
         updated_at          = now()
   WHERE id = p_solic;

  -- Evento de auditoria
  INSERT INTO public.assinatura_eventos (
    solicitacao_id, tipo_evento, status_novo, descricao, user_id
  ) VALUES (
    p_solic, 'assinado_manual', 'assinado_manual',
    COALESCE(p_observacao, 'Contrato assinado manualmente (upload físico).'),
    v_uid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_assinatura_manual(uuid, text, text, text, text, text) TO authenticated;