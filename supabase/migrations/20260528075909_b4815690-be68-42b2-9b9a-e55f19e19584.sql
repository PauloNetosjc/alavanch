
-- 1. Coluna ativo
ALTER TABLE public.pedido_documentos
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_pedido_docs_contrato_ativo
  ON public.pedido_documentos (pedido_id, ativo)
  WHERE bucket_name IN ('assinaturas-finais','assinaturas-evidencias')
    AND solicitacao_id IS NOT NULL;

-- 2. Função de deduplicação por pedido
CREATE OR REPLACE FUNCTION public.fn_dedupe_contrato_contratado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Aplica apenas quando o registro é um "contrato contratado" ativo
  IF NEW.ativo IS TRUE
     AND NEW.solicitacao_id IS NOT NULL
     AND NEW.bucket_name IN ('assinaturas-finais','assinaturas-evidencias') THEN

    UPDATE public.pedido_documentos
       SET ativo = false
     WHERE pedido_id = NEW.pedido_id
       AND id <> NEW.id
       AND ativo = true
       AND solicitacao_id IS NOT NULL
       AND bucket_name IN ('assinaturas-finais','assinaturas-evidencias');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dedupe_contrato_contratado ON public.pedido_documentos;
CREATE TRIGGER trg_dedupe_contrato_contratado
AFTER INSERT OR UPDATE OF ativo, bucket_name, solicitacao_id, storage_path
ON public.pedido_documentos
FOR EACH ROW
EXECUTE FUNCTION public.fn_dedupe_contrato_contratado();

-- 3. Backfill: manter ativo apenas o mais recente por pedido
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY pedido_id ORDER BY COALESCE(assinado_em, created_at) DESC, created_at DESC) AS rn
  FROM public.pedido_documentos
  WHERE bucket_name IN ('assinaturas-finais','assinaturas-evidencias')
    AND solicitacao_id IS NOT NULL
)
UPDATE public.pedido_documentos pd
   SET ativo = false
  FROM ranked r
 WHERE pd.id = r.id
   AND r.rn > 1
   AND pd.ativo = true;
