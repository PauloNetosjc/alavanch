
ALTER TABLE public.fabrica_arquivos_tecnicos
  ADD COLUMN IF NOT EXISTS status_arquivo text NOT NULL DEFAULT 'enviado';

ALTER TABLE public.fabrica_arquivos_tecnicos
  DROP CONSTRAINT IF EXISTS fabrica_arquivos_tecnicos_status_arquivo_check;
ALTER TABLE public.fabrica_arquivos_tecnicos
  ADD CONSTRAINT fabrica_arquivos_tecnicos_status_arquivo_check
  CHECK (status_arquivo IN ('enviado','catalogado_nao_enviado','erro_upload','ignorado'));

ALTER TABLE public.fabrica_importacoes_tecnicas
  ADD COLUMN IF NOT EXISTS modo_importacao text NOT NULL DEFAULT 'rapida';
ALTER TABLE public.fabrica_importacoes_tecnicas
  DROP CONSTRAINT IF EXISTS fabrica_importacoes_tecnicas_modo_importacao_check;
ALTER TABLE public.fabrica_importacoes_tecnicas
  ADD CONSTRAINT fabrica_importacoes_tecnicas_modo_importacao_check
  CHECK (modo_importacao IN ('rapida','completa'));

CREATE INDEX IF NOT EXISTS idx_fab_arqtec_status ON public.fabrica_arquivos_tecnicos(status_arquivo);
