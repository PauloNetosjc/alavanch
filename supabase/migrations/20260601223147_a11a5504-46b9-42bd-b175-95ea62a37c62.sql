ALTER TABLE public.configuracoes_empresa
ADD COLUMN IF NOT EXISTS obrigar_informar_vencimento boolean NOT NULL DEFAULT false;