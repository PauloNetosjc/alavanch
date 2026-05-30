
CREATE TABLE public.comunicados_saas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  tipo text NOT NULL DEFAULT 'novidade',
  prioridade text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'rascunho',
  exibir_popup boolean NOT NULL DEFAULT true,
  permitir_fechar boolean NOT NULL DEFAULT true,
  data_inicio timestamptz,
  data_fim timestamptz,
  link_url text,
  anexo_url text,
  criado_por uuid,
  atualizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comunicados_saas_tipo_chk CHECK (tipo IN ('novidade','aviso','manutencao','financeiro','treinamento','sistema','urgente','outro')),
  CONSTRAINT comunicados_saas_prioridade_chk CHECK (prioridade IN ('baixa','normal','alta','critica')),
  CONSTRAINT comunicados_saas_status_chk CHECK (status IN ('rascunho','agendado','publicado','encerrado','cancelado'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunicados_saas TO authenticated;
GRANT ALL ON public.comunicados_saas TO service_role;
ALTER TABLE public.comunicados_saas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam comunicados_saas" ON public.comunicados_saas
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuarios leem comunicados publicados ativos" ON public.comunicados_saas
FOR SELECT TO authenticated
USING (
  status = 'publicado'
  AND (data_inicio IS NULL OR data_inicio <= now())
  AND (data_fim IS NULL OR data_fim >= now())
);

CREATE INDEX idx_comunicados_saas_status ON public.comunicados_saas(status);
CREATE INDEX idx_comunicados_saas_periodo ON public.comunicados_saas(data_inicio, data_fim);

CREATE TRIGGER trg_comunicados_saas_updated
BEFORE UPDATE ON public.comunicados_saas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.comunicados_saas_destinatarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comunicado_id uuid NOT NULL REFERENCES public.comunicados_saas(id) ON DELETE CASCADE,
  base_cliente_id uuid,
  loja_id uuid,
  enviar_para_todas_bases boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunicados_saas_destinatarios TO authenticated;
GRANT ALL ON public.comunicados_saas_destinatarios TO service_role;
ALTER TABLE public.comunicados_saas_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam destinatarios" ON public.comunicados_saas_destinatarios
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuarios leem destinatarios" ON public.comunicados_saas_destinatarios
FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_comunicados_destinatarios_comunicado ON public.comunicados_saas_destinatarios(comunicado_id);
CREATE INDEX idx_comunicados_destinatarios_base ON public.comunicados_saas_destinatarios(base_cliente_id);
CREATE INDEX idx_comunicados_destinatarios_loja ON public.comunicados_saas_destinatarios(loja_id);

CREATE TABLE public.comunicados_saas_leituras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comunicado_id uuid NOT NULL REFERENCES public.comunicados_saas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  base_cliente_id uuid,
  loja_id uuid,
  lido boolean NOT NULL DEFAULT false,
  fechado_em timestamptz,
  lido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comunicado_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunicados_saas_leituras TO authenticated;
GRANT ALL ON public.comunicados_saas_leituras TO service_role;
ALTER TABLE public.comunicados_saas_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e dono veem leituras" ON public.comunicados_saas_leituras
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "Usuario insere propria leitura" ON public.comunicados_saas_leituras
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuario atualiza propria leitura" ON public.comunicados_saas_leituras
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin deleta leituras" ON public.comunicados_saas_leituras
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_comunicados_leituras_user ON public.comunicados_saas_leituras(user_id);
CREATE INDEX idx_comunicados_leituras_comunicado ON public.comunicados_saas_leituras(comunicado_id);

INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
('sistema.comunicados_saas','view','Ver Comunicados SaaS','Sistema SaaS'),
('sistema.comunicados_saas','edit','Criar/editar/publicar Comunicados SaaS','Sistema SaaS'),
('sistema.comunicados_saas','delete','Excluir Comunicados SaaS','Sistema SaaS')
ON CONFLICT DO NOTHING;
