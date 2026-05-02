-- =========================================================
-- 1) TIMELINE AUDITÁVEL DE LANÇAMENTOS FINANCEIROS
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_lancamento_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_changes jsonb := '{}'::jsonb;
  v_desc text;
BEGIN
  BEGIN v_uid := auth.uid(); EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
    VALUES ('lancamento_financeiro', NEW.id, 'criado',
            'Lançamento criado: ' || COALESCE(NEW.descricao,'(sem descrição)') || ' R$ ' || NEW.valor::text,
            v_uid,
            jsonb_build_object('tipo', NEW.tipo, 'valor', NEW.valor, 'status', NEW.status,
                               'categoria_id', NEW.categoria_id, 'conta_id', NEW.conta_id,
                               'pedido_id', NEW.pedido_id));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('de', OLD.status, 'para', NEW.status));
    END IF;
    IF OLD.valor IS DISTINCT FROM NEW.valor THEN
      v_changes := v_changes || jsonb_build_object('valor', jsonb_build_object('de', OLD.valor, 'para', NEW.valor));
    END IF;
    IF OLD.categoria_id IS DISTINCT FROM NEW.categoria_id THEN
      v_changes := v_changes || jsonb_build_object('categoria_id', jsonb_build_object('de', OLD.categoria_id, 'para', NEW.categoria_id));
    END IF;
    IF OLD.conta_id IS DISTINCT FROM NEW.conta_id THEN
      v_changes := v_changes || jsonb_build_object('conta_id', jsonb_build_object('de', OLD.conta_id, 'para', NEW.conta_id));
    END IF;
    IF OLD.conciliado IS DISTINCT FROM NEW.conciliado THEN
      v_changes := v_changes || jsonb_build_object('conciliado', jsonb_build_object('de', OLD.conciliado, 'para', NEW.conciliado));
    END IF;
    IF OLD.data_pagamento IS DISTINCT FROM NEW.data_pagamento THEN
      v_changes := v_changes || jsonb_build_object('data_pagamento', jsonb_build_object('de', OLD.data_pagamento, 'para', NEW.data_pagamento));
    END IF;

    IF v_changes <> '{}'::jsonb THEN
      v_desc := 'Lançamento alterado';
      IF v_changes ? 'status' THEN
        v_desc := 'Status: ' || COALESCE(OLD.status,'—') || ' → ' || COALESCE(NEW.status,'—');
      ELSIF v_changes ? 'conciliado' AND NEW.conciliado = true THEN
        v_desc := 'Lançamento conciliado';
      ELSIF v_changes ? 'valor' THEN
        v_desc := 'Valor: R$ ' || OLD.valor::text || ' → R$ ' || NEW.valor::text;
      END IF;

      INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
      VALUES ('lancamento_financeiro', NEW.id, 'alterado', v_desc, v_uid, v_changes);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.timeline_eventos(entidade_tipo, entidade_id, tipo, descricao, usuario_id, metadata)
    VALUES ('lancamento_financeiro', OLD.id, 'removido',
            'Lançamento removido: ' || COALESCE(OLD.descricao,'(sem descrição)'),
            v_uid,
            jsonb_build_object('valor', OLD.valor, 'tipo', OLD.tipo, 'status', OLD.status));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_lancamento_financeiro ON public.lancamentos_financeiros;
CREATE TRIGGER trg_log_lancamento_financeiro
AFTER INSERT OR UPDATE OR DELETE ON public.lancamentos_financeiros
FOR EACH ROW EXECUTE FUNCTION public.log_lancamento_financeiro();

-- =========================================================
-- 2) CONCILIAÇÃO SUGERIDA — colunas de suporte
-- =========================================================
ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS conciliado_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS conciliado_por uuid,
  ADD COLUMN IF NOT EXISTS comprovante_storage_path text,
  ADD COLUMN IF NOT EXISTS adendo_pedido_id uuid;

