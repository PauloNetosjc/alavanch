-- Templates de checklist por tipo de serviço
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo_servico text NOT NULL,
  ativo boolean DEFAULT true,
  ordem int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_template_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  obrigatorio boolean DEFAULT true,
  ordem int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Itens de checklist marcados em cada chamado
CREATE TABLE public.assistencia_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistencia_id uuid NOT NULL REFERENCES public.assistencias(id) ON DELETE CASCADE,
  template_item_id uuid REFERENCES public.checklist_template_itens(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  obrigatorio boolean DEFAULT true,
  concluido boolean DEFAULT false,
  concluido_em timestamptz,
  concluido_por uuid,
  ordem int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Anexos extras (documentos/fotos) opcionalmente associados a um check-in
CREATE TABLE public.anexos_assistencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistencia_id uuid NOT NULL REFERENCES public.assistencias(id) ON DELETE CASCADE,
  checkin_id uuid REFERENCES public.checkins(id) ON DELETE SET NULL,
  nome text NOT NULL,
  url text NOT NULL,
  storage_path text,
  mime_type text,
  tamanho bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistencia_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anexos_assistencia ENABLE ROW LEVEL SECURITY;

-- Templates: leitura para todos autenticados, escrita só admin
CREATE POLICY ct_select ON public.checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY ct_admin_all ON public.checklist_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY cti_select ON public.checklist_template_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY cti_admin_all ON public.checklist_template_itens FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Checklist do chamado: qualquer autenticado pode ver/editar (já filtrado por assistência)
CREATE POLICY ac_select ON public.assistencia_checklist FOR SELECT TO authenticated USING (true);
CREATE POLICY ac_insert ON public.assistencia_checklist FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY ac_update ON public.assistencia_checklist FOR UPDATE TO authenticated USING (true);
CREATE POLICY ac_delete ON public.assistencia_checklist FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- Anexos
CREATE POLICY anx_select ON public.anexos_assistencia FOR SELECT TO authenticated USING (true);
CREATE POLICY anx_insert ON public.anexos_assistencia FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY anx_update ON public.anexos_assistencia FOR UPDATE TO authenticated USING (true);
CREATE POLICY anx_delete ON public.anexos_assistencia FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER tg_checklist_templates_upd BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed de 4 templates padrão
INSERT INTO public.checklist_templates (nome, tipo_servico, ordem) VALUES
  ('Garantia padrão','garantia',1),
  ('Reparo padrão','reparo',2),
  ('Ajuste padrão','ajuste',3),
  ('Substituição padrão','substituicao',4);

INSERT INTO public.checklist_template_itens (template_id, descricao, ordem)
SELECT id, d.descricao, d.ordem FROM public.checklist_templates t,
  LATERAL (VALUES
    ('Foto Antes',1),
    ('Foto Depois',2),
    ('Conferência do problema relatado',3),
    ('Teste funcional após intervenção',4),
    ('Limpeza da área',5),
    ('Assinatura do cliente',6)
  ) AS d(descricao, ordem)
WHERE t.tipo_servico IN ('garantia','reparo','ajuste','substituicao');