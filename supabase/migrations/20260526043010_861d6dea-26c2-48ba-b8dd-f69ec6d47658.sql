-- 1) configuracoes_empresa: restringir SELECT a admins
DROP POLICY IF EXISTS "config_empresa_select" ON public.configuracoes_empresa;
CREATE POLICY "config_empresa_select_admin"
  ON public.configuracoes_empresa
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) parceiro_comissoes: restringir UPDATE (remover USING true)
DROP POLICY IF EXISTS "pc_update" ON public.parceiro_comissoes;
CREATE POLICY "pc_update"
  ON public.parceiro_comissoes
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.pode_acessar_loja(public.loja_de_comissao(id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.pode_acessar_loja(public.loja_de_comissao(id))
  );

-- 3) certificados_digitais: restringir SELECT a admins
DROP POLICY IF EXISTS "cert_select" ON public.certificados_digitais;
CREATE POLICY "cert_select_admin"
  ON public.certificados_digitais
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));