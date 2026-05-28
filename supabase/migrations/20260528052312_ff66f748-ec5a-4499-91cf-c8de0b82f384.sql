
-- ============ 1) EXPANDIR rh_cargos ============
ALTER TABLE public.rh_cargos
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS protegido_sistema boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_receber_tarefas boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_ser_responsavel_pedido boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Seed mínimo de cargos operacionais espelhando os do sistema (idempotente)
INSERT INTO public.rh_cargos (nome, descricao, protegido_sistema, ordem)
VALUES
  ('Administrador',           'Acesso total ao sistema',                    true,  10),
  ('Diretor',                 'Visão estratégica e relatórios',             true,  20),
  ('Gerente de Loja',         'Operação da loja e equipe',                  true,  30),
  ('Vendedor / Consultor',    'Atendimento, orçamentos e pedidos',          false, 40),
  ('Projetista',              'Projetos e revisões técnicas',               false, 50),
  ('Financeiro',              'Lançamentos, contas e conciliação',          false, 60),
  ('Técnico',                 'Assistência técnica e pós-venda',            false, 70),
  ('Montador',                'Agenda de montagem e checklists',            false, 80),
  ('Assistência / Pós-venda', 'Atendimento e chamados',                     false, 90)
ON CONFLICT (nome) DO NOTHING;

-- ============ 2) AUDITORIA DE TRANSFERÊNCIAS ============
CREATE TABLE IF NOT EXISTS public.auditoria_transferencias_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_antigo uuid NOT NULL,
  usuario_novo uuid NOT NULL,
  executado_por uuid,
  motivo text NOT NULL,
  contadores jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.auditoria_transferencias_usuario TO authenticated;
GRANT ALL ON public.auditoria_transferencias_usuario TO service_role;

ALTER TABLE public.auditoria_transferencias_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_transfer_admin_diretor_gerente_select"
ON public.auditoria_transferencias_usuario FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'gerente'::app_role)
);

CREATE POLICY "audit_transfer_admin_diretor_gerente_insert"
ON public.auditoria_transferencias_usuario FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'gerente'::app_role)
);

