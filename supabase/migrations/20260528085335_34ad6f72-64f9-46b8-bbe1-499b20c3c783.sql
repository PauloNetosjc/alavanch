
-- 1) Estender enum de tipo (novos tipos técnicos)
ALTER TYPE autorizacao_tipo ADD VALUE IF NOT EXISTS 'agenda_dia_nao_permitido';
ALTER TYPE autorizacao_tipo ADD VALUE IF NOT EXISTS 'lead_time_abaixo_minimo';
ALTER TYPE autorizacao_tipo ADD VALUE IF NOT EXISTS 'revisao_sem_diferenca_aguardando_aprovacao';
ALTER TYPE autorizacao_tipo ADD VALUE IF NOT EXISTS 'revisao_com_diferenca_positiva';
ALTER TYPE autorizacao_tipo ADD VALUE IF NOT EXISTS 'revisao_com_diferenca_negativa';
ALTER TYPE autorizacao_tipo ADD VALUE IF NOT EXISTS 'revisao_adendo_pendente';

-- 2) Enum categoria
DO $$ BEGIN
  CREATE TYPE categoria_autorizacao AS ENUM ('revisao','agenda','desconto','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Novas colunas
ALTER TABLE public.autorizacoes
  ADD COLUMN IF NOT EXISTS categoria categoria_autorizacao,
  ADD COLUMN IF NOT EXISTS origem_modulo text,
  ADD COLUMN IF NOT EXISTS origem_id uuid,
  ADD COLUMN IF NOT EXISTS motivo_solicitacao text,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS prioridade text,
  ADD COLUMN IF NOT EXISTS cliente_id uuid;

-- 4) Backfill categoria a partir do tipo
UPDATE public.autorizacoes SET categoria = CASE
  WHEN tipo::text LIKE 'desconto%' THEN 'desconto'::categoria_autorizacao
  WHEN tipo::text LIKE 'agenda%' OR tipo::text LIKE 'lead_time%' THEN 'agenda'::categoria_autorizacao
  WHEN tipo::text LIKE 'revisao%' THEN 'revisao'::categoria_autorizacao
  ELSE 'outro'::categoria_autorizacao END
WHERE categoria IS NULL;

-- Backfill origem_modulo onde já temos vínculo claro
UPDATE public.autorizacoes SET origem_modulo='agenda',  origem_id=agenda_evento_id WHERE origem_modulo IS NULL AND agenda_evento_id IS NOT NULL;
UPDATE public.autorizacoes SET origem_modulo='negociacao', origem_id=orcamento_id  WHERE origem_modulo IS NULL AND orcamento_id IS NOT NULL;

-- 5) Índice único parcial para evitar duplicidade de pendentes na mesma origem
CREATE UNIQUE INDEX IF NOT EXISTS autorizacoes_origem_pendente_unq
  ON public.autorizacoes(origem_modulo, origem_id)
  WHERE status='pendente' AND origem_modulo IS NOT NULL AND origem_id IS NOT NULL;

-- 6) Catálogo de permissões
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('autorizacoes','view','Visualizar a Central de Autorizações','Autorizações'),
  ('autorizacoes','aprovar','Aprovar ou rejeitar solicitações de autorização','Autorizações')
ON CONFLICT DO NOTHING;

-- 7) Atualizar RLS para permitir aprovação via permissão (mantendo admin/diretor)
DROP POLICY IF EXISTS autorizacoes_update_admin ON public.autorizacoes;
CREATE POLICY autorizacoes_update_admin ON public.autorizacoes
  FOR UPDATE
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'diretor'::app_role)
    OR public.has_permission(auth.uid(),'autorizacoes','aprovar')
  )
  WITH CHECK (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'diretor'::app_role)
    OR public.has_permission(auth.uid(),'autorizacoes','aprovar')
  );

-- 8) Trigger reverso: quando autorização de revisão for aprovada, marcar pedido_revisoes.aprovada=true
CREATE OR REPLACE FUNCTION public.fn_autorizacao_aplicar_efeito_revisao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada')
     AND NEW.origem_modulo = 'revisao' AND NEW.origem_id IS NOT NULL THEN
    UPDATE public.pedido_revisoes
       SET aprovada = true,
           aprovada_em = COALESCE(aprovada_em, now())
     WHERE id = NEW.origem_id
       AND COALESCE(aprovada,false) = false;
  END IF;

  -- Agenda: aprovar libera evento; rejeitar cancela
  IF NEW.origem_modulo = 'agenda' AND NEW.origem_id IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'aprovada' THEN
      UPDATE public.agenda_eventos SET status = 'confirmado'::agenda_status WHERE id = NEW.origem_id;
    ELSIF NEW.status = 'rejeitada' THEN
      UPDATE public.agenda_eventos SET status = 'cancelado'::agenda_status, cancelado_em = now() WHERE id = NEW.origem_id;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autorizacao_aplicar_efeito ON public.autorizacoes;
CREATE TRIGGER trg_autorizacao_aplicar_efeito
AFTER UPDATE ON public.autorizacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_autorizacao_aplicar_efeito_revisao();
