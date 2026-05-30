
CREATE TABLE IF NOT EXISTS public.modulos_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  categoria text,
  essencial boolean NOT NULL DEFAULT false,
  ativo_global boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.modulos_sistema TO authenticated;
GRANT ALL ON public.modulos_sistema TO service_role;
ALTER TABLE public.modulos_sistema ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modulos_sistema_select_auth" ON public.modulos_sistema FOR SELECT TO authenticated USING (true);
CREATE POLICY "modulos_sistema_admin_write" ON public.modulos_sistema FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.modulos_loja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  modulo_chave text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  contratado boolean NOT NULL DEFAULT true,
  data_ativacao timestamptz,
  data_desativacao timestamptz,
  atualizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, modulo_chave)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modulos_loja TO authenticated;
GRANT ALL ON public.modulos_loja TO service_role;
ALTER TABLE public.modulos_loja ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modulos_loja_select_auth" ON public.modulos_loja FOR SELECT TO authenticated USING (true);
CREATE POLICY "modulos_loja_admin_write" ON public.modulos_loja FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_modulos_loja_loja ON public.modulos_loja(loja_id);
CREATE INDEX IF NOT EXISTS idx_modulos_loja_chave ON public.modulos_loja(modulo_chave);

INSERT INTO public.modulos_sistema (chave, nome, descricao, categoria, essencial, ordem) VALUES
  ('crm_comercial','CRM Comercial','Funil de orçamentos e negociação','comercial',true,10),
  ('workflow_operacional','Workflow Operacional','Etapas operacionais do pedido','operacional',true,20),
  ('financeiro','Financeiro','Contas a pagar, receber e relatórios','financeiro',true,30),
  ('contratos','Contratos','Templates e assinaturas digitais','comercial',true,40),
  ('agenda','Agenda','Agenda compartilhada','produtividade',true,50),
  ('autorizacoes','Autorizações','Aprovações e fluxos','gestao',true,60),
  ('fabrica','Fábrica','Produção, lotes e expedição','operacional',false,70),
  ('rh','RH','Gestão de pessoas','rh',false,80),
  ('bater_ponto','Bater Ponto','Registro de ponto eletrônico','rh',false,90),
  ('notas_fiscais','Notas Fiscais','Emissão e controle de NF','financeiro',false,100)
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.modulo_ativo(_loja_id uuid, _chave text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT ml.ativo FROM public.modulos_loja ml WHERE ml.loja_id = _loja_id AND ml.modulo_chave = _chave LIMIT 1),
    (SELECT ms.essencial FROM public.modulos_sistema ms WHERE ms.chave = _chave LIMIT 1),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.modulo_ativo(uuid, text) TO authenticated, anon, service_role;

DROP TRIGGER IF EXISTS set_modulos_sistema_updated_at ON public.modulos_sistema;
CREATE TRIGGER set_modulos_sistema_updated_at BEFORE UPDATE ON public.modulos_sistema
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_modulos_loja_updated_at ON public.modulos_loja;
CREATE TRIGGER set_modulos_loja_updated_at BEFORE UPDATE ON public.modulos_loja
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.modulos_loja (loja_id, modulo_chave, ativo, contratado, data_ativacao)
SELECT l.id, 'fabrica', true, true, now() FROM public.lojas l
ON CONFLICT (loja_id, modulo_chave) DO NOTHING;

INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo)
VALUES ('sistema.gestao_modulos', 'view', 'Gestão de Módulos do sistema (ativar/desativar por loja)', 'sistema')
ON CONFLICT DO NOTHING;
