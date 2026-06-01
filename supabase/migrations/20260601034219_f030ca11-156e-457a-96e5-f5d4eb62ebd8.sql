-- Módulo WhatsApp (opcional por loja)
INSERT INTO public.modulos_sistema (chave, nome, descricao, categoria, essencial, ordem) VALUES
  ('whatsapp','WhatsApp','Atendimento WhatsApp Web (QR) + Cloud API (preparado)','comunicacao',false,95)
ON CONFLICT (chave) DO NOTHING;

-- Permissões do módulo
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('whatsapp','visualizar','Acessar módulo WhatsApp','Comunicação'),
  ('whatsapp','configurar','Configurar contas/conexões WhatsApp','Comunicação'),
  ('whatsapp','enviar','Enviar mensagens WhatsApp','Comunicação'),
  ('whatsapp','sincronizar','Sincronizar histórico recente','Comunicação')
ON CONFLICT DO NOTHING;

-- ENUMs
DO $$ BEGIN
  CREATE TYPE public.whatsapp_tipo_integracao AS ENUM ('whatsapp_web','cloud_api');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.whatsapp_status_conexao AS ENUM ('desconectado','aguardando_qr','conectando','conectado','erro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.whatsapp_historico_status AS ENUM ('nao_iniciado','sincronizando','sincronizado','parcial','erro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.whatsapp_mensagem_direcao AS ENUM ('entrada','saida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABELAS ============

-- Contas WhatsApp (uma ou mais por loja)
CREATE TABLE IF NOT EXISTS public.whatsapp_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo_integracao public.whatsapp_tipo_integracao NOT NULL DEFAULT 'whatsapp_web',
  status_conexao public.whatsapp_status_conexao NOT NULL DEFAULT 'desconectado',
  numero_conectado text,
  jid text,
  qr_code text,
  qr_atualizado_em timestamptz,
  ultima_conexao_em timestamptz,
  ultima_desconexao_em timestamptz,
  sincronizar_historico boolean NOT NULL DEFAULT true,
  ultima_sincronizacao_historico_em timestamptz,
  historico_sync_status public.whatsapp_historico_status NOT NULL DEFAULT 'nao_iniciado',
  historico_sync_mensagem text,
  -- Cloud API (preparado para futuro)
  cloud_api_token text,
  cloud_api_phone_number_id text,
  cloud_api_business_account_id text,
  cloud_api_webhook_verify_token text,
  -- Sessão (referência opaca; sessão real persiste no gateway)
  sessao_ref text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_contas TO authenticated;
GRANT ALL ON public.whatsapp_contas TO service_role;
ALTER TABLE public.whatsapp_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY wa_contas_select ON public.whatsapp_contas FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = whatsapp_contas.loja_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY wa_contas_insert ON public.whatsapp_contas FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = whatsapp_contas.loja_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY wa_contas_update ON public.whatsapp_contas FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = whatsapp_contas.loja_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY wa_contas_delete ON public.whatsapp_contas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_wa_contas_loja ON public.whatsapp_contas(loja_id);

-- Contatos
CREATE TABLE IF NOT EXISTS public.whatsapp_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.whatsapp_contas(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL,
  wa_id text NOT NULL,
  numero text,
  nome text,
  push_name text,
  avatar_url text,
  cliente_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id, wa_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_contatos TO authenticated;
GRANT ALL ON public.whatsapp_contatos TO service_role;
ALTER TABLE public.whatsapp_contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_contatos_all ON public.whatsapp_contatos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = whatsapp_contatos.loja_id) OR public.has_role(auth.uid(),'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = whatsapp_contatos.loja_id) OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_wa_contatos_loja ON public.whatsapp_contatos(loja_id);
CREATE INDEX IF NOT EXISTS idx_wa_contatos_conta ON public.whatsapp_contatos(conta_id);

-- Conversas
CREATE TABLE IF NOT EXISTS public.whatsapp_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.whatsapp_contas(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL,
  contato_id uuid REFERENCES public.whatsapp_contatos(id) ON DELETE SET NULL,
  wa_chat_id text NOT NULL,
  titulo text,
  is_group boolean NOT NULL DEFAULT false,
  ultima_mensagem_em timestamptz,
  ultima_mensagem_preview text,
  nao_lidas integer NOT NULL DEFAULT 0,
  arquivado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id, wa_chat_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversas TO authenticated;
GRANT ALL ON public.whatsapp_conversas TO service_role;
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_conv_all ON public.whatsapp_conversas FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = whatsapp_conversas.loja_id) OR public.has_role(auth.uid(),'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = whatsapp_conversas.loja_id) OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_wa_conv_loja ON public.whatsapp_conversas(loja_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_conta ON public.whatsapp_conversas(conta_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_ultima ON public.whatsapp_conversas(ultima_mensagem_em DESC);

-- Mensagens
CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.whatsapp_contas(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL,
  conversa_id uuid REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  wa_message_id text,
  wa_chat_id text NOT NULL,
  direcao public.whatsapp_mensagem_direcao NOT NULL,
  tipo text NOT NULL DEFAULT 'text',
  texto text,
  media_url text,
  mime_type text,
  status text,
  origem text NOT NULL DEFAULT 'whatsapp_web_runtime',
  enviado_em timestamptz NOT NULL DEFAULT now(),
  payload_bruto jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id, wa_message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_mensagens TO authenticated;
GRANT ALL ON public.whatsapp_mensagens TO service_role;
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_msg_all ON public.whatsapp_mensagens FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = whatsapp_mensagens.loja_id) OR public.has_role(auth.uid(),'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = whatsapp_mensagens.loja_id) OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_wa_msg_loja ON public.whatsapp_mensagens(loja_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_conv ON public.whatsapp_mensagens(conversa_id, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_wa_msg_conta ON public.whatsapp_mensagens(conta_id, enviado_em DESC);

-- Eventos / logs técnicos (webhook do gateway, QR atualizado, etc.)
CREATE TABLE IF NOT EXISTS public.whatsapp_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid REFERENCES public.whatsapp_contas(id) ON DELETE CASCADE,
  loja_id uuid,
  tipo text NOT NULL,
  mensagem text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.whatsapp_eventos TO authenticated;
GRANT ALL ON public.whatsapp_eventos TO service_role;
ALTER TABLE public.whatsapp_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_eventos_select ON public.whatsapp_eventos FOR SELECT TO authenticated
USING (loja_id IS NULL OR EXISTS (SELECT 1 FROM public.user_lojas ul WHERE ul.user_id = auth.uid() AND ul.loja_id = whatsapp_eventos.loja_id) OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_wa_eventos_conta ON public.whatsapp_eventos(conta_id, created_at DESC);

-- Triggers updated_at
CREATE TRIGGER trg_wa_contas_updated BEFORE UPDATE ON public.whatsapp_contas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wa_contatos_updated BEFORE UPDATE ON public.whatsapp_contatos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wa_conv_updated BEFORE UPDATE ON public.whatsapp_conversas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();