
-- ============ Lote 0.2: Papéis e permissões granulares ============

-- 1) Expandir enum app_role com os novos papéis
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'diretor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'projetista';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tecnico';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'assistencia';
