
CREATE TABLE public.checagem_contratos_financeiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_assinatura(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  tipo_documento text NOT NULL,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  valor_total numeric NOT NULL DEFAULT 0,
  data_assinatura timestamptz,
  status text NOT NULL DEFAULT 'pendente',
  checado_por uuid REFERENCES auth.users(id),
  checado_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checagem_contratos_solic_unique UNIQUE (solicitacao_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checagem_contratos_financeiro TO authenticated;
GRANT ALL ON public.checagem_contratos_financeiro TO service_role;

ALTER TABLE public.checagem_contratos_financeiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccf_select" ON public.checagem_contratos_financeiro
  FOR SELECT TO authenticated
  USING (loja_id IS NULL OR pode_acessar_loja(loja_id));

CREATE POLICY "ccf_insert" ON public.checagem_contratos_financeiro
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ccf_update" ON public.checagem_contratos_financeiro
  FOR UPDATE TO authenticated
  USING (loja_id IS NULL OR pode_acessar_loja(loja_id));

CREATE POLICY "ccf_delete" ON public.checagem_contratos_financeiro
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ccf_updated
  BEFORE UPDATE ON public.checagem_contratos_financeiro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ccf_status ON public.checagem_contratos_financeiro(status);
CREATE INDEX idx_ccf_pedido ON public.checagem_contratos_financeiro(pedido_id);
CREATE INDEX idx_ccf_loja ON public.checagem_contratos_financeiro(loja_id);
CREATE INDEX idx_ccf_data ON public.checagem_contratos_financeiro(data_assinatura DESC);

CREATE OR REPLACE FUNCTION public.fn_criar_checagem_contrato_financeiro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_data timestamptz;
  v_valor numeric;
BEGIN
  IF NEW.status NOT IN ('concluido', 'assinado_manual') THEN
    RETURN NEW;
  END IF;

  SELECT slug INTO v_slug FROM public.tipos_documento WHERE id = NEW.tipo_documento_id;
  IF v_slug IS NULL OR v_slug NOT IN ('contrato', 'adendo', 'complemento') THEN
    RETURN NEW;
  END IF;

  v_data := COALESCE(NEW.concluido_em, NEW.assinado_manual_em, NEW.cliente_assinado_em, NEW.loja_assinado_em, now());
  SELECT COALESCE(valor_total, 0) INTO v_valor FROM public.pedidos WHERE id = NEW.pedido_id;

  INSERT INTO public.checagem_contratos_financeiro
    (solicitacao_id, pedido_id, contrato_id, tipo_documento, loja_id, cliente_id, valor_total, data_assinatura)
  VALUES
    (NEW.id, NEW.pedido_id, NEW.contrato_id, v_slug, NEW.loja_id, NEW.cliente_id, COALESCE(v_valor, 0), v_data)
  ON CONFLICT (solicitacao_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ccf_auto_criar
  AFTER INSERT OR UPDATE OF status ON public.solicitacoes_assinatura
  FOR EACH ROW EXECUTE FUNCTION public.fn_criar_checagem_contrato_financeiro();

INSERT INTO public.checagem_contratos_financeiro
  (solicitacao_id, pedido_id, contrato_id, tipo_documento, loja_id, cliente_id, valor_total, data_assinatura)
SELECT s.id, s.pedido_id, s.contrato_id, t.slug, s.loja_id, s.cliente_id,
       COALESCE(p.valor_total, 0),
       COALESCE(s.concluido_em, s.assinado_manual_em, s.cliente_assinado_em, s.loja_assinado_em)
FROM public.solicitacoes_assinatura s
JOIN public.tipos_documento t ON t.id = s.tipo_documento_id
LEFT JOIN public.pedidos p ON p.id = s.pedido_id
WHERE s.status IN ('concluido', 'assinado_manual')
  AND t.slug IN ('contrato', 'adendo', 'complemento')
ON CONFLICT (solicitacao_id) DO NOTHING;

INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo)
VALUES
  ('checagem_contratos', 'view', 'Visualizar checagem financeira de contratos', 'Financeiro'),
  ('checagem_contratos', 'confirm', 'Confirmar checagem financeira de contratos', 'Financeiro')
ON CONFLICT (modulo, acao) DO NOTHING;
