
ALTER TABLE public.parceiros ADD COLUMN IF NOT EXISTS data_nascimento date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_nascimento date;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS uf text;

-- Permitir descricao mais rica + indice para evitar duplicar feriado no mesmo dia/loja
CREATE UNIQUE INDEX IF NOT EXISTS agenda_feriados_unq
  ON public.agenda_feriados (data, COALESCE(loja_id, '00000000-0000-0000-0000-000000000000'::uuid), descricao);
