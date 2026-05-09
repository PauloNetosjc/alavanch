
-- 1) Novas colunas em pipeline_automacoes para suportar diferentes tipos de ação
ALTER TABLE public.pipeline_automacoes
  ADD COLUMN IF NOT EXISTS acao text NOT NULL DEFAULT 'mover',
  ADD COLUMN IF NOT EXISTS acao_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.pipeline_automacoes.acao IS 'mover | duplicar | checar_dados | comunicado | notificar';

-- 2) Função de execução de ações (chamada pelo trigger card_chegou e por pipeline_avancar_card)
CREATE OR REPLACE FUNCTION public.executar_automacao_acao(
  _regra_id uuid,
  _pedido_id uuid,
  _card_id uuid,
  _evento text,
  _contexto jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reg record;
  loja uuid;
  v_uid uuid;
  v_pedido record;
  v_dest_card_id uuid;
  v_check_ok boolean;
  v_check_valor text;
  v_check_campo text;
  v_check_esperado text;
  v_msg text;
  v_target_user uuid;
  v_resultado jsonb;
  v_novo_prazo date;
  v_sla int;
  v_est_destino_nome text;
  v_est_origem_nome text;
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;
  SELECT * INTO reg FROM public.pipeline_automacoes WHERE id = _regra_id;
  IF NOT FOUND OR NOT reg.ativo THEN RETURN jsonb_build_object('skipped', true); END IF;

  SELECT loja_id INTO loja FROM public.pedidos WHERE id = _pedido_id;
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = _pedido_id;

  IF reg.acao = 'mover' OR reg.acao IS NULL THEN
    -- Calcula prazo
    IF reg.ajustar_prazo_dias IS NOT NULL AND reg.ajustar_prazo_dias > 0 THEN
      v_novo_prazo := public.add_dias_uteis(CURRENT_DATE, reg.ajustar_prazo_dias, loja);
    ELSE
      SELECT sla_dias_uteis INTO v_sla FROM public.pipeline_estagios WHERE id = reg.estagio_destino_id;
      IF v_sla IS NOT NULL AND v_sla > 0 THEN
        v_novo_prazo := public.add_dias_uteis(CURRENT_DATE, v_sla, loja);
      END IF;
    END IF;

    SELECT nome INTO v_est_origem_nome FROM public.pipeline_estagios pe
      JOIN public.kanban_cards kc ON kc.estagio_id = pe.id WHERE kc.id = _card_id;
    SELECT nome INTO v_est_destino_nome FROM public.pipeline_estagios WHERE id = reg.estagio_destino_id;

    IF reg.pipeline_destino IS NOT NULL AND reg.pipeline_destino <> reg.pipeline THEN
      INSERT INTO public.kanban_cards(pedido_id, pipeline, estagio_id, prazo, iniciado_em)
      VALUES (_pedido_id, reg.pipeline_destino, reg.estagio_destino_id, v_novo_prazo, now())
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_dest_card_id;
    ELSE
      UPDATE public.kanban_cards
         SET estagio_id = reg.estagio_destino_id,
             prazo = COALESCE(v_novo_prazo, prazo),
             iniciado_em = now(),
             notificacao_atraso_em = NULL,
             updated_at = now()
       WHERE id = _card_id;
    END IF;

    INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
    VALUES ('pedido', _pedido_id, 'kanban_automacao',
      format('[%s] %s → %s (auto: %s)', reg.pipeline, COALESCE(v_est_origem_nome,'?'), v_est_destino_nome, _evento),
      v_uid,
      jsonb_build_object('regra_id', reg.id, 'evento', _evento, 'acao', 'mover',
        'antes', jsonb_build_object('estagio', v_est_origem_nome),
        'depois', jsonb_build_object('estagio', v_est_destino_nome, 'prazo', v_novo_prazo)));

    RETURN jsonb_build_object('acao','mover','estagio_destino', v_est_destino_nome);

  ELSIF reg.acao = 'duplicar' THEN
    -- Cria card paralelo no destino
    INSERT INTO public.kanban_cards(pedido_id, pipeline, estagio_id, iniciado_em)
    VALUES (_pedido_id, COALESCE(reg.pipeline_destino, reg.pipeline), reg.estagio_destino_id, now())
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_dest_card_id;

    INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
    VALUES ('pedido', _pedido_id, 'kanban_automacao',
      format('Card duplicado em %s (auto: %s)', COALESCE(reg.pipeline_destino, reg.pipeline), _evento),
      v_uid,
      jsonb_build_object('regra_id', reg.id, 'acao','duplicar','novo_card', v_dest_card_id));

    RETURN jsonb_build_object('acao','duplicar','novo_card', v_dest_card_id);

  ELSIF reg.acao = 'checar_dados' THEN
    v_check_campo := reg.acao_config->>'campo';
    v_check_esperado := reg.acao_config->>'valor_esperado';

    -- Avalia campo
    IF v_check_campo = 'contrato_assinado' THEN
      v_check_ok := EXISTS(SELECT 1 FROM public.contratos
        WHERE orcamento_id = v_pedido.orcamento_id AND status = 'assinado');
      v_check_valor := CASE WHEN v_check_ok THEN 'sim' ELSE 'nao' END;
    ELSIF v_check_campo = 'cliente_cpf' THEN
      v_check_ok := EXISTS(SELECT 1 FROM public.clientes WHERE id = v_pedido.cliente_id AND cpf_cnpj IS NOT NULL AND cpf_cnpj <> '');
      v_check_valor := CASE WHEN v_check_ok THEN 'preenchido' ELSE 'vazio' END;
    ELSIF v_check_campo = 'cliente_email' THEN
      v_check_ok := EXISTS(SELECT 1 FROM public.clientes WHERE id = v_pedido.cliente_id AND email IS NOT NULL AND email <> '');
      v_check_valor := CASE WHEN v_check_ok THEN 'preenchido' ELSE 'vazio' END;
    ELSIF v_check_campo = 'cliente_telefone' THEN
      v_check_ok := EXISTS(SELECT 1 FROM public.clientes WHERE id = v_pedido.cliente_id AND telefone IS NOT NULL AND telefone <> '');
      v_check_valor := CASE WHEN v_check_ok THEN 'preenchido' ELSE 'vazio' END;
    ELSIF v_check_campo = 'pedido_status' THEN
      v_check_valor := v_pedido.status;
      v_check_ok := COALESCE(v_check_valor,'') = COALESCE(v_check_esperado,'');
    ELSIF v_check_campo = 'pagamentos_completos' THEN
      v_check_ok := NOT EXISTS(SELECT 1 FROM public.lancamentos_financeiros
        WHERE pedido_id = _pedido_id AND tipo='entrada' AND status <> 'pago');
      v_check_valor := CASE WHEN v_check_ok THEN 'sim' ELSE 'nao' END;
    ELSE
      v_check_ok := false;
      v_check_valor := 'campo_desconhecido';
    END IF;

    INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
    VALUES ('pedido', _pedido_id, 'verificacao',
      format('Verificação "%s": %s (esperado: %s)', v_check_campo, v_check_valor, COALESCE(v_check_esperado,'qualquer')),
      v_uid,
      jsonb_build_object('regra_id', reg.id, 'acao','checar_dados','campo', v_check_campo,
        'valor', v_check_valor, 'esperado', v_check_esperado, 'sucesso', v_check_ok));

    -- Se falhou, notifica responsável do card
    IF NOT v_check_ok THEN
      SELECT responsavel_id INTO v_target_user FROM public.kanban_cards WHERE id = _card_id;
      IF v_target_user IS NULL THEN
        SELECT user_id INTO v_target_user FROM public.user_roles WHERE role IN ('admin','financeiro') LIMIT 1;
      END IF;
      IF v_target_user IS NOT NULL THEN
        INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, link, metadata)
        VALUES (v_target_user, 'kanban',
          format('Verificação falhou: %s', v_check_campo),
          format('Pedido %s — %s = %s', v_pedido.codigo, v_check_campo, v_check_valor),
          '/kanbans?k=' || reg.pipeline,
          jsonb_build_object('card_id', _card_id, 'pedido_id', _pedido_id, 'regra_id', reg.id));
      END IF;
    END IF;
    RETURN jsonb_build_object('acao','checar_dados','sucesso', v_check_ok, 'valor', v_check_valor);

  ELSIF reg.acao = 'comunicado' THEN
    v_msg := COALESCE(reg.acao_config->>'mensagem', 'Comunicado interno');
    -- Registra na timeline do pedido
    INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
    VALUES ('pedido', _pedido_id, 'comunicado_interno', v_msg, v_uid,
      jsonb_build_object('regra_id', reg.id, 'acao','comunicado','evento', _evento));

    -- Notifica role configurado, ou todos admins
    IF reg.acao_config ? 'role' THEN
      INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, link, metadata)
      SELECT ur.user_id, 'comunicado',
        format('Comunicado: %s', v_pedido.codigo),
        v_msg,
        '/kanbans?k=' || reg.pipeline,
        jsonb_build_object('card_id', _card_id, 'pedido_id', _pedido_id)
      FROM public.user_roles ur
      WHERE ur.role::text = (reg.acao_config->>'role');
    END IF;
    RETURN jsonb_build_object('acao','comunicado','mensagem', v_msg);

  ELSIF reg.acao = 'notificar' THEN
    v_target_user := NULLIF(reg.acao_config->>'user_id','')::uuid;
    IF v_target_user IS NULL THEN
      SELECT responsavel_id INTO v_target_user FROM public.kanban_cards WHERE id = _card_id;
    END IF;
    v_msg := COALESCE(reg.acao_config->>'mensagem', format('Card %s — evento: %s', v_pedido.codigo, _evento));
    IF v_target_user IS NOT NULL THEN
      INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, link, metadata)
      VALUES (v_target_user, 'kanban',
        format('Notificação — %s', v_pedido.codigo),
        v_msg,
        '/kanbans?k=' || reg.pipeline,
        jsonb_build_object('card_id', _card_id, 'pedido_id', _pedido_id, 'regra_id', reg.id));
    END IF;
    INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
    VALUES ('pedido', _pedido_id, 'notificacao_enviada',
      format('Notificação enviada (auto: %s)', _evento), v_uid,
      jsonb_build_object('regra_id', reg.id, 'destinatario', v_target_user, 'mensagem', v_msg));
    RETURN jsonb_build_object('acao','notificar','user_id', v_target_user);
  END IF;

  RETURN jsonb_build_object('acao','desconhecida');
END;
$$;

-- 3) Trigger: quando card é criado ou muda de estágio, dispara evento 'card_chegou'
CREATE OR REPLACE FUNCTION public.kanban_card_chegou()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reg record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.estagio_id = OLD.estagio_id THEN
    RETURN NEW;
  END IF;

  FOR reg IN
    SELECT * FROM public.pipeline_automacoes
     WHERE ativo = true
       AND evento = 'card_chegou'
       AND estagio_origem_id = NEW.estagio_id
     ORDER BY ordem
  LOOP
    PERFORM public.executar_automacao_acao(reg.id, NEW.pedido_id, NEW.id, 'card_chegou', '{}'::jsonb);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kanban_card_chegou ON public.kanban_cards;
CREATE TRIGGER trg_kanban_card_chegou
AFTER INSERT OR UPDATE OF estagio_id ON public.kanban_cards
FOR EACH ROW EXECUTE FUNCTION public.kanban_card_chegou();
