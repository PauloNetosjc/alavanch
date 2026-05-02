-- 1. CONTAS BANCARIAS - estender
ALTER TABLE public.contas_bancarias
  ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'corrente',
  ADD COLUMN IF NOT EXISTS cor text DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS loja_id uuid;

-- 2. CARTOES DE CREDITO
CREATE TABLE IF NOT EXISTS public.cartoes_credito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ultimos_digitos text,
  bandeira text,
  dia_fechamento int,
  dia_vencimento int,
  conta_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  loja_id uuid,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cartoes_credito ENABLE ROW LEVEL SECURITY;
CREATE POLICY cartoes_credito_select ON public.cartoes_credito FOR SELECT TO authenticated
  USING ((loja_id IS NULL) OR (loja_id = current_loja_id()) OR has_role(auth.uid(),'admin'));
CREATE POLICY cartoes_credito_insert ON public.cartoes_credito FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY cartoes_credito_update ON public.cartoes_credito FOR UPDATE TO authenticated USING (true);
CREATE POLICY cartoes_credito_delete ON public.cartoes_credito FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- 3. PARCEIROS - estender
ALTER TABLE public.parceiros
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'indicador',
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- 4. PARCEIRO COMISSOES (RT)
CREATE TABLE IF NOT EXISTS public.parceiro_comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  cliente_id uuid,
  contrato_numero text,
  valor_base numeric DEFAULT 0,
  percentual numeric DEFAULT 0,
  valor_calculado numeric NOT NULL DEFAULT 0,
  valor_corrigido numeric,
  status text NOT NULL DEFAULT 'a_auditar', -- a_auditar | aprovada | paga
  observacoes text,
  data_pagamento date,
  lancamento_id uuid REFERENCES public.lancamentos_financeiros(id) ON DELETE SET NULL,
  loja_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pc_parceiro ON public.parceiro_comissoes(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_pc_status ON public.parceiro_comissoes(status);
ALTER TABLE public.parceiro_comissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pc_select ON public.parceiro_comissoes FOR SELECT TO authenticated
  USING ((loja_id IS NULL) OR (loja_id = current_loja_id()) OR has_role(auth.uid(),'admin'));
CREATE POLICY pc_insert ON public.parceiro_comissoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY pc_update ON public.parceiro_comissoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY pc_delete ON public.parceiro_comissoes FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_pc_updated_at BEFORE UPDATE ON public.parceiro_comissoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. PARCEIRO COMPROVANTES
CREATE TABLE IF NOT EXISTS public.parceiro_comprovantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comissao_id uuid REFERENCES public.parceiro_comissoes(id) ON DELETE CASCADE,
  parceiro_id uuid REFERENCES public.parceiros(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nome text NOT NULL,
  mime_type text,
  tamanho bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parceiro_comprovantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcomp_select ON public.parceiro_comprovantes FOR SELECT TO authenticated USING (true);
CREATE POLICY pcomp_insert ON public.parceiro_comprovantes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY pcomp_update ON public.parceiro_comprovantes FOR UPDATE TO authenticated USING (true);
CREATE POLICY pcomp_delete ON public.parceiro_comprovantes FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- 6. PARCEIRO PEDIDOS (compras de fornecedor / adendos)
CREATE TABLE IF NOT EXISTS public.parceiro_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  origem text DEFAULT 'adendo', -- adendo | manual
  status text DEFAULT 'pendente',
  loja_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parceiro_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY pp_select ON public.parceiro_pedidos FOR SELECT TO authenticated
  USING ((loja_id IS NULL) OR (loja_id = current_loja_id()) OR has_role(auth.uid(),'admin'));
CREATE POLICY pp_insert ON public.parceiro_pedidos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY pp_update ON public.parceiro_pedidos FOR UPDATE TO authenticated USING (true);
CREATE POLICY pp_delete ON public.parceiro_pedidos FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- 7. TRIGGER: auto-criar comissão quando pedido é gerado a partir de orçamento com parceiro
CREATE OR REPLACE FUNCTION public.gerar_comissao_parceiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parceiro_id uuid;
  v_perc numeric;
  v_total numeric;
BEGIN
  IF NEW.orcamento_id IS NULL THEN RETURN NEW; END IF;
  SELECT parceiro_id, COALESCE(parceiro_perc,0), COALESCE(total,0)
    INTO v_parceiro_id, v_perc, v_total
  FROM public.orcamentos WHERE id = NEW.orcamento_id;

  IF v_parceiro_id IS NULL OR v_perc = 0 THEN RETURN NEW; END IF;

  -- evita duplicar
  IF EXISTS (SELECT 1 FROM public.parceiro_comissoes WHERE pedido_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.parceiro_comissoes (
    parceiro_id, pedido_id, orcamento_id, cliente_id, contrato_numero,
    valor_base, percentual, valor_calculado, status, loja_id
  ) VALUES (
    v_parceiro_id, NEW.id, NEW.orcamento_id, NEW.cliente_id, NEW.codigo,
    v_total, v_perc, ROUND((v_total * v_perc / 100)::numeric, 2), 'a_auditar', NEW.loja_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gerar_comissao_parceiro ON public.pedidos;
CREATE TRIGGER trg_gerar_comissao_parceiro
AFTER INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.gerar_comissao_parceiro();

-- 8. STORAGE bucket privado para comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('parceiro-comprovantes', 'parceiro-comprovantes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "parceiro_comp_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'parceiro-comprovantes');
CREATE POLICY "parceiro_comp_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'parceiro-comprovantes');
CREATE POLICY "parceiro_comp_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'parceiro-comprovantes');
CREATE POLICY "parceiro_comp_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'parceiro-comprovantes');