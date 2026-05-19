ALTER TABLE public.kanban_cards DISABLE TRIGGER USER;

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY pedido_id, pipeline ORDER BY iniciado_em DESC NULLS LAST, created_at DESC NULLS LAST) AS rn
    FROM public.kanban_cards
   WHERE pedido_id IS NOT NULL
)
DELETE FROM public.kanban_cards k USING ranked r WHERE k.id = r.id AND r.rn > 1;

ALTER TABLE public.kanban_cards ENABLE TRIGGER USER;

DROP INDEX IF EXISTS public.uniq_kanban_cards_pedido_estagio;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kanban_cards_pedido_pipeline
  ON public.kanban_cards(pedido_id, pipeline)
  WHERE pedido_id IS NOT NULL;