
-- Tabela central de autorizações fora do padrão
-- (descontos acima do limite, agendamentos fora do horário, etc.)
CREATE TYPE public.autorizacao_tipo AS ENUM (
  'desconto_acima_limite',
  'agenda_fora_horario',
  'agenda_fora_dia',
  'agenda_lead_time',
  'outro'
);

CREATE TYPE public.autorizacao_status AS ENUM ('pendente','aprovada','rejeitada','expirada');

CREATE TABLE public.autorizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.autorizacao_tipo NOT NULL,
  status public.autorizacao_status NOT NULL DEFAULT 'pendente',
  titulo text NOT NULL,
  descricao text,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- escopo
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  agenda_evento_id uuid,
  -- valores numéricos opcionais (para desconto)
  valor_solicitado numeric,
  limite_padrao numeric,
  -- pessoas
  solicitante_id uuid,
  solicitante_email text,
  aprovador_id uuid,
  aprovador_email text,
  decidido_em timestamptz,
  decisao_observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_autorizacoes_status ON public.autorizacoes (status, created_at DESC);
CREATE INDEX idx_autorizacoes_loja ON public.autorizacoes (loja_id);
CREATE INDEX idx_autorizacoes_pedido ON public.autorizacoes (pedido_id);

ALTER TABLE public.autorizacoes ENABLE ROW LEVEL SECURITY;

-- ver: admin/diretor veem tudo; demais veem da própria loja ou as que solicitaram
CREATE POLICY "autorizacoes_select" ON public.autorizacoes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'diretor')
    OR solicitante_id = auth.uid()
    OR (loja_id IS NOT NULL AND loja_id = public.current_loja_id())
  );

-- inserir: qualquer usuário autenticado pode SOLICITAR
CREATE POLICY "autorizacoes_insert" ON public.autorizacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    solicitante_id = auth.uid()
    AND status = 'pendente'
  );

-- atualizar: apenas admin/diretor podem decidir
CREATE POLICY "autorizacoes_update_admin" ON public.autorizacoes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

-- trigger updated_at
CREATE TRIGGER trg_autorizacoes_updated
  BEFORE UPDATE ON public.autorizacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- trigger: ao decidir, registra timeline e notifica solicitante
CREATE OR REPLACE FUNCTION public.log_autorizacao_decisao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_uid uuid;
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;

  IF TG_OP = 'INSERT' THEN
    -- notifica admins e diretores
    INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, link, metadata)
    SELECT ur.user_id, 'autorizacao',
      'Nova solicitação de autorização: ' || NEW.titulo,
      COALESCE(NEW.descricao,''),
      '/autorizacoes',
      jsonb_build_object('autorizacao_id', NEW.id, 'tipo', NEW.tipo)
    FROM public.user_roles ur
    WHERE ur.role IN ('admin','diretor');
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.pedido_id IS NOT NULL THEN
      INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
      VALUES ('pedido', NEW.pedido_id, 'autorizacao_' || NEW.status::text,
              'Autorização "' || NEW.titulo || '": ' || NEW.status::text, v_uid,
              jsonb_build_object('autorizacao_id', NEW.id, 'tipo', NEW.tipo));
    END IF;
    -- notifica solicitante
    IF NEW.solicitante_id IS NOT NULL THEN
      INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, link, metadata)
      VALUES (NEW.solicitante_id, 'autorizacao',
              'Sua solicitação foi ' || NEW.status::text,
              NEW.titulo,
              '/autorizacoes',
              jsonb_build_object('autorizacao_id', NEW.id));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_autorizacao_log
  AFTER INSERT OR UPDATE ON public.autorizacoes
  FOR EACH ROW EXECUTE FUNCTION public.log_autorizacao_decisao();
