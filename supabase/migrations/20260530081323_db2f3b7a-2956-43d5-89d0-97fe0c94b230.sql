-- Status anterior no pedido (para retomar fluxo)
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS status_fabrica_anterior text;

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.fabrica_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text,
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  lote_id uuid,
  loja_id uuid,
  modulo_id uuid REFERENCES public.fabrica_modulos(id) ON DELETE SET NULL,
  peca_id uuid REFERENCES public.fabrica_pecas(id) ON DELETE SET NULL,
  almoxarifado_item_id uuid REFERENCES public.fabrica_almoxarifado_itens(id) ON DELETE SET NULL,
  volume_id uuid REFERENCES public.fabrica_volumes(id) ON DELETE SET NULL,
  tipo_ocorrencia text NOT NULL,
  setor_responsavel text NOT NULL DEFAULT 'fabrica',
  prioridade text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'aberta',
  titulo text NOT NULL,
  descricao text,
  quantidade_afetada numeric,
  aberto_por uuid,
  responsavel_id uuid,
  data_abertura timestamptz NOT NULL DEFAULT now(),
  data_previsao_resolucao timestamptz,
  data_resolucao timestamptz,
  solucao_descricao text,
  observacoes text,
  bloqueante boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

CREATE INDEX IF NOT EXISTS idx_fab_ocor_pedido ON public.fabrica_ocorrencias(pedido_id);
CREATE INDEX IF NOT EXISTS idx_fab_ocor_status ON public.fabrica_ocorrencias(status);
CREATE INDEX IF NOT EXISTS idx_fab_ocor_loja ON public.fabrica_ocorrencias(loja_id);
CREATE INDEX IF NOT EXISTS idx_fab_ocor_created ON public.fabrica_ocorrencias(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_ocorrencias TO authenticated;
GRANT ALL ON public.fabrica_ocorrencias TO service_role;

ALTER TABLE public.fabrica_ocorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fab_ocor_all" ON public.fabrica_ocorrencias;
CREATE POLICY "fab_ocor_all" ON public.fabrica_ocorrencias
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = fabrica_ocorrencias.pedido_id AND (p.loja_id IS NULL OR p.loja_id = current_loja_id()))
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = fabrica_ocorrencias.pedido_id AND (p.loja_id IS NULL OR p.loja_id = current_loja_id()))
  );

CREATE TRIGGER trg_fab_ocor_updated BEFORE UPDATE ON public.fabrica_ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequência de código OC-YYYY-NNNN via trigger
CREATE OR REPLACE FUNCTION public.fabrica_ocorrencia_gera_codigo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ano text;
  seq int;
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    ano := to_char(now(), 'YYYY');
    SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, '^OC-' || ano || '-', ''), '')::int), 0) + 1
      INTO seq FROM public.fabrica_ocorrencias WHERE codigo LIKE 'OC-' || ano || '-%';
    NEW.codigo := 'OC-' || ano || '-' || lpad(seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fab_ocor_codigo ON public.fabrica_ocorrencias;
CREATE TRIGGER trg_fab_ocor_codigo BEFORE INSERT ON public.fabrica_ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.fabrica_ocorrencia_gera_codigo();

-- Histórico
CREATE TABLE IF NOT EXISTS public.fabrica_ocorrencias_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid NOT NULL REFERENCES public.fabrica_ocorrencias(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL,
  descricao text,
  status_anterior text,
  status_novo text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid
);

CREATE INDEX IF NOT EXISTS idx_fab_ocor_hist_oc ON public.fabrica_ocorrencias_historico(ocorrencia_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_ocorrencias_historico TO authenticated;
GRANT ALL ON public.fabrica_ocorrencias_historico TO service_role;

ALTER TABLE public.fabrica_ocorrencias_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fab_ocor_hist_all" ON public.fabrica_ocorrencias_historico;
CREATE POLICY "fab_ocor_hist_all" ON public.fabrica_ocorrencias_historico
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.fabrica_ocorrencias o
      JOIN public.pedidos p ON p.id = o.pedido_id
      WHERE o.id = fabrica_ocorrencias_historico.ocorrencia_id
        AND (p.loja_id IS NULL OR p.loja_id = current_loja_id())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.fabrica_ocorrencias o
      JOIN public.pedidos p ON p.id = o.pedido_id
      WHERE o.id = fabrica_ocorrencias_historico.ocorrencia_id
        AND (p.loja_id IS NULL OR p.loja_id = current_loja_id())
    )
  );

-- Anexos
CREATE TABLE IF NOT EXISTS public.fabrica_ocorrencias_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid NOT NULL REFERENCES public.fabrica_ocorrencias(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  url_arquivo text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  criado_por uuid
);

CREATE INDEX IF NOT EXISTS idx_fab_ocor_anx_oc ON public.fabrica_ocorrencias_anexos(ocorrencia_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_ocorrencias_anexos TO authenticated;
GRANT ALL ON public.fabrica_ocorrencias_anexos TO service_role;

ALTER TABLE public.fabrica_ocorrencias_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fab_ocor_anx_all" ON public.fabrica_ocorrencias_anexos;
CREATE POLICY "fab_ocor_anx_all" ON public.fabrica_ocorrencias_anexos
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.fabrica_ocorrencias o
      JOIN public.pedidos p ON p.id = o.pedido_id
      WHERE o.id = fabrica_ocorrencias_anexos.ocorrencia_id
        AND (p.loja_id IS NULL OR p.loja_id = current_loja_id())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.fabrica_ocorrencias o
      JOIN public.pedidos p ON p.id = o.pedido_id
      WHERE o.id = fabrica_ocorrencias_anexos.ocorrencia_id
        AND (p.loja_id IS NULL OR p.loja_id = current_loja_id())
    )
  );

-- Bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('fabrica-ocorrencias', 'fabrica-ocorrencias', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "fab_ocor_storage_select" ON storage.objects;
CREATE POLICY "fab_ocor_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fabrica-ocorrencias');

DROP POLICY IF EXISTS "fab_ocor_storage_insert" ON storage.objects;
CREATE POLICY "fab_ocor_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fabrica-ocorrencias');

DROP POLICY IF EXISTS "fab_ocor_storage_delete" ON storage.objects;
CREATE POLICY "fab_ocor_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'fabrica-ocorrencias');

-- Permissão
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('fabrica_ocorrencias', 'view', 'Ver central de Ocorrências da Fábrica', 'Fábrica'),
  ('fabrica_ocorrencias', 'edit', 'Criar, atribuir, resolver e cancelar ocorrências', 'Fábrica')
ON CONFLICT (modulo, acao) DO UPDATE SET descricao = EXCLUDED.descricao, grupo = EXCLUDED.grupo;