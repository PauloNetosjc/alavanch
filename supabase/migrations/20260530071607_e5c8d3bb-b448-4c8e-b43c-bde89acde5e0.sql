-- ============ CRM SaaS ============
CREATE TABLE public.saas_crm_oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_empresa text NOT NULL,
  razao_social text,
  nome_fantasia text,
  cnpj text,
  responsavel_nome text,
  email text,
  telefone text,
  origem text,
  sistema_saas_id uuid REFERENCES public.sistemas_saas(id) ON DELETE SET NULL,
  plano_interesse text,
  valor_implantacao_proposto numeric(14,2) DEFAULT 0,
  valor_mensal_proposto numeric(14,2) DEFAULT 0,
  lojas_previstas integer,
  usuarios_previstos integer,
  armazenamento_previsto_gb numeric(10,2),
  status text NOT NULL DEFAULT 'aberto',
  etapa text NOT NULL DEFAULT 'lead_novo',
  probabilidade integer,
  data_prevista_fechamento date,
  data_fechamento date,
  motivo_perda text,
  observacoes text,
  base_cliente_id uuid REFERENCES public.bases_clientes(id) ON DELETE SET NULL,
  criado_por uuid,
  atualizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saas_crm_op_status_chk CHECK (status IN ('aberto','ganho','perdido','convertido','cancelado')),
  CONSTRAINT saas_crm_op_etapa_chk CHECK (etapa IN ('lead_novo','qualificacao','apresentacao_agendada','proposta_enviada','negociacao','fechamento_ganho','fechamento_perdido','convertido_em_base'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_crm_oportunidades TO authenticated;
GRANT ALL ON public.saas_crm_oportunidades TO service_role;
ALTER TABLE public.saas_crm_oportunidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY saas_crm_op_select ON public.saas_crm_oportunidades FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'sistema.crm_saas','view'));
CREATE POLICY saas_crm_op_insert ON public.saas_crm_oportunidades FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'sistema.crm_saas','edit'));
CREATE POLICY saas_crm_op_update ON public.saas_crm_oportunidades FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'sistema.crm_saas','edit'));
CREATE POLICY saas_crm_op_delete ON public.saas_crm_oportunidades FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'sistema.crm_saas','delete'));

CREATE TRIGGER trg_saas_crm_op_updated BEFORE UPDATE ON public.saas_crm_oportunidades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_saas_crm_op_etapa ON public.saas_crm_oportunidades(etapa);
CREATE INDEX idx_saas_crm_op_status ON public.saas_crm_oportunidades(status);
CREATE INDEX idx_saas_crm_op_sistema ON public.saas_crm_oportunidades(sistema_saas_id);

-- ============ Histórico ============
CREATE TABLE public.saas_crm_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id uuid NOT NULL REFERENCES public.saas_crm_oportunidades(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL,
  descricao text,
  etapa_anterior text,
  etapa_nova text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.saas_crm_historico TO authenticated;
GRANT ALL ON public.saas_crm_historico TO service_role;
ALTER TABLE public.saas_crm_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY saas_crm_hist_select ON public.saas_crm_historico FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'sistema.crm_saas','view'));
CREATE POLICY saas_crm_hist_insert ON public.saas_crm_historico FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'sistema.crm_saas','edit'));

CREATE INDEX idx_saas_crm_hist_op ON public.saas_crm_historico(oportunidade_id, created_at DESC);

-- ============ Agenda SaaS ============
CREATE TABLE public.saas_agenda_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id uuid REFERENCES public.saas_crm_oportunidades(id) ON DELETE SET NULL,
  base_cliente_id uuid REFERENCES public.bases_clientes(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'reuniao',
  data_inicio timestamptz NOT NULL,
  data_fim timestamptz,
  status text NOT NULL DEFAULT 'agendado',
  responsavel_id uuid,
  participantes text,
  link_reuniao text,
  local text,
  observacoes text,
  criado_por uuid,
  atualizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saas_ag_tipo_chk CHECK (tipo IN ('reuniao','apresentacao','follow_up','fechamento','implantacao','treinamento','suporte','outro')),
  CONSTRAINT saas_ag_status_chk CHECK (status IN ('agendado','realizado','cancelado','remarcado','pendente'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_agenda_eventos TO authenticated;
GRANT ALL ON public.saas_agenda_eventos TO service_role;
ALTER TABLE public.saas_agenda_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY saas_ag_select ON public.saas_agenda_eventos FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'sistema.agenda_saas','view') OR has_permission(auth.uid(),'sistema.crm_saas','view'));
CREATE POLICY saas_ag_insert ON public.saas_agenda_eventos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'sistema.agenda_saas','edit') OR has_permission(auth.uid(),'sistema.crm_saas','edit'));
CREATE POLICY saas_ag_update ON public.saas_agenda_eventos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'sistema.agenda_saas','edit') OR has_permission(auth.uid(),'sistema.crm_saas','edit'));
CREATE POLICY saas_ag_delete ON public.saas_agenda_eventos FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'sistema.agenda_saas','delete'));

CREATE TRIGGER trg_saas_ag_updated BEFORE UPDATE ON public.saas_agenda_eventos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_saas_ag_data ON public.saas_agenda_eventos(data_inicio);
CREATE INDEX idx_saas_ag_op ON public.saas_agenda_eventos(oportunidade_id);
CREATE INDEX idx_saas_ag_base ON public.saas_agenda_eventos(base_cliente_id);

-- ============ Catálogo de permissões ============
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('sistema.crm_saas','view','Visualizar CRM SaaS','Sistema SaaS'),
  ('sistema.crm_saas','edit','Editar oportunidades do CRM SaaS','Sistema SaaS'),
  ('sistema.crm_saas','delete','Excluir oportunidades do CRM SaaS','Sistema SaaS'),
  ('sistema.agenda_saas','view','Visualizar Agenda SaaS','Sistema SaaS'),
  ('sistema.agenda_saas','edit','Editar eventos da Agenda SaaS','Sistema SaaS'),
  ('sistema.agenda_saas','delete','Excluir eventos da Agenda SaaS','Sistema SaaS')
ON CONFLICT (modulo, acao) DO UPDATE SET
  descricao = COALESCE(EXCLUDED.descricao, public.permissoes_modulos_catalogo.descricao),
  grupo = COALESCE(EXCLUDED.grupo, public.permissoes_modulos_catalogo.grupo);