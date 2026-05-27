CREATE UNIQUE INDEX IF NOT EXISTS uq_pedido_doc_assinatura_final
ON public.pedido_documentos (pedido_id, solicitacao_id)
WHERE bucket_name = 'assinaturas-finais';