UPDATE storage.buckets SET public = true WHERE id IN ('orcamento-docs','pedido-docs','order-attachments','contratos-assinatura');

-- Public read policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read pedido buckets') THEN
    CREATE POLICY "Public read pedido buckets" ON storage.objects FOR SELECT
      USING (bucket_id IN ('orcamento-docs','pedido-docs','order-attachments','contratos-assinatura'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Auth upload pedido buckets') THEN
    CREATE POLICY "Auth upload pedido buckets" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id IN ('orcamento-docs','pedido-docs','order-attachments','contratos-assinatura'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Auth update pedido buckets') THEN
    CREATE POLICY "Auth update pedido buckets" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id IN ('orcamento-docs','pedido-docs','order-attachments','contratos-assinatura'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Auth delete pedido buckets') THEN
    CREATE POLICY "Auth delete pedido buckets" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id IN ('orcamento-docs','pedido-docs','order-attachments','contratos-assinatura'));
  END IF;
END $$;