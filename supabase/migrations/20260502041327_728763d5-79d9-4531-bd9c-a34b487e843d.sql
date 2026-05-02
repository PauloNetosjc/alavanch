-- ============================================================
-- 1) PERMISSÕES GRANULARES POR USUÁRIO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  modulo text NOT NULL,           -- ex: 'financeiro', 'auditoria_parceiros', 'parceiros', 'dashboard', 'relatorios', 'contas', 'cartoes', 'extrato', 'categorias_financeiras', 'lancamentos'
  acao text NOT NULL DEFAULT 'view', -- 'view' | 'edit' | 'delete'
  perfil text,                    -- rótulo livre: 'financeiro' | 'auditor' | 'diretoria' | 'custom'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, modulo, acao)
);

ALTER TABLE public.permissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY permissoes_select ON public.permissoes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY permissoes_admin_all ON public.permissoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Helper: tem permissão? (admin sempre true)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _modulo text, _acao text DEFAULT 'view')
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id,'admin')
      OR EXISTS (
        SELECT 1 FROM public.permissoes
        WHERE user_id = _user_id
          AND modulo = _modulo
          AND (acao = _acao OR acao = 'edit') -- edit implica view
      );
$$;

-- ============================================================
-- 2) AUDITORIA DE COMPROVANTES (parceiro_comprovantes -> timeline_eventos)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_parceiro_comprovante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_entidade_id uuid;
  v_tipo text;
  v_desc text;
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;

  IF TG_OP = 'INSERT' THEN
    v_entidade_id := COALESCE(NEW.comissao_id, NEW.parceiro_id);
    v_tipo := 'comprovante_anexado';
    v_desc := 'Comprovante anexado: ' || COALESCE(NEW.nome,'(sem nome)');
    INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
    VALUES ('parceiro_comissao', v_entidade_id, v_tipo, v_desc, v_uid,
            jsonb_build_object('comprovante_id', NEW.id, 'storage_path', NEW.storage_path,
                               'parceiro_id', NEW.parceiro_id, 'comissao_id', NEW.comissao_id));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_entidade_id := COALESCE(NEW.comissao_id, NEW.parceiro_id);
    INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
    VALUES ('parceiro_comissao', v_entidade_id, 'comprovante_editado',
            'Comprovante editado: ' || COALESCE(NEW.nome,'(sem nome)'), v_uid,
            jsonb_build_object('comprovante_id', NEW.id,
                               'antes', jsonb_build_object('nome', OLD.nome, 'storage_path', OLD.storage_path),
                               'depois', jsonb_build_object('nome', NEW.nome, 'storage_path', NEW.storage_path)));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_entidade_id := COALESCE(OLD.comissao_id, OLD.parceiro_id);
    INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
    VALUES ('parceiro_comissao', v_entidade_id, 'comprovante_removido',
            'Comprovante removido: ' || COALESCE(OLD.nome,'(sem nome)'), v_uid,
            jsonb_build_object('comprovante_id', OLD.id, 'storage_path', OLD.storage_path,
                               'parceiro_id', OLD.parceiro_id, 'comissao_id', OLD.comissao_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_parceiro_comprovante ON public.parceiro_comprovantes;
CREATE TRIGGER trg_log_parceiro_comprovante
AFTER INSERT OR UPDATE OR DELETE ON public.parceiro_comprovantes
FOR EACH ROW EXECUTE FUNCTION public.log_parceiro_comprovante();

-- ============================================================
-- 3) RLS adicional: financeiro/auditor/diretoria via has_permission
--    (mantém policies antigas; adiciona vias de leitura/edição por permissão)
-- ============================================================

-- Financeiro: SELECT/UPDATE em lançamentos, contas, cartões, categorias se tiver permissão
CREATE POLICY lf_select_perm ON public.lancamentos_financeiros
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'lancamentos','view')
         AND (loja_id IS NULL OR loja_id = public.current_loja_id()));

CREATE POLICY lf_update_perm ON public.lancamentos_financeiros
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'lancamentos','edit')
         AND (loja_id IS NULL OR loja_id = public.current_loja_id()));

CREATE POLICY cb_select_perm ON public.contas_bancarias
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'contas','view'));

CREATE POLICY cc_select_perm ON public.cartoes_credito
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'cartoes','view')
         AND (loja_id IS NULL OR loja_id = public.current_loja_id()));

-- Auditor: SELECT/UPDATE em parceiro_comissoes da sua loja
CREATE POLICY pc_select_perm ON public.parceiro_comissoes
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'auditoria_parceiros','view')
         AND (loja_id IS NULL OR loja_id = public.current_loja_id()));

CREATE POLICY pc_update_perm ON public.parceiro_comissoes
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'auditoria_parceiros','edit')
         AND (loja_id IS NULL OR loja_id = public.current_loja_id()));

-- Diretoria: leitura ampla via has_permission('diretoria','view') sobre principais entidades
CREATE POLICY pedidos_select_diretoria ON public.pedidos
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'diretoria','view'));

CREATE POLICY orcamentos_select_diretoria ON public.orcamentos
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'diretoria','view'));

CREATE POLICY lf_select_diretoria ON public.lancamentos_financeiros
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'diretoria','view'));
