
-- =========================================
-- Etapa 1: Contratos SaaS - estrutura base
-- =========================================

-- 1. base_modelos_contrato
CREATE TABLE public.base_modelos_contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  conteudo_html text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  atualizado_por uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_modelos_contrato TO authenticated;
GRANT ALL ON public.base_modelos_contrato TO service_role;

ALTER TABLE public.base_modelos_contrato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam modelos contrato"
ON public.base_modelos_contrato
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. base_contratos
CREATE TABLE public.base_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_cliente_id uuid NOT NULL REFERENCES public.bases_clientes(id) ON DELETE CASCADE,
  assinatura_id uuid REFERENCES public.base_assinaturas(id) ON DELETE SET NULL,
  modelo_id uuid REFERENCES public.base_modelos_contrato(id) ON DELETE SET NULL,
  numero_contrato text UNIQUE,
  tipo_contrato text NOT NULL DEFAULT 'contrato_inicial', -- contrato_inicial, renovacao, aditivo, cancelamento
  status text NOT NULL DEFAULT 'rascunho', -- rascunho, aguardando_assinatura, enviado_para_assinatura, assinado, anexado_manual, cancelado, expirado
  plano text,
  valor_implantacao numeric(14,2) DEFAULT 0,
  valor_mensal numeric(14,2) DEFAULT 0,
  dia_vencimento integer,
  lojas_incluidas integer DEFAULT 1,
  usuarios_incluidos integer DEFAULT 1,
  armazenamento_incluido_mb numeric DEFAULT 0,
  armazenamento_adicional_mb numeric DEFAULT 0,
  data_inicio date,
  data_fim date,
  data_envio_assinatura timestamptz,
  data_assinatura timestamptz,
  assinatura_token uuid DEFAULT gen_random_uuid(),
  assinatura_url text,
  pdf_url text,
  arquivo_assinado_url text,
  conteudo_html text,
  assinante_nome text,
  assinante_documento text,
  assinante_email text,
  assinante_ip text,
  assinante_user_agent text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  atualizado_por uuid
);

CREATE INDEX idx_base_contratos_base ON public.base_contratos(base_cliente_id);
CREATE INDEX idx_base_contratos_status ON public.base_contratos(status);
CREATE INDEX idx_base_contratos_token ON public.base_contratos(assinatura_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_contratos TO authenticated;
GRANT ALL ON public.base_contratos TO service_role;

ALTER TABLE public.base_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam contratos saas"
ON public.base_contratos
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. contrato_id em base_cobrancas
ALTER TABLE public.base_cobrancas
  ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES public.base_contratos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_base_cobrancas_contrato ON public.base_cobrancas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_base_cobrancas_competencia ON public.base_cobrancas(base_cliente_id, tipo_cobranca, competencia_ano, competencia_mes);

-- 4. Trigger de numeração de contrato CT-YYYY-XXXX
CREATE OR REPLACE FUNCTION public.gerar_numero_contrato_saas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano text;
  v_seq int;
BEGIN
  IF NEW.numero_contrato IS NULL OR NEW.numero_contrato = '' THEN
    v_ano := to_char(now(), 'YYYY');
    SELECT COALESCE(MAX(CAST(split_part(numero_contrato, '-', 3) AS int)), 0) + 1
      INTO v_seq
      FROM public.base_contratos
      WHERE numero_contrato LIKE 'CT-' || v_ano || '-%';
    NEW.numero_contrato := 'CT-' || v_ano || '-' || lpad(v_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_base_contratos_numero
BEFORE INSERT ON public.base_contratos
FOR EACH ROW
EXECUTE FUNCTION public.gerar_numero_contrato_saas();

-- 5. Trigger updated_at
CREATE TRIGGER trg_base_contratos_updated
BEFORE UPDATE ON public.base_contratos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_base_modelos_contrato_updated
BEFORE UPDATE ON public.base_modelos_contrato
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Permissões no catálogo
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('sistema.contratos_saas', 'view', 'Visualizar contratos SaaS das bases', 'sistema'),
  ('sistema.contratos_saas', 'edit', 'Criar/editar contratos SaaS das bases', 'sistema'),
  ('sistema.contratos_saas', 'delete', 'Excluir contratos SaaS', 'sistema'),
  ('sistema.modelos_contrato_saas', 'view', 'Visualizar modelos de contrato SaaS', 'sistema'),
  ('sistema.modelos_contrato_saas', 'edit', 'Criar/editar modelos de contrato SaaS', 'sistema'),
  ('sistema.modelos_contrato_saas', 'delete', 'Excluir modelos de contrato SaaS', 'sistema')
ON CONFLICT DO NOTHING;

-- 7. Seed do modelo padrão de contrato SaaS
INSERT INTO public.base_modelos_contrato (nome, descricao, conteudo_html, ativo, padrao)
VALUES (
  'Contrato Padrão SaaS Alavanch',
  'Modelo inicial de contrato de licença de uso do sistema Alavanch.',
  '<h1 style="text-align:center;">CONTRATO DE LICENÇA DE USO DE SOFTWARE</h1>
<p><strong>CONTRATANTE:</strong> {{razao_social}}, inscrita no CNPJ sob nº {{cnpj}}, representada por {{responsavel_nome}}, e-mail {{email_responsavel}}, telefone {{telefone_responsavel}}.</p>
<p><strong>CONTRATADA:</strong> Alavanch Sistemas.</p>

<h2>1. Objeto</h2>
<p>Licença de uso, não exclusiva e intransferível, do sistema Alavanch ({{plano}}) pela CONTRATANTE.</p>

<h2>2. Implantação</h2>
<p>Valor de implantação: R$ {{valor_implantacao}}, pago conforme cronograma acordado.</p>

<h2>3. Mensalidade</h2>
<p>Valor mensal: R$ {{valor_mensal}}, com vencimento todo dia {{dia_vencimento}} de cada mês.</p>

<h2>4. Módulos e limites contratados</h2>
<p>Lojas incluídas: {{lojas_incluidas}} · Usuários incluídos: {{usuarios_incluidos}} · Armazenamento incluído: {{armazenamento_incluido}}.</p>
<p>Módulos: {{modulos_contratados}}.</p>

<h2>5. Suporte</h2>
<p>Suporte técnico em horário comercial via canais oficiais da CONTRATADA.</p>

<h2>6. Obrigações da CONTRATANTE</h2>
<p>Pagamento pontual, uso lícito do sistema, manutenção de credenciais.</p>

<h2>7. Obrigações da CONTRATADA</h2>
<p>Disponibilidade do serviço, atualizações, segurança e backups.</p>

<h2>8. Inadimplência</h2>
<p>O atraso superior a 10 dias autoriza suspensão de acesso até regularização.</p>

<h2>9. Cancelamento</h2>
<p>Qualquer parte poderá rescindir mediante aviso prévio de 30 dias.</p>

<h2>10. Confidencialidade e LGPD</h2>
<p>As partes obrigam-se a manter sigilo e a tratar dados conforme a Lei nº 13.709/2018.</p>

<h2>11. Foro</h2>
<p>Fica eleito o foro de {{cidade}} para dirimir quaisquer questões oriundas deste contrato.</p>

<p style="margin-top:48px;">Data: {{data_atual}}</p>',
  true,
  true
)
ON CONFLICT DO NOTHING;

-- 8. Bucket privado de contratos SaaS
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos-saas', 'contratos-saas', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins leem contratos saas"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contratos-saas' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins enviam contratos saas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contratos-saas' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins atualizam contratos saas"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'contratos-saas' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins removem contratos saas"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contratos-saas' AND public.has_role(auth.uid(), 'admin'));
