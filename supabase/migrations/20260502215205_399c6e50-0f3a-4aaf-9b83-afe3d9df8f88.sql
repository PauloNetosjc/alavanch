-- Vincula cliente a evento de agenda para histórico no perfil
ALTER TABLE public.agenda_eventos
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_cliente ON public.agenda_eventos(cliente_id);