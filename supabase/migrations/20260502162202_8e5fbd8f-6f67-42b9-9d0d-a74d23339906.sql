
-- 1) Catálogo: novas ações granulares
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao) VALUES
  ('itens', 'view_custo', 'Visualizar custo de aquisição/fábrica de itens'),
  ('itens', 'edit_custo', 'Editar custo de aquisição/fábrica'),
  ('itens', 'edit_preco', 'Editar preço de venda'),
  ('itens', 'edit_quantidade', 'Editar quantidade de itens'),
  ('itens', 'view_markup', 'Visualizar markup'),
  ('parceiros', 'view_comissao', 'Visualizar comissão de parceiro/indicador'),
  ('descontos', 'aplicar', 'Aplicar desconto dentro do limite'),
  ('descontos', 'aprovar', 'Aprovar desconto acima do limite'),
  ('lojas', 'view_todas', 'Visualizar todas as lojas'),
  ('lojas', 'view_propria', 'Visualizar apenas a loja vinculada'),
  ('agenda', 'view_todas', 'Visualizar todas as agendas'),
  ('agenda', 'view_propria', 'Visualizar apenas agenda própria'),
  ('agenda', 'liberar_fora_regra', 'Liberar agendamento fora da regra'),
  ('contratos', 'confirmar_assinatura', 'Confirmar assinatura de contrato')
ON CONFLICT (modulo, acao) DO NOTHING;

-- 2) Tabela de permissões padrão por papel (cargo)
CREATE TABLE IF NOT EXISTS public.role_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  modulo text NOT NULL,
  acao text NOT NULL DEFAULT 'view',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, modulo, acao)
);

ALTER TABLE public.role_permissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY rp_select ON public.role_permissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_admin_all ON public.role_permissoes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 3) Função: usuário possui permissão (via role default OU concessão individual)
CREATE OR REPLACE FUNCTION public.user_has_perm(_user_id uuid, _modulo text, _acao text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.permissoes p
      WHERE p.user_id = _user_id AND p.modulo = _modulo
        AND (p.acao = _acao OR p.acao = 'edit')
    )
    OR EXISTS (
      SELECT 1 FROM public.role_permissoes rp
      JOIN public.user_roles ur ON ur.role = rp.role
      WHERE ur.user_id = _user_id
        AND rp.modulo = _modulo
        AND (rp.acao = _acao OR rp.acao = 'edit')
    );
$$;

-- 4) Seed defaults por cargo (regras de negócio)
-- Helper: limpa e reinsere
DELETE FROM public.role_permissoes;

-- DIRETOR: tudo exceto delete (similar admin, mas via role)
INSERT INTO public.role_permissoes (role, modulo, acao)
SELECT 'diretor', modulo, acao FROM public.permissoes_modulos_catalogo
WHERE acao IN ('view','create','edit','approve','export',
               'view_custo','edit_custo','edit_preco','edit_quantidade','view_markup',
               'view_comissao','aplicar','aprovar','view_todas','view_todas',
               'liberar_fora_regra','confirmar_assinatura');

-- GERENTE de loja: gestão da própria loja, vê custo, aprova desconto, confirma assinatura
INSERT INTO public.role_permissoes (role, modulo, acao) VALUES
  ('gerente','crm','view'),('gerente','crm','create'),('gerente','crm','edit'),
  ('gerente','clientes','view'),('gerente','clientes','create'),('gerente','clientes','edit'),
  ('gerente','orcamentos','view'),('gerente','orcamentos','create'),('gerente','orcamentos','edit'),('gerente','orcamentos','approve'),
  ('gerente','pedidos','view'),('gerente','pedidos','edit'),
  ('gerente','contratos','view'),('gerente','contratos','create'),('gerente','contratos','edit'),('gerente','contratos','confirmar_assinatura'),
  ('gerente','financeiro','view'),
  ('gerente','assistencias','view'),('gerente','assistencias','create'),('gerente','assistencias','edit'),
  ('gerente','agenda','view'),('gerente','agenda','create'),('gerente','agenda','edit'),('gerente','agenda','view_todas'),('gerente','agenda','liberar_fora_regra'),
  ('gerente','tarefas','view'),('gerente','tarefas','create'),('gerente','tarefas','edit'),
  ('gerente','relatorios','view'),
  ('gerente','parceiros','view'),('gerente','parceiros','view_comissao'),
  ('gerente','itens','view_custo'),('gerente','itens','view_markup'),('gerente','itens','edit_preco'),('gerente','itens','edit_quantidade'),
  ('gerente','descontos','aplicar'),('gerente','descontos','aprovar'),
  ('gerente','lojas','view_propria');