CREATE INDEX IF NOT EXISTS idx_lanc_pedido ON public.lancamentos_financeiros(pedido_id);
CREATE INDEX IF NOT EXISTS idx_lanc_conta_data ON public.lancamentos_financeiros(conta_id, data_vencimento);

-- =========================================================
-- 3) AUTO-VÍNCULO FINANCEIRO ↔ PEDIDO (gera lançamentos a receber ao criar pedido)
-- =========================================================
CREATE OR REPLACE FUNCTION public.gerar_lancamentos_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pag record;
  v_cat_id uuid;
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
    INSERT INTO public.lancamentos_financeiros (
      tipo, descricao, valor, data_vencimento, status,
      pedido_id, categoria_id, loja_id
    ) VALUES (
      'entrada',
      v_pag.metodo || ' - ' || NEW.codigo,
      v_pag.valor,
      COALESCE(v_pag.data_vencimento, CURRENT_DATE),
      'pendente',
      NEW.id, v_cat_id, NEW.loja_id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gerar_lancamentos_pedido ON public.pedidos;
CREATE TRIGGER trg_gerar_lancamentos_pedido
AFTER INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.gerar_lancamentos_pedido();

-- =========================================================
-- 4) NOTAS FISCAIS (NF-e / NFS-e) + CERTIFICADO DIGITAL
-- =========================================================
CREATE TABLE IF NOT EXISTS public.certificados_digitais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid,
  nome text NOT NULL,
  storage_path text NOT NULL,
  senha_encrypted text,
  validade_inicio date,
  validade_fim date,
  status text NOT NULL DEFAULT 'ativo',
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.certificados_digitais ENABLE ROW LEVEL SECURITY;
CREATE POLICY cert_select ON public.certificados_digitais FOR SELECT TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(),'admin'));
CREATE POLICY cert_insert ON public.certificados_digitais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY cert_update ON public.certificados_digitais FOR UPDATE TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(),'admin'));
CREATE POLICY cert_delete ON public.certificados_digitais FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid,
  pedido_id uuid,
  cliente_id uuid,
  tipo text NOT NULL DEFAULT 'nfe',          -- nfe | nfse
  numero text,
  serie text,
  chave text,
  status text NOT NULL DEFAULT 'rascunho',   -- rascunho | autorizada | rejeitada | cancelada | erro
  natureza_operacao text,
  valor_total numeric NOT NULL DEFAULT 0,
  valor_produtos numeric DEFAULT 0,
  valor_servicos numeric DEFAULT 0,
  data_emissao timestamptz,
  protocolo text,
  motivo_rejeicao text,
  xml_storage_path text,
  pdf_storage_path text,
  provider text DEFAULT 'focus_nfe',
  provider_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY nf_select ON public.notas_fiscais FOR SELECT TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(),'admin')
         OR has_permission(auth.uid(),'diretoria','view'));
CREATE POLICY nf_insert ON public.notas_fiscais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY nf_update ON public.notas_fiscais FOR UPDATE TO authenticated
  USING (loja_id IS NULL OR loja_id = current_loja_id() OR has_role(auth.uid(),'admin'));
CREATE POLICY nf_delete ON public.notas_fiscais FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_nf_loja ON public.notas_fiscais(loja_id);
CREATE INDEX IF NOT EXISTS idx_nf_pedido ON public.notas_fiscais(pedido_id);
CREATE INDEX IF NOT EXISTS idx_nf_status ON public.notas_fiscais(status);

-- Bucket privado para certificados (.pfx) e XMLs
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificados-digitais','certificados-digitais', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-fiscais','notas-fiscais', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "cert_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'certificados-digitais');
CREATE POLICY "cert_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificados-digitais');
CREATE POLICY "cert_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'certificados-digitais' AND has_role(auth.uid(),'admin'));

CREATE POLICY "nf_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'notas-fiscais');
CREATE POLICY "nf_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notas-fiscais');
CREATE POLICY "nf_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'notas-fiscais' AND has_role(auth.uid(),'admin'));
