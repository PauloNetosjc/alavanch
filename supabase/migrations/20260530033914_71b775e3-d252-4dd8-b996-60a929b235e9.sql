
-- =========================================================
-- Camada SaaS: bases_clientes (clientes do sistema) + vínculo com lojas
-- =========================================================

CREATE TABLE IF NOT EXISTS public.bases_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  razao_social text,
  nome_fantasia text,
  cnpj text,
  email_responsavel text,
  telefone_responsavel text,
  responsavel_nome text,
  status text NOT NULL DEFAULT 'ativo', -- ativo | teste | suspenso | cancelado
  plano text NOT NULL DEFAULT 'personalizado', -- basico | profissional | completo | personalizado
  observacoes text,
  data_inicio date DEFAULT CURRENT_DATE,
  data_cancelamento date,
  criado_por uuid,
  atualizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bases_clientes TO authenticated;
GRANT ALL ON public.bases_clientes TO service_role;

ALTER TABLE public.bases_clientes ENABLE ROW LEVEL SECURITY;

-- Admin master = admin (por enquanto). Estrutura permite separar no futuro.
CREATE POLICY "Admins podem ver bases" ON public.bases_clientes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins podem criar bases" ON public.bases_clientes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins podem editar bases" ON public.bases_clientes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins podem remover bases" ON public.bases_clientes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_bases_clientes_updated
BEFORE UPDATE ON public.bases_clientes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vínculo loja -> base
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS base_cliente_id uuid REFERENCES public.bases_clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lojas_base_cliente ON public.lojas(base_cliente_id);

-- Histórico de alterações da base
CREATE TABLE IF NOT EXISTS public.bases_clientes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id uuid NOT NULL REFERENCES public.bases_clientes(id) ON DELETE CASCADE,
  evento text NOT NULL, -- criacao, edicao, plano_alterado, status_alterado, modulo_alterado, loja_vinculada, loja_desvinculada
  descricao text,
  detalhes jsonb,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.bases_clientes_historico TO authenticated;
GRANT ALL ON public.bases_clientes_historico TO service_role;
ALTER TABLE public.bases_clientes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver historico bases" ON public.bases_clientes_historico
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins podem inserir historico bases" ON public.bases_clientes_historico
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_bases_historico_base ON public.bases_clientes_historico(base_id, created_at DESC);

-- Permissão no catálogo
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, grupo, descricao)
VALUES ('sistema.gestao_bases', 'view', 'sistema', 'Acessar Gestão de Bases (clientes SaaS)')
ON CONFLICT DO NOTHING;

-- Seed: cria base padrão e vincula lojas sem base
DO $$
DECLARE
  v_base_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.bases_clientes WHERE nome = 'Forest Decor') THEN
    INSERT INTO public.bases_clientes (nome, nome_fantasia, status, plano, observacoes)
    VALUES ('Forest Decor', 'Forest Decor', 'ativo', 'completo', 'Base padrão criada automaticamente para vincular lojas existentes.')
    RETURNING id INTO v_base_id;
  ELSE
    SELECT id INTO v_base_id FROM public.bases_clientes WHERE nome = 'Forest Decor' LIMIT 1;
  END IF;

  UPDATE public.lojas SET base_cliente_id = v_base_id WHERE base_cliente_id IS NULL;
END $$;
