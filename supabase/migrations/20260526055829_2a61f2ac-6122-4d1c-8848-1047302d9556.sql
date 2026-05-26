
ALTER TABLE public.crm_estagios
  ADD COLUMN IF NOT EXISTS sla_dias_uteis integer,
  ADD COLUMN IF NOT EXISTS checklist_template_id uuid REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concluir_acao text NOT NULL DEFAULT 'proxima',
  ADD COLUMN IF NOT EXISTS concluir_pipeline_destino text,
  ADD COLUMN IF NOT EXISTS concluir_estagio_destino_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_estagios_concluir_acao_check'
  ) THEN
    ALTER TABLE public.crm_estagios
      ADD CONSTRAINT crm_estagios_concluir_acao_check
      CHECK (concluir_acao IN ('proxima','outro_kanban','remover','desativado'));
  END IF;
END $$;

ALTER TABLE public.crm_automacoes
  ADD COLUMN IF NOT EXISTS pipeline_destino text,
  ADD COLUMN IF NOT EXISTS ajustar_prazo_dias integer;
