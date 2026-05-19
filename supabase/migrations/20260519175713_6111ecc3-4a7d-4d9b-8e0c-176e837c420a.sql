-- Add new fields for budget configuration and traceability
ALTER TABLE public.configuracoes_empresa
  ADD COLUMN IF NOT EXISTS usar_markup boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS comissao_loja_perc numeric DEFAULT 2.7,
  ADD COLUMN IF NOT EXISTS frete_venda_perc numeric DEFAULT 3.8;

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS cliente_final text,
  ADD COLUMN IF NOT EXISTS projetista_id uuid;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cliente_final text,
  ADD COLUMN IF NOT EXISTS projetista_id uuid;