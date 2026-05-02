-- 1) Taxas e limites configuráveis em metodos_pagamento
ALTER TABLE public.metodos_pagamento
  ADD COLUMN IF NOT EXISTS taxa_perc_parcela numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_parcelas integer NOT NULL DEFAULT 12;

-- 2) Limite individual de desconto (sobrepõe o do cargo)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS desconto_max_perc numeric;

-- 3) Pagamentos com detalhe de parcelas (valores customizados)
ALTER TABLE public.pagamentos_orcamento
  ADD COLUMN IF NOT EXISTS parcelas_detalhe jsonb;

-- 4) Histórico de aprovações de desconto
CREATE TABLE IF NOT EXISTS public.aprovacoes_desconto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  solicitante_id uuid,
  aprovador_id uuid,
  aprovador_email text,
  desconto_perc numeric NOT NULL,
  desconto_valor numeric NOT NULL,
  limite_solicitante numeric,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aprovacoes_desconto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aprov_desc_select ON public.aprovacoes_desconto;
CREATE POLICY aprov_desc_select ON public.aprovacoes_desconto
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR pode_acessar_loja(loja_de_orcamento(orcamento_id)));

DROP POLICY IF EXISTS aprov_desc_insert ON public.aprovacoes_desconto;
CREATE POLICY aprov_desc_insert ON public.aprovacoes_desconto
  FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_orcamento(orcamento_id)));

DROP POLICY IF EXISTS aprov_desc_delete ON public.aprovacoes_desconto;
CREATE POLICY aprov_desc_delete ON public.aprovacoes_desconto
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_aprov_desc_orc ON public.aprovacoes_desconto(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_aprov_desc_ped ON public.aprovacoes_desconto(pedido_id);

-- 5) Atualizar trigger gerar_lancamentos_pedido p/ respeitar parcelas_detalhe
CREATE OR REPLACE FUNCTION public.gerar_lancamentos_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pag record;
  v_cat_id uuid;
  v_n int;
  v_valor_parcela numeric;
  v_data date;
  i int;
  v_det jsonb;
  v_valor_i numeric;
BEGIN
  IF NEW.orcamento_id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.lancamentos_financeiros WHERE pedido_id = NEW.id AND tipo = 'entrada') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_cat_id FROM public.categorias_financeiras
   WHERE tipo = 'entrada' AND nome ILIKE '%recebimento%contrato%' LIMIT 1;

  FOR v_pag IN
    SELECT * FROM public.pagamentos_orcamento WHERE orcamento_id = NEW.orcamento_id
  LOOP
    v_n := GREATEST(COALESCE(v_pag.parcelas, 1), 1);
    v_valor_parcela := ROUND((v_pag.valor / v_n)::numeric, 2);
    v_data := COALESCE(v_pag.data_vencimento, CURRENT_DATE);
    v_det := v_pag.parcelas_detalhe;

    FOR i IN 1..v_n LOOP
      IF v_det IS NOT NULL AND jsonb_typeof(v_det) = 'array' AND jsonb_array_length(v_det) >= i THEN
        v_valor_i := COALESCE((v_det->>(i-1))::numeric, v_valor_parcela);
      ELSIF i = v_n THEN
        v_valor_i := v_pag.valor - (v_valor_parcela * (v_n - 1));
      ELSE
        v_valor_i := v_valor_parcela;
      END IF;

      INSERT INTO public.lancamentos_financeiros (
        tipo, descricao, valor, data_vencimento, status,
        pedido_id, categoria_id, loja_id
      ) VALUES (
        'entrada',
        v_pag.metodo || ' - ' || NEW.codigo ||
          CASE WHEN v_n > 1 THEN ' (' || i || '/' || v_n || ')' ELSE '' END,
        v_valor_i,
        (v_data + ((i - 1) || ' months')::interval)::date,
        'pendente',
        NEW.id, v_cat_id, NEW.loja_id
      );
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$function$;