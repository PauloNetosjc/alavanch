DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='solicitacoes_assinatura') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes_assinatura';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pedido_documentos') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pedido_documentos';
  END IF;
END $$;
ALTER TABLE public.solicitacoes_assinatura REPLICA IDENTITY FULL;
ALTER TABLE public.pedido_documentos REPLICA IDENTITY FULL;