
-- =====================================================================
-- 1) Ambientes: separa "incluir" (negociavel) de "aplicar desconto"
-- =====================================================================
ALTER TABLE public.ambientes
  ADD COLUMN IF NOT EXISTS aplicar_desconto boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.ambientes.negociavel IS
  'Se TRUE, o ambiente entra na soma do total da proposta; se FALSE, é excluído.';
COMMENT ON COLUMN public.ambientes.aplicar_desconto IS
  'Se TRUE, recebe desconto rateado proporcional; se FALSE, mantém preço cheio.';

-- =====================================================================
-- 2) Pipeline operacional - 18 estágios
-- =====================================================================
INSERT INTO public.pipeline_estagios (pipeline, nome, ordem, cor, ativo) VALUES
  ('operacional', 'Venda confirmada',          1,  '#10b981', true),
  ('operacional', 'Aguardando medição técnica', 2, '#f59e0b', true),
  ('operacional', 'Medição agendada',           3, '#0891b2', true),
  ('operacional', 'Medição realizada',          4, '#0e7490', true),
  ('operacional', 'Aguardando revisão final',   5, '#8b5cf6', true),
  ('operacional', 'Revisão final em produção',  6, '#7c3aed', true),
  ('operacional', 'Revisão pronta',             7, '#6d28d9', true),
  ('operacional', 'Aguardando aprovação final', 8, '#ec4899', true),
  ('operacional', 'Enviado para fábrica',       9, '#f97316', true),
  ('operacional', 'Em produção',                10,'#ea580c', true),
  ('operacional', 'Disponível para entrega',    11,'#84cc16', true),
  ('operacional', 'Entrega agendada',           12,'#65a30d', true),
  ('operacional', 'Entregue',                   13,'#16a34a', true),
  ('operacional', 'Montagem agendada',          14,'#06b6d4', true),
  ('operacional', 'Em montagem',                15,'#0284c7', true),
  ('operacional', 'Montagem concluída',         16,'#14b8a6', true),
  ('operacional', 'Vistoria',                   17,'#a855f7', true),
  ('operacional', 'Finalizado',                 18,'#22c55e', true)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 3) Pedidos: link com estágio operacional + responsável + prazo
-- =====================================================================
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS estagio_operacional_id uuid REFERENCES public.pipeline_estagios(id),
  ADD COLUMN IF NOT EXISTS estagio_responsavel_id uuid,
  ADD COLUMN IF NOT EXISTS estagio_prazo date,
  ADD COLUMN IF NOT EXISTS estagio_iniciado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_pedidos_estagio_op ON public.pedidos(estagio_operacional_id);

-- =====================================================================
-- 4) Tabelas auxiliares por estágio do pedido
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pedido_estagio_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  estagio_id uuid REFERENCES public.pipeline_estagios(id),
  estagio_anterior_id uuid REFERENCES public.pipeline_estagios(id),
  usuario_id uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedido_estagio_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pedido_estagio_historico_select" ON public.pedido_estagio_historico
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pedido_estagio_historico_insert" ON public.pedido_estagio_historico
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_pedido_estagio_hist ON public.pedido_estagio_historico(pedido_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pedido_estagio_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  estagio_id uuid REFERENCES public.pipeline_estagios(id),
  descricao text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  concluido_em timestamptz,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedido_estagio_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pedido_estagio_checklist_all" ON public.pedido_estagio_checklist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================================
-- 5) Trigger: registra histórico quando muda estágio
-- =====================================================================
CREATE OR REPLACE FUNCTION public.log_pedido_estagio_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estagio_operacional_id IS DISTINCT FROM OLD.estagio_operacional_id THEN
    INSERT INTO public.pedido_estagio_historico
      (pedido_id, estagio_id, estagio_anterior_id, usuario_id)
    VALUES
      (NEW.id, NEW.estagio_operacional_id, OLD.estagio_operacional_id, auth.uid());
    NEW.estagio_iniciado_em := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_pedido_estagio ON public.pedidos;
CREATE TRIGGER trg_log_pedido_estagio
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.log_pedido_estagio_change();

-- =====================================================================
-- 6) Trigger: ao confirmar venda + contrato assinado, inicia pipeline
-- =====================================================================
CREATE OR REPLACE FUNCTION public.iniciar_pipeline_operacional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estagio_inicial uuid;
BEGIN
  IF NEW.estagio_operacional_id IS NULL THEN
    SELECT id INTO v_estagio_inicial
    FROM public.pipeline_estagios
    WHERE pipeline = 'operacional' AND ordem = 1 AND ativo = true
    LIMIT 1;
    IF v_estagio_inicial IS NOT NULL THEN
      NEW.estagio_operacional_id := v_estagio_inicial;
      NEW.estagio_iniciado_em := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_iniciar_pipeline_op ON public.pedidos;
CREATE TRIGGER trg_iniciar_pipeline_op
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.iniciar_pipeline_operacional();

-- Inicializa pedidos existentes que não têm estágio
UPDATE public.pedidos p
SET estagio_operacional_id = (
  SELECT id FROM public.pipeline_estagios
  WHERE pipeline = 'operacional' AND ordem = 1 LIMIT 1
)
WHERE estagio_operacional_id IS NULL;
