-- Corrigir política pública para permitir a transição após assinatura do cliente
DROP POLICY IF EXISTS "sa_update_anon" ON public.solicitacoes_assinatura;
CREATE POLICY "sa_update_anon"
ON public.solicitacoes_assinatura
FOR UPDATE
TO anon
USING (
  token IS NOT NULL
  AND status = ANY (ARRAY['aguardando_cliente'::assinatura_status, 'rascunho'::assinatura_status, 'assinado_cliente'::assinatura_status, 'aguardando_loja'::assinatura_status])
  AND expira_em > now()
)
WITH CHECK (
  token IS NOT NULL
  AND expira_em > now()
  AND status = ANY (ARRAY['assinado_cliente'::assinatura_status, 'aguardando_loja'::assinatura_status, 'concluido'::assinatura_status, 'recusado'::assinatura_status])
);

-- Sincroniza solicitações a partir das evidências/participantes quando o cliente assina
CREATE OR REPLACE FUNCTION public.sincronizar_status_assinatura_por_evidencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solic record;
  v_requer_loja boolean := false;
  v_cliente_assinado timestamptz;
  v_loja_assinado timestamptz;
  v_novo_status public.assinatura_status;
BEGIN
  SELECT s.*, td.requer_assinatura_loja
    INTO v_solic
  FROM public.solicitacoes_assinatura s
  LEFT JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
  WHERE s.id = NEW.solicitacao_id;

  IF v_solic.id IS NULL OR v_solic.status IN ('concluido','cancelado','recusado','expirado') THEN
    RETURN NEW;
  END IF;

  v_requer_loja := COALESCE(v_solic.requer_assinatura_loja, false);

  SELECT max(p.assinado_em)
    INTO v_cliente_assinado
  FROM public.assinatura_participantes p
  WHERE p.solicitacao_id = NEW.solicitacao_id
    AND p.tipo = 'cliente'
    AND p.status = 'assinado';

  SELECT max(p.assinado_em)
    INTO v_loja_assinado
  FROM public.assinatura_participantes p
  WHERE p.solicitacao_id = NEW.solicitacao_id
    AND p.tipo = 'loja'
    AND p.status = 'assinado';

  IF v_cliente_assinado IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_requer_loja AND v_loja_assinado IS NULL THEN
    v_novo_status := 'aguardando_loja';
  ELSE
    v_novo_status := 'concluido';
  END IF;

  UPDATE public.solicitacoes_assinatura
     SET status = v_novo_status,
         cliente_assinado_em = COALESCE(cliente_assinado_em, v_cliente_assinado, now()),
         loja_assinado_em = CASE WHEN v_loja_assinado IS NOT NULL THEN COALESCE(loja_assinado_em, v_loja_assinado) ELSE loja_assinado_em END,
         concluido_em = CASE WHEN v_novo_status = 'concluido' THEN COALESCE(concluido_em, now()) ELSE concluido_em END
   WHERE id = NEW.solicitacao_id
     AND status NOT IN ('concluido','cancelado','recusado','expirado');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_assinatura_evidencia ON public.assinatura_evidencias;
CREATE TRIGGER trg_sync_assinatura_evidencia
AFTER INSERT ON public.assinatura_evidencias
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_status_assinatura_por_evidencia();

-- Fortalece a sincronização do contrato: contrato deixa de bloquear o pedido quando o cliente assina
CREATE OR REPLACE FUNCTION public.sincronizar_contrato_assinado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contrato_id IS NOT NULL
     AND NEW.status IN ('aguardando_loja','assinado_cliente','assinado_loja','concluido')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.cliente_assinado_em IS DISTINCT FROM NEW.cliente_assinado_em) THEN
    UPDATE public.contratos
       SET status = 'assinado',
           assinado_em = COALESCE(assinado_em, NEW.cliente_assinado_em, NEW.concluido_em, now()),
           assinatura_nome = COALESCE(assinatura_nome, (
             SELECT p.nome FROM public.assinatura_participantes p
             WHERE p.solicitacao_id = NEW.id AND p.tipo = 'cliente' AND p.status = 'assinado'
             ORDER BY p.assinado_em DESC NULLS LAST LIMIT 1
           )),
           assinatura_cpf = COALESCE(assinatura_cpf, (
             SELECT p.documento FROM public.assinatura_participantes p
             WHERE p.solicitacao_id = NEW.id AND p.tipo = 'cliente' AND p.status = 'assinado'
             ORDER BY p.assinado_em DESC NULLS LAST LIMIT 1
           )),
           metodo_assinatura = COALESCE(metodo_assinatura, 'digital')
     WHERE id = NEW.contrato_id
       AND status <> 'assinado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contrato_assinado ON public.solicitacoes_assinatura;
