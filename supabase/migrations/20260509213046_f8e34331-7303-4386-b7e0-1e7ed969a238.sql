-- Colunas de recusa
ALTER TABLE public.solicitacoes_assinatura
  ADD COLUMN IF NOT EXISTS motivo_recusa text,
  ADD COLUMN IF NOT EXISTS recusado_em timestamptz;

-- Permissão para cliente recusar via token (RLS anon)
DROP POLICY IF EXISTS "sa_update_anon" ON public.solicitacoes_assinatura;
CREATE POLICY "sa_update_anon"
ON public.solicitacoes_assinatura
FOR UPDATE
TO anon
USING (
  token IS NOT NULL
  AND status = ANY (ARRAY['aguardando_cliente'::assinatura_status, 'rascunho'::assinatura_status])
  AND expira_em > now()
);

-- Permitir anon inserir evento de recusa
DROP POLICY IF EXISTS "ev_insert_anon" ON public.assinatura_eventos;
CREATE POLICY "ev_insert_anon"
ON public.assinatura_eventos
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.solicitacoes_assinatura s
    WHERE s.id = assinatura_eventos.solicitacao_id
      AND s.token IS NOT NULL
  )
);

-- Bucket para PDFs finais
INSERT INTO storage.buckets (id, name, public)
VALUES ('assinaturas-finais', 'assinaturas-finais', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "assinaturas_finais_read" ON storage.objects;
CREATE POLICY "assinaturas_finais_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'assinaturas-finais');

DROP POLICY IF EXISTS "assinaturas_finais_write_auth" ON storage.objects;
CREATE POLICY "assinaturas_finais_write_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assinaturas-finais');

-- Função: notifica equipe da loja + registra na timeline do pedido
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

  -- Timeline do pedido
  INSERT INTO public.timeline_eventos (entidade_tipo, entidade_id, tipo, descricao, metadata)
  VALUES ('pedido', NEW.pedido_id, v_tipo_timeline, v_msg,
          jsonb_build_object('solicitacao_id', NEW.id, 'status', NEW.status));

  -- Notifica admins e gerentes da loja
  FOR v_user IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role IN ('admin','gerente')
      AND (p.loja_id = NEW.loja_id OR ur.role = 'admin')
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