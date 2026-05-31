CREATE TABLE public.fabrica_plano_corte_pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID NOT NULL REFERENCES public.fabrica_importacoes_tecnicas(id) ON DELETE CASCADE,
  pedido_id UUID NULL REFERENCES public.pedidos(id) ON DELETE SET NULL,
  lote_id UUID NULL,
  loja_id UUID NULL REFERENCES public.lojas(id) ON DELETE SET NULL,
  chapa_id UUID NOT NULL REFERENCES public.fabrica_chapas_lote(id) ON DELETE CASCADE,
  peca_id UUID NULL,
  etiqueta_id UUID NULL REFERENCES public.fabrica_etiquetas(id) ON DELETE SET NULL,
  indice_peca INTEGER NULL,
  codigo_peca TEXT NULL,
  referencia_peca TEXT NULL,
  descricao TEXT NULL,
  largura NUMERIC NULL,
  altura NUMERIC NULL,
  espessura NUMERIC NULL,
  posicao_x NUMERIC NULL,
  posicao_y NUMERIC NULL,
  rotacao NUMERIC NULL DEFAULT 0,
  tipo_item TEXT NOT NULL DEFAULT 'desconhecido' CHECK (tipo_item IN ('peca_real','sobra','retalho','desconhecido')),
  material TEXT NULL,
  cor_linha TEXT NULL,
  modulo_pai TEXT NULL,
  ambiente TEXT NULL,
  status_item TEXT NOT NULL DEFAULT 'importado' CHECK (status_item IN ('importado','vinculado','divergente','ignorado')),
  dados_origem JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_plano_corte_pecas TO authenticated;
GRANT ALL ON public.fabrica_plano_corte_pecas TO service_role;

ALTER TABLE public.fabrica_plano_corte_pecas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fab_plano_sel" ON public.fabrica_plano_corte_pecas FOR SELECT TO authenticated USING (true);
CREATE POLICY "fab_plano_ins" ON public.fabrica_plano_corte_pecas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fab_plano_upd" ON public.fabrica_plano_corte_pecas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fab_plano_del" ON public.fabrica_plano_corte_pecas FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_fab_plano_imp ON public.fabrica_plano_corte_pecas(importacao_id);
CREATE INDEX idx_fab_plano_chapa ON public.fabrica_plano_corte_pecas(chapa_id);
CREATE INDEX idx_fab_plano_pedido ON public.fabrica_plano_corte_pecas(pedido_id);
CREATE INDEX idx_fab_plano_etiq ON public.fabrica_plano_corte_pecas(etiqueta_id);

INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao)
VALUES ('fabrica_plano_corte_vetorial', 'view', 'Visualizar dados vetoriais do plano de corte da Fábrica')
ON CONFLICT (modulo, acao) DO NOTHING;