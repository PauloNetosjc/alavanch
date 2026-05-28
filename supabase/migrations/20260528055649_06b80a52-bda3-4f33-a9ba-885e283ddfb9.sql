
-- Helper SECURITY DEFINER para evitar acesso direto a auth.users por RLS
CREATE OR REPLACE FUNCTION public.fn_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.fn_current_user_email() TO authenticated;

-- Recria política tp_select sem referência direta a auth.users
DROP POLICY IF EXISTS tp_select ON public.tarefas_pedido;
CREATE POLICY tp_select ON public.tarefas_pedido
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'gerente')
    OR (loja_id IS NOT NULL AND public.user_pode_acessar_loja(auth.uid(), loja_id))
    OR responsavel_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR cargo_id IN (
      SELECT f.cargo_id FROM public.rh_funcionarios f
       WHERE f.email = public.fn_current_user_email()
    )
  );