CREATE TRIGGER trg_sync_contrato_assinado
AFTER INSERT OR UPDATE OF status, cliente_assinado_em ON public.solicitacoes_assinatura
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_contrato_assinado();

-- Corrige notificação interna: usa profiles.user_id e inclui diretores/gerentes/admins
CREATE OR REPLACE FUNCTION public.notificar_evento_assinatura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text;
  v_msg text;
  v_tipo_timeline text;
  v_pedido_codigo text;
  v_user record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT codigo INTO v_pedido_codigo FROM public.pedidos WHERE id = NEW.pedido_id;

  IF NEW.status = 'assinado_cliente' OR NEW.status = 'aguardando_loja' THEN
    v_titulo := 'Cliente assinou documento';
    v_msg := 'Pedido ' || coalesce(v_pedido_codigo,'') || ' — cliente concluiu a assinatura.';
    v_tipo_timeline := 'assinatura_cliente';
  ELSIF NEW.status = 'concluido' THEN
    v_titulo := 'Assinatura concluída';
    v_msg := 'Pedido ' || coalesce(v_pedido_codigo,'') || ' — documento totalmente assinado.';
    v_tipo_timeline := 'assinatura_concluida';
  ELSIF NEW.status = 'recusado' THEN
    v_titulo := 'Cliente recusou assinatura';
    v_msg := 'Pedido ' || coalesce(v_pedido_codigo,'') || ' — motivo: ' || coalesce(NEW.motivo_recusa, 'não informado');
    v_tipo_timeline := 'assinatura_recusada';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.timeline_eventos (entidade_tipo, entidade_id, tipo, descricao, metadata)
  VALUES ('pedido', NEW.pedido_id, v_tipo_timeline, v_msg,
          jsonb_build_object('solicitacao_id', NEW.id, 'status', NEW.status));

  FOR v_user IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.role IN ('admin','gerente','diretor')
      AND (p.loja_id = NEW.loja_id OR p.loja_id IS NULL OR ur.role IN ('admin','diretor'))
  LOOP
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link, metadata)
    VALUES (
      v_user.user_id,
      'assinatura',
      v_titulo,
      v_msg,
      '/pedidos/' || NEW.pedido_id::text,
      jsonb_build_object('solicitacao_id', NEW.id, 'pedido_id', NEW.pedido_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_assinatura ON public.solicitacoes_assinatura;
CREATE TRIGGER trg_notificar_assinatura
AFTER UPDATE OF status ON public.solicitacoes_assinatura
FOR EACH ROW
EXECUTE FUNCTION public.notificar_evento_assinatura();

-- Backfill: reprocessa solicitações que já têm evidência de cliente mas ficaram pendentes
WITH assinadas AS (
  SELECT s.id, max(p.assinado_em) AS cliente_assinado_em, COALESCE(td.requer_assinatura_loja, false) AS requer_loja
  FROM public.solicitacoes_assinatura s
  JOIN public.assinatura_participantes p ON p.solicitacao_id = s.id
  JOIN public.tipos_documento td ON td.id = s.tipo_documento_id
  WHERE p.tipo = 'cliente'
    AND p.status = 'assinado'
    AND s.status IN ('aguardando_cliente','rascunho')
  GROUP BY s.id, td.requer_assinatura_loja
)
UPDATE public.solicitacoes_assinatura s
   SET status = CASE WHEN a.requer_loja THEN 'aguardando_loja'::public.assinatura_status ELSE 'concluido'::public.assinatura_status END,
       cliente_assinado_em = COALESCE(s.cliente_assinado_em, a.cliente_assinado_em, now()),
       concluido_em = CASE WHEN a.requer_loja THEN s.concluido_em ELSE COALESCE(s.concluido_em, now()) END
  FROM assinadas a
 WHERE s.id = a.id;