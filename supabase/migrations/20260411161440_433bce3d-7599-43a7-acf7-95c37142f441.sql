-- Pipeline stages table for dynamic Kanban columns per department
CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_type text NOT NULL,  -- 'contrato', 'revisao', 'montagem', 'financeiro', 'pos_montagem'
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  color text DEFAULT '#6b7280',
  is_initial boolean DEFAULT false,
  is_final boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pipeline_stages"
  ON public.pipeline_stages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage pipeline_stages"
  ON public.pipeline_stages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Default stages for each pipeline
INSERT INTO public.pipeline_stages (pipeline_type, name, display_order, color, is_initial, is_final) VALUES
  -- Contrato
  ('contrato', 'Pendente', 0, '#eab308', true, false),
  ('contrato', 'Em andamento', 1, '#3b82f6', false, false),
  ('contrato', 'Enviado', 2, '#f97316', false, false),
  ('contrato', 'Assinado', 3, '#22c55e', false, true),
  -- Revisão
  ('revisao', 'Pendente', 0, '#eab308', true, false),
  ('revisao', 'Em revisão', 1, '#3b82f6', false, false),
  ('revisao', 'Aguardando aprovação', 2, '#f97316', false, false),
  ('revisao', 'Aprovado', 3, '#22c55e', false, true),
  -- Montagem
  ('montagem', 'Pendente', 0, '#eab308', true, false),
  ('montagem', 'Agendada', 1, '#3b82f6', false, false),
  ('montagem', 'Em andamento', 2, '#f97316', false, false),
  ('montagem', 'Concluída', 3, '#22c55e', false, true),
  -- Financeiro
  ('financeiro', 'Pendente', 0, '#eab308', true, false),
  ('financeiro', 'Parcial', 1, '#f97316', false, false),
  ('financeiro', 'Quitado', 2, '#22c55e', false, true),
  -- Pós-montagem
  ('pos_montagem', 'Pendente', 0, '#eab308', true, false),
  ('pos_montagem', 'Em vistoria', 1, '#3b82f6', false, false),
  ('pos_montagem', 'Ajustes', 2, '#f97316', false, false),
  ('pos_montagem', 'Finalizado', 3, '#22c55e', false, true);
