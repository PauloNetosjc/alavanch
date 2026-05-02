
-- 1. Bucket privado para anexos de assinatura (selfie + PDF assinado impresso)
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos-assinatura', 'contratos-assinatura', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: leitura/escrita pública via token (anon) + autenticados da loja
DROP POLICY IF EXISTS "contratos_assinatura_anon_write" ON storage.objects;
CREATE POLICY "contratos_assinatura_anon_write"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'contratos-assinatura');

DROP POLICY IF EXISTS "contratos_assinatura_anon_read" ON storage.objects;
CREATE POLICY "contratos_assinatura_anon_read"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'contratos-assinatura');

DROP POLICY IF EXISTS "contratos_assinatura_auth_all" ON storage.objects;
CREATE POLICY "contratos_assinatura_auth_all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'contratos-assinatura')
WITH CHECK (bucket_id = 'contratos-assinatura');

-- 2. Novos campos no contrato
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS documento_url text,
  ADD COLUMN IF NOT EXISTS pdf_assinado_url text,
  ADD COLUMN IF NOT EXISTS metodo_assinatura text,            -- 'digital' | 'manual'
  ADD COLUMN IF NOT EXISTS enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS enviado_via text;                  -- 'email' | 'whatsapp' | 'link'

-- 3. Bloqueio de workflow no pedido enquanto contrato não estiver assinado
CREATE OR REPLACE FUNCTION public.bloquear_workflow_sem_assinatura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
BEGIN
  -- Só checa quando muda o estágio do workflow para algo além de 'aguardando'
  IF NEW.workflow_estagio IS DISTINCT FROM OLD.workflow_estagio
     AND NEW.workflow_estagio IS NOT NULL
     AND NEW.workflow_estagio <> 'aguardando'
     AND NEW.orcamento_id IS NOT NULL THEN
    SELECT status INTO v_status FROM public.contratos
      WHERE orcamento_id = NEW.orcamento_id
      ORDER BY created_at DESC LIMIT 1;
    IF v_status IS NOT NULL AND v_status <> 'assinado' THEN
      RAISE EXCEPTION 'Não é possível avançar o workflow operacional: contrato ainda não foi assinado.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_workflow_sem_assinatura ON public.pedidos;
CREATE TRIGGER trg_bloquear_workflow_sem_assinatura
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.bloquear_workflow_sem_assinatura();

-- 4. Timeline automática para eventos de contrato (criação, envio, assinatura)
CREATE OR REPLACE FUNCTION public.log_contrato_evento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pedido_id uuid;
  v_uid uuid;
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;
  SELECT id INTO v_pedido_id FROM public.pedidos
    WHERE orcamento_id = COALESCE(NEW.orcamento_id, OLD.orcamento_id)
    ORDER BY created_at DESC LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
    VALUES ('pedido', COALESCE(v_pedido_id, NEW.orcamento_id), 'contrato_criado',
            'Contrato ' || NEW.numero || ' criado', v_uid,
            jsonb_build_object('contrato_id', NEW.id, 'numero', NEW.numero, 'valor', NEW.valor_total));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.enviado_em IS NULL AND NEW.enviado_em IS NOT NULL THEN
      INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
      VALUES ('pedido', COALESCE(v_pedido_id, NEW.orcamento_id), 'contrato_enviado',
              'Contrato enviado via ' || COALESCE(NEW.enviado_via,'link'), v_uid,
              jsonb_build_object('contrato_id', NEW.id, 'via', NEW.enviado_via));
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'assinado' THEN
      INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
      VALUES ('pedido', COALESCE(v_pedido_id, NEW.orcamento_id), 'contrato_assinado',
              'Contrato assinado por ' || COALESCE(NEW.assinatura_nome,'—') ||
              CASE WHEN NEW.metodo_assinatura IS NOT NULL THEN ' (' || NEW.metodo_assinatura || ')' ELSE '' END,
              v_uid,
              jsonb_build_object('contrato_id', NEW.id, 'metodo', NEW.metodo_assinatura,
                                 'tem_selfie', NEW.selfie_url IS NOT NULL,
                                 'tem_pdf', NEW.pdf_assinado_url IS NOT NULL));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_contrato_evento ON public.contratos;
CREATE TRIGGER trg_log_contrato_evento
  AFTER INSERT OR UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.log_contrato_evento();
