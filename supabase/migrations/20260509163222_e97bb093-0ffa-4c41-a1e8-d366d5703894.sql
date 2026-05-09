-- Add checklist template association to pipeline stages
ALTER TABLE public.pipeline_estagios
  ADD COLUMN IF NOT EXISTS checklist_template_id uuid REFERENCES public.checklist_templates(id) ON DELETE SET NULL;

-- Restrict updates/inserts/deletes to admin only (was permissive)
DROP POLICY IF EXISTS pipeline_estagios_update ON public.pipeline_estagios;
DROP POLICY IF EXISTS pipeline_estagios_insert ON public.pipeline_estagios;
DROP POLICY IF EXISTS pipeline_estagios_delete ON public.pipeline_estagios;

CREATE POLICY pipeline_estagios_update ON public.pipeline_estagios
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY pipeline_estagios_insert ON public.pipeline_estagios
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY pipeline_estagios_delete ON public.pipeline_estagios
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
