-- 1) Adendo a pagar com pagamentos parcelados → contas a pagar (saída)
CREATE OR REPLACE FUNCTION public.criar_lancamentos_de_pagamentos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pag record; v_cat_id uuid; v_n int; v_valor_parcela numeric; v_data date;
  i int; v_det jsonb; v_valor_i numeric;
  v_tipo text; v_is_adendo_pagar boolean;
BEGIN
  IF NEW.orcamento_id IS NULL THEN RETURN NEW; END IF;
  v_is_adendo_pagar := COALESCE(NEW.is_adendo,false) AND COALESCE(NEW.adendo_tipo,'')='pagar';
  v_tipo := CASE WHEN v_is_adendo_pagar THEN 'saida' ELSE 'entrada' END;
  IF EXISTS (SELECT 1 FROM public.lancamentos_financeiros WHERE pedido_id = NEW.id AND tipo = v_tipo) THEN
    RETURN NEW;
  END IF;

  IF v_is_adendo_pagar THEN
    SELECT id INTO v_cat_id FROM public.categorias_financeiras WHERE tipo='saida' ORDER BY nome LIMIT 1;
  ELSE
    SELECT id INTO v_cat_id FROM public.categorias_financeiras
     WHERE tipo='entrada' AND nome ILIKE '%recebimento%contrato%' LIMIT 1;
  END IF;

  FOR v_pag IN SELECT * FROM public.pagamentos_orcamento WHERE orcamento_id = NEW.orcamento_id LOOP
    v_n := GREATEST(COALESCE(v_pag.parcelas, 1), 1);
    v_valor_parcela := ROUND((v_pag.valor / v_n)::numeric, 2);
    v_data := COALESCE(v_pag.data_vencimento, CURRENT_DATE);
    v_det := v_pag.parcelas_detalhe;
    FOR i IN 1..v_n LOOP
      IF v_det IS NOT NULL AND jsonb_typeof(v_det) = 'array' AND jsonb_array_length(v_det) >= i THEN
        v_valor_i := COALESCE((v_det->>(i-1))::numeric, v_valor_parcela);
      ELSIF i = v_n THEN
        v_valor_i := v_pag.valor - (v_valor_parcela * (v_n - 1));
      ELSE v_valor_i := v_valor_parcela; END IF;
      INSERT INTO public.lancamentos_financeiros (
        tipo, descricao, valor, data_vencimento, status, pedido_id, categoria_id, loja_id
      ) VALUES (
        v_tipo,
        v_pag.metodo || ' - ' || NEW.codigo || CASE WHEN v_n>1 THEN ' ('||i||'/'||v_n||')' ELSE '' END,
        v_valor_i,
        (v_data + ((i - 1) || ' months')::interval)::date,
        'pendente',
        NEW.id, v_cat_id, NEW.loja_id
      );
    END LOOP;
  END LOOP;
  RETURN NEW;
END $$;

-- 2) Adendo a receber sem pagamentos → contas a receber (entrada única)
CREATE OR REPLACE FUNCTION public.gerar_entrada_adendo_receber()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat_id uuid;
BEGIN
  IF NOT COALESCE(NEW.is_adendo,false) THEN RETURN NEW; END IF;
  IF COALESCE(NEW.adendo_tipo,'') <> 'receber' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.lancamentos_financeiros WHERE pedido_id = NEW.id) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.pagamentos_orcamento WHERE orcamento_id = NEW.orcamento_id) THEN RETURN NEW; END IF;

  SELECT id INTO v_cat_id FROM public.categorias_financeiras
   WHERE tipo='entrada' AND nome ILIKE '%recebimento%contrato%' LIMIT 1;

  INSERT INTO public.lancamentos_financeiros (
    tipo, descricao, valor, data_vencimento, status, pedido_id, categoria_id, loja_id
  ) VALUES (
    'entrada',
    'Adendo a receber - ' || NEW.codigo || COALESCE(' - ' || NEW.adendo_descricao, ''),
    COALESCE(NEW.valor_total,0), CURRENT_DATE, 'pendente',
    NEW.id, v_cat_id, NEW.loja_id
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gerar_entrada_adendo_receber ON public.pedidos;
CREATE TRIGGER trg_gerar_entrada_adendo_receber
AFTER INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.gerar_entrada_adendo_receber();

-- 3) Automações do Kanban CRM Comercial
CREATE TABLE IF NOT EXISTS public.crm_automacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estagio_origem_id uuid NOT NULL REFERENCES public.crm_estagios(id) ON DELETE CASCADE,
  estagio_destino_id uuid REFERENCES public.crm_estagios(id) ON DELETE SET NULL,
  evento text NOT NULL DEFAULT 'card_chegou',
  condicao_tipo text NOT NULL DEFAULT 'nenhuma',
  condicao_valor text,
  dias int,
  acao text NOT NULL DEFAULT 'mover',
  acao_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_automacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_aut_select ON public.crm_automacoes;
CREATE POLICY crm_aut_select ON public.crm_automacoes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS crm_aut_admin ON public.crm_automacoes;
CREATE POLICY crm_aut_admin ON public.crm_automacoes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

DROP TRIGGER IF EXISTS trg_crm_aut_updated_at ON public.crm_automacoes;
CREATE TRIGGER trg_crm_aut_updated_at BEFORE UPDATE ON public.crm_automacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_crm_aut_origem ON public.crm_automacoes(estagio_origem_id);
CREATE INDEX IF NOT EXISTS idx_crm_aut_evento ON public.crm_automacoes(evento);

-- 4) Suporte ao evento "após X dias" também no pipeline operacional
ALTER TABLE public.pipeline_automacoes ADD COLUMN IF NOT EXISTS dias int;