-- ============ 3) RPC TRANSFERIR RESPONSABILIDADES ============
CREATE OR REPLACE FUNCTION public.transferir_responsabilidades_usuario(
  p_usuario_antigo uuid,
  p_usuario_novo uuid,
  p_transferir_pedidos boolean DEFAULT true,
  p_transferir_tarefas boolean DEFAULT true,
  p_transferir_chamados boolean DEFAULT true,
  p_transferir_agenda boolean DEFAULT true,
  p_transferir_kanban boolean DEFAULT true,
  p_transferir_clientes boolean DEFAULT false,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_profile_antigo uuid;
  v_profile_novo uuid;
  v_novo_ativo boolean;
  v_count int;
  v_result jsonb := '{}'::jsonb;
BEGIN
  -- Permissão
  IF NOT (public.has_role(v_caller, 'admin'::app_role)
       OR public.has_role(v_caller, 'diretor'::app_role)
       OR public.has_role(v_caller, 'gerente'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para transferir responsabilidades';
  END IF;

  IF p_usuario_antigo IS NULL OR p_usuario_novo IS NULL THEN
    RAISE EXCEPTION 'Usuários inválidos';
  END IF;
  IF p_usuario_antigo = p_usuario_novo THEN
    RAISE EXCEPTION 'Usuário antigo e novo devem ser diferentes';
  END IF;
  IF coalesce(trim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Motivo é obrigatório';
  END IF;

  -- Novo usuário precisa estar ativo
  SELECT ativo INTO v_novo_ativo FROM public.profiles WHERE user_id = p_usuario_novo;
  IF v_novo_ativo IS NULL THEN
    RAISE EXCEPTION 'Usuário novo não encontrado';
  END IF;
  IF v_novo_ativo = false THEN
    RAISE EXCEPTION 'Usuário novo está inativo';
  END IF;

  -- Profiles (para tabelas que referenciam profiles.id)
  SELECT id INTO v_profile_antigo FROM public.profiles WHERE user_id = p_usuario_antigo;
  SELECT id INTO v_profile_novo   FROM public.profiles WHERE user_id = p_usuario_novo;

  -- PEDIDOS
  IF p_transferir_pedidos THEN
    UPDATE public.pedidos SET estagio_responsavel_id = p_usuario_novo
      WHERE estagio_responsavel_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('pedidos_estagio', v_count);

    UPDATE public.pedidos SET projetista_id = p_usuario_novo
      WHERE projetista_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('pedidos_projetista', v_count);

    UPDATE public.orcamentos SET vendedor_id = p_usuario_novo
      WHERE vendedor_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('orcamentos', v_count);
  END IF;

  -- TAREFAS NATIVAS (responsavel_id = profiles.id)
  IF p_transferir_tarefas AND v_profile_antigo IS NOT NULL AND v_profile_novo IS NOT NULL THEN
    UPDATE public.tarefas_pedido
      SET responsavel_id = v_profile_novo
      WHERE responsavel_id = v_profile_antigo
        AND status NOT IN ('concluida','cancelada');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('tarefas', v_count);
  END IF;

  -- CHAMADOS / ASSISTÊNCIAS
  IF p_transferir_chamados THEN
    UPDATE public.assistencias SET tecnico_id = p_usuario_novo
      WHERE tecnico_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('assistencias', v_count);

    UPDATE public.ocorrencias SET responsavel_id = p_usuario_novo
      WHERE responsavel_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('ocorrencias', v_count);
  END IF;

  -- AGENDA (somente eventos futuros não concluídos)
  IF p_transferir_agenda THEN
    UPDATE public.agenda_eventos
      SET responsavel_id = p_usuario_novo
      WHERE responsavel_id = p_usuario_antigo
        AND coalesce(data_inicio, data_evento, created_at) >= now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('agenda', v_count);
  END IF;

  -- KANBAN
  IF p_transferir_kanban THEN
    UPDATE public.kanban_cards SET responsavel_id = p_usuario_novo
      WHERE responsavel_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('kanban', v_count);

    UPDATE public.leads SET responsavel_id = p_usuario_novo
      WHERE responsavel_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('leads', v_count);
  END IF;

  -- CARTEIRA DE CLIENTES
  IF p_transferir_clientes THEN
    UPDATE public.clientes SET vendedor_id = p_usuario_novo
      WHERE vendedor_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('clientes', v_count);
  END IF;

  -- Desativar usuário antigo (preserva histórico)
  UPDATE public.profiles SET ativo = false, updated_at = now()
    WHERE user_id = p_usuario_antigo;

  -- Auditoria
  INSERT INTO public.auditoria_transferencias_usuario
    (usuario_antigo, usuario_novo, executado_por, motivo, contadores)
  VALUES (p_usuario_antigo, p_usuario_novo, v_caller, p_motivo, v_result);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.transferir_responsabilidades_usuario(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean,text) FROM public;
GRANT EXECUTE ON FUNCTION public.transferir_responsabilidades_usuario(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean,text) TO authenticated;

-- ============ 4) FUNÇÃO DE VERIFICAÇÃO DE USO DE CARGO ============
CREATE OR REPLACE FUNCTION public.rh_cargo_em_uso(p_cargo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.rh_funcionarios WHERE cargo_id = p_cargo_id)
      OR EXISTS(SELECT 1 FROM public.tarefas_nativas_modelos WHERE cargo_id = p_cargo_id)
      OR EXISTS(SELECT 1 FROM public.tarefas_pedido WHERE cargo_id = p_cargo_id);
$$;

GRANT EXECUTE ON FUNCTION public.rh_cargo_em_uso(uuid) TO authenticated;
