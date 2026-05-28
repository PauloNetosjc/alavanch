
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

  SELECT ativo INTO v_novo_ativo FROM public.profiles WHERE user_id = p_usuario_novo;
  IF v_novo_ativo IS NULL THEN RAISE EXCEPTION 'Usuário novo não encontrado'; END IF;
  IF v_novo_ativo = false THEN RAISE EXCEPTION 'Usuário novo está inativo'; END IF;

  SELECT id INTO v_profile_antigo FROM public.profiles WHERE user_id = p_usuario_antigo;
  SELECT id INTO v_profile_novo   FROM public.profiles WHERE user_id = p_usuario_novo;

  IF p_transferir_pedidos THEN
    UPDATE public.pedidos SET estagio_responsavel_id = p_usuario_novo WHERE estagio_responsavel_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('pedidos_estagio', v_count);

    UPDATE public.pedidos SET projetista_id = p_usuario_novo WHERE projetista_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('pedidos_projetista', v_count);

    UPDATE public.orcamentos SET vendedor_id = p_usuario_novo WHERE vendedor_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('orcamentos', v_count);
  END IF;

  IF p_transferir_tarefas AND v_profile_antigo IS NOT NULL AND v_profile_novo IS NOT NULL THEN
    UPDATE public.tarefas_pedido
      SET responsavel_id = v_profile_novo
      WHERE responsavel_id = v_profile_antigo
        AND status NOT IN ('concluida','cancelada');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('tarefas', v_count);
  END IF;

  IF p_transferir_chamados THEN
    UPDATE public.assistencias SET tecnico_id = p_usuario_novo WHERE tecnico_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('assistencias', v_count);

    UPDATE public.ocorrencias SET responsavel_id = p_usuario_novo WHERE responsavel_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('ocorrencias', v_count);
  END IF;

  IF p_transferir_agenda THEN
    UPDATE public.agenda_eventos
      SET responsavel_id = p_usuario_novo
      WHERE responsavel_id = p_usuario_antigo
        AND data >= CURRENT_DATE
        AND coalesce(status, '') NOT IN ('concluido','cancelado');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('agenda', v_count);
  END IF;

  IF p_transferir_kanban THEN
    UPDATE public.kanban_cards SET responsavel_id = p_usuario_novo WHERE responsavel_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('kanban', v_count);

    UPDATE public.leads SET responsavel_id = p_usuario_novo WHERE responsavel_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('leads', v_count);
  END IF;

  IF p_transferir_clientes THEN
    UPDATE public.clientes SET vendedor_id = p_usuario_novo WHERE vendedor_id = p_usuario_antigo;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('clientes', v_count);
  END IF;

  UPDATE public.profiles SET ativo = false, updated_at = now() WHERE user_id = p_usuario_antigo;

  INSERT INTO public.auditoria_transferencias_usuario
    (usuario_antigo, usuario_novo, executado_por, motivo, contadores)
  VALUES (p_usuario_antigo, p_usuario_novo, v_caller, p_motivo, v_result);

  RETURN v_result;
END;
$$;
