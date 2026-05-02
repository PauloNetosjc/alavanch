-- 1) Adiciona novo valor ao enum agenda_tipo
ALTER TYPE public.agenda_tipo ADD VALUE IF NOT EXISTS 'apresentacao_comercial';

-- 2) Default e backfill: incluir sábado
ALTER TABLE public.agenda_config
  ALTER COLUMN dias_semana SET DEFAULT ARRAY[1,2,3,4,5,6];

UPDATE public.agenda_config
SET dias_semana = ARRAY[1,2,3,4,5,6]
WHERE dias_semana = ARRAY[1,2,3,4,5];

-- 3) is_dia_util: sábado (ISODOW=6) também conta como útil
CREATE OR REPLACE FUNCTION public.is_dia_util(_data date, _loja uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXTRACT(ISODOW FROM _data) < 7
     AND NOT EXISTS (
       SELECT 1 FROM public.agenda_feriados
       WHERE data = _data AND (loja_id IS NULL OR loja_id = _loja)
     );
$$;

-- 4) RLS: leitura por responsável OU eventos globais (loja_id IS NULL)
DROP POLICY IF EXISTS ag_ev_select ON public.agenda_eventos;
CREATE POLICY ag_ev_select ON public.agenda_eventos FOR SELECT TO authenticated USING (
  responsavel_id = auth.uid()
  OR created_by = auth.uid()
  OR has_role(auth.uid(),'admin')
  OR has_permission(auth.uid(),'diretoria','view')
  OR loja_id IS NULL
  OR (loja_id IS NOT NULL AND loja_id = current_loja_id())
);

-- 5) RLS: somente admin pode criar evento global; demais somente da própria loja
DROP POLICY IF EXISTS ag_ev_insert ON public.agenda_eventos;
CREATE POLICY ag_ev_insert ON public.agenda_eventos FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'admin')
    OR (loja_id IS NOT NULL AND loja_id = current_loja_id())
  );
