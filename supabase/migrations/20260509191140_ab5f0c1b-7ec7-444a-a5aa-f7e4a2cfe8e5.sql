ALTER TABLE public.pipeline_estagios
  ADD COLUMN IF NOT EXISTS concluir_acao text NOT NULL DEFAULT 'proxima',
  ADD COLUMN IF NOT EXISTS concluir_pipeline_destino text,
  ADD COLUMN IF NOT EXISTS concluir_estagio_destino_id uuid REFERENCES public.pipeline_estagios(id) ON DELETE SET NULL;

ALTER TABLE public.pipeline_estagios
  DROP CONSTRAINT IF EXISTS pipeline_estagios_concluir_acao_check;
ALTER TABLE public.pipeline_estagios
  ADD CONSTRAINT pipeline_estagios_concluir_acao_check
  CHECK (concluir_acao IN ('proxima','outro_kanban','remover','desativado'));