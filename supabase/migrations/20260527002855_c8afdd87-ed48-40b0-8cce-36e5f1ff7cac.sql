
ALTER TABLE public.rh_zonas_ponto
  ADD COLUMN IF NOT EXISTS cargo_id UUID REFERENCES public.rh_cargos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS funcionario_id UUID REFERENCES public.rh_funcionarios(id) ON DELETE SET NULL;
