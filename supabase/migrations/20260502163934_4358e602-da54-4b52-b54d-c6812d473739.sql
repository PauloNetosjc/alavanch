
-- 1) CRM: estágios editáveis
CREATE TABLE IF NOT EXISTS public.crm_estagios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  cor text DEFAULT '#7E4FA0',
  is_ganho boolean NOT NULL DEFAULT false,
  is_perdido boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_estagios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_estagios_select ON public.crm_estagios;
DROP POLICY IF EXISTS crm_estagios_admin ON public.crm_estagios;
CREATE POLICY crm_estagios_select ON public.crm_estagios FOR SELECT TO authenticated USING (true);
CREATE POLICY crm_estagios_admin ON public.crm_estagios FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Seed dos 7 estágios iniciais (apenas se vazio)
INSERT INTO public.crm_estagios (nome, ordem, cor, is_ganho, is_perdido)
SELECT * FROM (VALUES
  ('Novo orçamento', 1, '#6366F1', false, false),
  ('Projeto em desenvolvimento', 2, '#8B5CF6', false, false),
  ('Orçamento apresentado', 3, '#3B82F6', false, false),
  ('Em negociação', 4, '#F59E0B', false, false),
  ('Aguardando retorno', 5, '#EAB308', false, false),
  ('Convertido em venda', 6, '#10B981', true, false),
  ('Perdido', 7, '#EF4444', false, true)
) AS v(nome, ordem, cor, is_ganho, is_perdido)
WHERE NOT EXISTS (SELECT 1 FROM public.crm_estagios);

-- 2) Orçamentos: vínculo com estágio CRM, vendedor, origem, motivo de perda
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS estagio_id uuid REFERENCES public.crm_estagios(id),
  ADD COLUMN IF NOT EXISTS vendedor_id uuid,
  ADD COLUMN IF NOT EXISTS origem_id uuid REFERENCES public.origens_lead(id),
  ADD COLUMN IF NOT EXISTS motivo_perda text,
  ADD COLUMN IF NOT EXISTS perdido_em timestamptz;

-- Backfill estágio: se status=convertido/aprovado -> Convertido; perdido -> Perdido; demais -> Novo orçamento
UPDATE public.orcamentos o
SET estagio_id = (SELECT id FROM public.crm_estagios WHERE is_ganho ORDER BY ordem LIMIT 1)
WHERE estagio_id IS NULL AND o.status IN ('convertido','aprovado');
UPDATE public.orcamentos o
SET estagio_id = (SELECT id FROM public.crm_estagios WHERE is_perdido ORDER BY ordem LIMIT 1)
WHERE estagio_id IS NULL AND o.status = 'perdido';
UPDATE public.orcamentos o
SET estagio_id = (SELECT id FROM public.crm_estagios WHERE NOT is_ganho AND NOT is_perdido ORDER BY ordem LIMIT 1)
WHERE estagio_id IS NULL;

-- Trigger: ao criar orçamento, definir estágio inicial automaticamente
CREATE OR REPLACE FUNCTION public.orcamento_set_estagio_inicial()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.estagio_id IS NULL THEN
    SELECT id INTO NEW.estagio_id FROM public.crm_estagios
     WHERE ativo AND NOT is_ganho AND NOT is_perdido ORDER BY ordem LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_orc_estagio_inicial ON public.orcamentos;
CREATE TRIGGER trg_orc_estagio_inicial BEFORE INSERT ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.orcamento_set_estagio_inicial();

-- Trigger: sincronizar status quando estágio mudar
CREATE OR REPLACE FUNCTION public.orcamento_sync_status_estagio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ganho boolean; v_perdido boolean;
BEGIN
  IF NEW.estagio_id IS DISTINCT FROM OLD.estagio_id AND NEW.estagio_id IS NOT NULL THEN
    SELECT is_ganho, is_perdido INTO v_ganho, v_perdido FROM public.crm_estagios WHERE id = NEW.estagio_id;
    IF v_ganho THEN NEW.status := 'convertido';
    ELSIF v_perdido THEN
      NEW.status := 'perdido';
      IF NEW.perdido_em IS NULL THEN NEW.perdido_em := now(); END IF;
    ELSE NEW.status := 'negociacao';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_orc_sync_estagio ON public.orcamentos;
CREATE TRIGGER trg_orc_sync_estagio BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.orcamento_sync_status_estagio();

-- 3) Clientes: vendedor, origem, parceiro/indicador
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS vendedor_id uuid,
  ADD COLUMN IF NOT EXISTS origem_id uuid REFERENCES public.origens_lead(id),
  ADD COLUMN IF NOT EXISTS parceiro_id uuid;

-- 4) Itens avulsos no pedido (não negociáveis somam após desconto)
CREATE TABLE IF NOT EXISTS public.pedido_itens_avulsos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid,
  orcamento_id uuid,
  nome text NOT NULL,
  descricao text,
  valor_venda numeric NOT NULL DEFAULT 0,
  negociavel boolean NOT NULL DEFAULT true,
  ordem int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedido_itens_avulsos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pia_select ON public.pedido_itens_avulsos;
DROP POLICY IF EXISTS pia_insert ON public.pedido_itens_avulsos;
DROP POLICY IF EXISTS pia_update ON public.pedido_itens_avulsos;
DROP POLICY IF EXISTS pia_delete ON public.pedido_itens_avulsos;
CREATE POLICY pia_select ON public.pedido_itens_avulsos FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin')
  OR (pedido_id IS NOT NULL AND pode_acessar_loja(loja_de_pedido(pedido_id)))
  OR (orcamento_id IS NOT NULL AND pode_acessar_loja(loja_de_orcamento(orcamento_id)))
);
CREATE POLICY pia_insert ON public.pedido_itens_avulsos FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(),'admin')
  OR (pedido_id IS NOT NULL AND pode_acessar_loja(loja_de_pedido(pedido_id)))
  OR (orcamento_id IS NOT NULL AND pode_acessar_loja(loja_de_orcamento(orcamento_id)))
);
CREATE POLICY pia_update ON public.pedido_itens_avulsos FOR UPDATE TO authenticated USING (
  has_role(auth.uid(),'admin')
  OR (pedido_id IS NOT NULL AND pode_acessar_loja(loja_de_pedido(pedido_id)))
  OR (orcamento_id IS NOT NULL AND pode_acessar_loja(loja_de_orcamento(orcamento_id)))
);
CREATE POLICY pia_delete ON public.pedido_itens_avulsos FOR DELETE TO authenticated USING (
  has_role(auth.uid(),'admin')
  OR (pedido_id IS NOT NULL AND pode_acessar_loja(loja_de_pedido(pedido_id)))
  OR (orcamento_id IS NOT NULL AND pode_acessar_loja(loja_de_orcamento(orcamento_id)))
);

-- Item avulso em ambiente também (alternativa por ambiente)
ALTER TABLE public.ambientes
  ADD COLUMN IF NOT EXISTS negociavel boolean NOT NULL DEFAULT true;