-- VENDEDOR: vendas, sem custo/markup/comissão
INSERT INTO public.role_permissoes (role, modulo, acao) VALUES
  ('vendedor','crm','view'),('vendedor','crm','create'),('vendedor','crm','edit'),
  ('vendedor','clientes','view'),('vendedor','clientes','create'),('vendedor','clientes','edit'),
  ('vendedor','orcamentos','view'),('vendedor','orcamentos','create'),('vendedor','orcamentos','edit'),
  ('vendedor','pedidos','view'),
  ('vendedor','contratos','view'),('vendedor','contratos','create'),
  ('vendedor','assistencias','view'),('vendedor','assistencias','create'),
  ('vendedor','agenda','view'),('vendedor','agenda','view_propria'),
  ('vendedor','tarefas','view'),('vendedor','tarefas','create'),('vendedor','tarefas','edit'),
  ('vendedor','descontos','aplicar'),
  ('vendedor','lojas','view_propria');

-- PROJETISTA: projetos/ambientes sem custo/markup/comissão
INSERT INTO public.role_permissoes (role, modulo, acao) VALUES
  ('projetista','orcamentos','view'),('projetista','orcamentos','create'),('projetista','orcamentos','edit'),
  ('projetista','clientes','view'),
  ('projetista','pedidos','view'),
  ('projetista','assistencias','view'),
  ('projetista','agenda','view'),('projetista','agenda','view_propria'),
  ('projetista','tarefas','view'),('projetista','tarefas','create'),('projetista','tarefas','edit'),
  ('projetista','itens','edit_quantidade'),
  ('projetista','lojas','view_propria');

-- FINANCEIRO: tudo de finanças, vê custos
INSERT INTO public.role_permissoes (role, modulo, acao) VALUES
  ('financeiro','financeiro','view'),('financeiro','financeiro','edit'),('financeiro','financeiro','create'),('financeiro','financeiro','approve'),('financeiro','financeiro','export'),
  ('financeiro','notas_fiscais','view'),('financeiro','notas_fiscais','create'),('financeiro','notas_fiscais','edit'),
  ('financeiro','parceiros','view'),('financeiro','parceiros','view_comissao'),('financeiro','parceiros','approve'),
  ('financeiro','pedidos','view'),
  ('financeiro','orcamentos','view'),
  ('financeiro','clientes','view'),
  ('financeiro','relatorios','view'),('financeiro','relatorios','export'),
  ('financeiro','itens','view_custo'),('financeiro','itens','view_markup'),
  ('financeiro','lojas','view_propria');

-- TÉCNICO: assistências e tarefas próprias
INSERT INTO public.role_permissoes (role, modulo, acao) VALUES
  ('tecnico','assistencias','view'),('tecnico','assistencias','edit'),
  ('tecnico','agenda','view'),('tecnico','agenda','view_propria'),
  ('tecnico','tarefas','view'),('tecnico','tarefas','edit'),
  ('tecnico','clientes','view'),
  ('tecnico','pedidos','view'),
  ('tecnico','lojas','view_propria');

-- MONTADOR: ordens e checkin
INSERT INTO public.role_permissoes (role, modulo, acao) VALUES
  ('montador','assistencias','view'),('montador','assistencias','edit'),
  ('montador','agenda','view'),('montador','agenda','view_propria'),
  ('montador','tarefas','view'),('montador','tarefas','edit'),
  ('montador','pedidos','view'),
  ('montador','lojas','view_propria');

-- ASSISTÊNCIA / PÓS-VENDA
INSERT INTO public.role_permissoes (role, modulo, acao) VALUES
  ('assistencia','assistencias','view'),('assistencia','assistencias','create'),('assistencia','assistencias','edit'),('assistencia','assistencias','approve'),
  ('assistencia','clientes','view'),('assistencia','clientes','edit'),
  ('assistencia','pedidos','view'),
  ('assistencia','agenda','view'),('assistencia','agenda','create'),('assistencia','agenda','edit'),('assistencia','agenda','view_todas'),
  ('assistencia','tarefas','view'),('assistencia','tarefas','create'),('assistencia','tarefas','edit'),
  ('assistencia','lojas','view_propria');

-- 5) View para frontend: permissões efetivas do usuário atual
CREATE OR REPLACE VIEW public.v_my_permissions
WITH (security_invoker=on) AS
SELECT DISTINCT modulo, acao FROM (
  -- via role
  SELECT rp.modulo, rp.acao
  FROM public.role_permissoes rp
  JOIN public.user_roles ur ON ur.role = rp.role
  WHERE ur.user_id = auth.uid()
  UNION ALL
  -- concessão individual
  SELECT p.modulo, p.acao
  FROM public.permissoes p
  WHERE p.user_id = auth.uid()
) x;
