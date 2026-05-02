-- =========================================================
-- AGENDA OPERACIONAL
-- =========================================================

-- 1) Tipos de evento
DO $$ BEGIN
  CREATE TYPE public.agenda_tipo AS ENUM (
    'medicao_tecnica','revisao_final','entrega','montagem','assistencia_tecnica','tarefa_interna'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.agenda_status AS ENUM ('agendado','concluido','cancelado','reagendado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Configurações por tipo (dias permitidos, horários, prazos mínimos)
CREATE TABLE IF NOT EXISTS public.agenda_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NULL,                    -- NULL = global
  tipo public.agenda_tipo NOT NULL,
  prazo_minimo_dias_uteis int NOT NULL DEFAULT 0,   -- ex: medição = 3 após venda
  dias_semana int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],  -- 0=dom..6=sáb
  hora_inicio time NOT NULL DEFAULT '08:00',
  hora_fim    time NOT NULL DEFAULT '18:00',
  duracao_padrao_min int NOT NULL DEFAULT 60,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, tipo)
);
ALTER TABLE public.agenda_config ENABLE ROW LEVEL SECURITY;

-- 3) Feriados (data + descrição), por loja ou global
CREATE TABLE IF NOT EXISTS public.agenda_feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NULL,
  data date NOT NULL,
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, data)
);
ALTER TABLE public.agenda_feriados ENABLE ROW LEVEL SECURITY;

-- 4) Autorizadores de exceção por loja
CREATE TABLE IF NOT EXISTS public.agenda_excecao_autorizadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NULL,
  user_id uuid NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, user_id)
);
ALTER TABLE public.agenda_excecao_autorizadores ENABLE ROW LEVEL SECURITY;

-- 5) Eventos de agenda
CREATE TABLE IF NOT EXISTS public.agenda_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NULL,
  orcamento_id uuid NULL,
  loja_id uuid NULL,
  tipo public.agenda_tipo NOT NULL,
  titulo text NOT NULL,
  descricao text NULL,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NULL,
  endereco text NULL,
  responsavel_id uuid NOT NULL,
  status public.agenda_status NOT NULL DEFAULT 'agendado',
  excecao boolean NOT NULL DEFAULT false,
  excecao_autorizador_id uuid NULL,
  excecao_motivo text NULL,
  concluido_em timestamptz NULL,
  cancelado_em timestamptz NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agenda_eventos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_resp ON public.agenda_eventos(responsavel_id, data);
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_pedido ON public.agenda_eventos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_loja_data ON public.agenda_eventos(loja_id, data);

-- 6) Triggers de updated_at
DROP TRIGGER IF EXISTS trg_agenda_config_upd ON public.agenda_config;
CREATE TRIGGER trg_agenda_config_upd BEFORE UPDATE ON public.agenda_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_agenda_eventos_upd ON public.agenda_eventos;
CREATE TRIGGER trg_agenda_eventos_upd BEFORE UPDATE ON public.agenda_eventos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) Função: é dia útil (descontando feriados)
CREATE OR REPLACE FUNCTION public.is_dia_util(_data date, _loja uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXTRACT(ISODOW FROM _data) < 6
     AND NOT EXISTS (
       SELECT 1 FROM public.agenda_feriados
       WHERE data = _data AND (loja_id IS NULL OR loja_id = _loja)
     );
$$;

-- 8) Função: somar N dias úteis a partir de uma data
CREATE OR REPLACE FUNCTION public.add_dias_uteis(_inicio date, _n int, _loja uuid)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  d date := _inicio;
  contados int := 0;
BEGIN
  IF _n <= 0 THEN RETURN _inicio; END IF;
  WHILE contados < _n LOOP
    d := d + 1;
    IF public.is_dia_util(d, _loja) THEN contados := contados + 1; END IF;
  END LOOP;
  RETURN d;
END $$;

