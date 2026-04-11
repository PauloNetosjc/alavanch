-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'projetista';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'conferente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'atendente';

-- Add last_check_date to bank_accounts
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS last_check_date timestamptz;

-- Add tags to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tags text[];