-- 9) Função: pode autorizar exceção
CREATE OR REPLACE FUNCTION public.pode_autorizar_excecao_agenda(_user_id uuid, _loja uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(_user_id,'admin')
      OR EXISTS (
        SELECT 1 FROM public.agenda_excecao_autorizadores
        WHERE user_id = _user_id AND ativo
          AND (loja_id IS NULL OR loja_id = _loja)
      );
$$;

-- 10) Trigger: log na timeline do pedido + criação de notificação ao responsável
CREATE OR REPLACE FUNCTION public.log_agenda_evento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid;
  v_desc text;
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;

  IF TG_OP = 'INSERT' THEN
    v_desc := 'Evento criado: ' || NEW.tipo::text || ' em ' || to_char(NEW.data,'DD/MM/YYYY')
              || ' ' || to_char(NEW.hora_inicio,'HH24:MI')
              || CASE WHEN NEW.excecao THEN ' (exceção)' ELSE '' END;
    IF NEW.pedido_id IS NOT NULL THEN
      INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
      VALUES ('pedido', NEW.pedido_id, 'agenda_evento', v_desc, v_uid,
              jsonb_build_object('agenda_id', NEW.id, 'tipo', NEW.tipo, 'excecao', NEW.excecao,
                                 'autorizador', NEW.excecao_autorizador_id, 'motivo', NEW.excecao_motivo));
    END IF;
    -- notificação ao responsável
    INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, link, metadata)
    VALUES (NEW.responsavel_id, 'agenda',
            'Novo evento agendado: ' || NEW.titulo,
            'Em ' || to_char(NEW.data,'DD/MM/YYYY') || ' às ' || to_char(NEW.hora_inicio,'HH24:MI'),
            '/agenda',
            jsonb_build_object('agenda_id', NEW.id, 'tipo', NEW.tipo, 'pedido_id', NEW.pedido_id));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.pedido_id IS NOT NULL THEN
      INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
      VALUES ('pedido', NEW.pedido_id, 'agenda_status',
              'Evento ' || NEW.tipo::text || ': ' || OLD.status::text || ' → ' || NEW.status::text,
              v_uid, jsonb_build_object('agenda_id', NEW.id));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_log_agenda_evento ON public.agenda_eventos;
CREATE TRIGGER trg_log_agenda_evento
AFTER INSERT OR UPDATE ON public.agenda_eventos
FOR EACH ROW EXECUTE FUNCTION public.log_agenda_evento();

-- 11) RLS policies
-- agenda_config (admin gerencia, todos leem)
DROP POLICY IF EXISTS ag_cfg_select ON public.agenda_config;
CREATE POLICY ag_cfg_select ON public.agenda_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ag_cfg_admin ON public.agenda_config;
CREATE POLICY ag_cfg_admin ON public.agenda_config FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- feriados (admin gerencia, todos leem)
DROP POLICY IF EXISTS ag_fer_select ON public.agenda_feriados;
CREATE POLICY ag_fer_select ON public.agenda_feriados FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ag_fer_admin ON public.agenda_feriados;
CREATE POLICY ag_fer_admin ON public.agenda_feriados FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- autorizadores (admin gerencia)
DROP POLICY IF EXISTS ag_auth_select ON public.agenda_excecao_autorizadores;
CREATE POLICY ag_auth_select ON public.agenda_excecao_autorizadores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ag_auth_admin ON public.agenda_excecao_autorizadores;
CREATE POLICY ag_auth_admin ON public.agenda_excecao_autorizadores FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- eventos: usuário vê os seus + admin/diretoria veem tudo + gerente vê da loja
DROP POLICY IF EXISTS ag_ev_select ON public.agenda_eventos;
CREATE POLICY ag_ev_select ON public.agenda_eventos FOR SELECT TO authenticated USING (
  responsavel_id = auth.uid()
  OR created_by = auth.uid()
  OR has_role(auth.uid(),'admin')
  OR has_permission(auth.uid(),'diretoria','view')
  OR (loja_id IS NOT NULL AND loja_id = current_loja_id())
);
DROP POLICY IF EXISTS ag_ev_insert ON public.agenda_eventos;
CREATE POLICY ag_ev_insert ON public.agenda_eventos FOR INSERT TO authenticated
  WITH CHECK (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS ag_ev_update ON public.agenda_eventos;
CREATE POLICY ag_ev_update ON public.agenda_eventos FOR UPDATE TO authenticated USING (
  responsavel_id = auth.uid() OR created_by = auth.uid()
  OR has_role(auth.uid(),'admin')
  OR (loja_id IS NOT NULL AND loja_id = current_loja_id())
);
DROP POLICY IF EXISTS ag_ev_delete ON public.agenda_eventos;
CREATE POLICY ag_ev_delete ON public.agenda_eventos FOR DELETE TO authenticated USING (
  has_role(auth.uid(),'admin') OR created_by = auth.uid()
);

-- 12) Defaults razoáveis (uma vez)
INSERT INTO public.agenda_config (loja_id, tipo, prazo_minimo_dias_uteis, dias_semana, hora_inicio, hora_fim, duracao_padrao_min)
SELECT NULL, t::public.agenda_tipo, p, ARRAY[1,2,3,4,5], '08:00'::time, '18:00'::time, 60
FROM (VALUES
  ('medicao_tecnica',3),
  ('revisao_final',5),
  ('entrega',0),
  ('montagem',0),
  ('assistencia_tecnica',0),
  ('tarefa_interna',0)
) AS v(t,p)
ON CONFLICT (loja_id, tipo) DO NOTHING;