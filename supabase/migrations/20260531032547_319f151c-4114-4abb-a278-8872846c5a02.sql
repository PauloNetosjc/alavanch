-- FASE 6 FÁBRICA: Importação Técnica

CREATE TABLE public.fabrica_importacoes_tecnicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NULL REFERENCES public.pedidos(id) ON DELETE SET NULL,
  lote_id UUID NULL,
  loja_id UUID NULL REFERENCES public.lojas(id) ON DELETE SET NULL,
  cliente_nome TEXT NULL,
  projeto_nome TEXT NULL,
  ambiente TEXT NULL,
  tipo_importacao TEXT NOT NULL DEFAULT 'individual' CHECK (tipo_importacao IN ('individual','lote_multi_cliente')),
  arquivo_original_nome TEXT NULL,
  arquivo_original_url TEXT NULL,
  status_importacao TEXT NOT NULL DEFAULT 'recebido' CHECK (status_importacao IN ('recebido','processando','processado','processado_com_alertas','erro')),
  mensagem_processamento TEXT NULL,
  total_arquivos INTEGER NOT NULL DEFAULT 0,
  total_chapas INTEGER NOT NULL DEFAULT 0,
  total_pecas INTEGER NOT NULL DEFAULT 0,
  total_etiquetas INTEGER NOT NULL DEFAULT 0,
  total_arquivos_tecnicos INTEGER NOT NULL DEFAULT 0,
  data_importacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_importacao UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_importacoes_tecnicas TO authenticated;
GRANT ALL ON public.fabrica_importacoes_tecnicas TO service_role;
ALTER TABLE public.fabrica_importacoes_tecnicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fab_imp_tec_sel" ON public.fabrica_importacoes_tecnicas FOR SELECT TO authenticated USING (true);
CREATE POLICY "fab_imp_tec_ins" ON public.fabrica_importacoes_tecnicas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fab_imp_tec_upd" ON public.fabrica_importacoes_tecnicas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fab_imp_tec_del" ON public.fabrica_importacoes_tecnicas FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_fab_imp_tec_pedido ON public.fabrica_importacoes_tecnicas(pedido_id);
CREATE INDEX idx_fab_imp_tec_lote ON public.fabrica_importacoes_tecnicas(lote_id);
CREATE INDEX idx_fab_imp_tec_loja ON public.fabrica_importacoes_tecnicas(loja_id);

CREATE TABLE public.fabrica_chapas_lote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID NOT NULL REFERENCES public.fabrica_importacoes_tecnicas(id) ON DELETE CASCADE,
  pedido_id UUID NULL REFERENCES public.pedidos(id) ON DELETE SET NULL,
  lote_id UUID NULL,
  loja_id UUID NULL REFERENCES public.lojas(id) ON DELETE SET NULL,
  numero_chapa TEXT NULL,
  ordem_chapa INTEGER NULL,
  material TEXT NULL,
  cor_linha TEXT NULL,
  espessura NUMERIC NULL,
  largura_chapa NUMERIC NOT NULL DEFAULT 2750,
  altura_chapa NUMERIC NOT NULL DEFAULT 1850,
  arquivo_nc_id UUID NULL,
  arquivo_cyc_id UUID NULL,
  preview_large_id UUID NULL,
  preview_small_id UUID NULL,
  aproveitamento NUMERIC NULL,
  status_chapa TEXT NOT NULL DEFAULT 'aguardando_corte' CHECK (status_chapa IN ('aguardando_corte','em_corte','cortada','conferida','cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_chapas_lote TO authenticated;
GRANT ALL ON public.fabrica_chapas_lote TO service_role;
ALTER TABLE public.fabrica_chapas_lote ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fab_chapas_sel" ON public.fabrica_chapas_lote FOR SELECT TO authenticated USING (true);
CREATE POLICY "fab_chapas_ins" ON public.fabrica_chapas_lote FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fab_chapas_upd" ON public.fabrica_chapas_lote FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fab_chapas_del" ON public.fabrica_chapas_lote FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_fab_chapas_imp ON public.fabrica_chapas_lote(importacao_id);
CREATE INDEX idx_fab_chapas_pedido ON public.fabrica_chapas_lote(pedido_id);

CREATE TABLE public.fabrica_arquivos_tecnicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID NOT NULL REFERENCES public.fabrica_importacoes_tecnicas(id) ON DELETE CASCADE,
  pedido_id UUID NULL REFERENCES public.pedidos(id) ON DELETE SET NULL,
  lote_id UUID NULL,
  loja_id UUID NULL REFERENCES public.lojas(id) ON DELETE SET NULL,
  chapa_id UUID NULL REFERENCES public.fabrica_chapas_lote(id) ON DELETE SET NULL,
  peca_id UUID NULL,
  origem_pasta TEXT NOT NULL DEFAULT 'outro' CHECK (origem_pasta IN ('AutoLabel','NC','Parts','Profile','xml','raiz','outro')),
  tipo_arquivo TEXT NOT NULL DEFAULT 'outro',
  nome_arquivo TEXT NOT NULL,
  extensao TEXT NULL,
  caminho_relativo TEXT NULL,
  url_arquivo TEXT NULL,
  mime_type TEXT NULL,
  tamanho_bytes BIGINT NULL,
  dados_extraidos JSONB NULL,
  processado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por UUID NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_arquivos_tecnicos TO authenticated;
GRANT ALL ON public.fabrica_arquivos_tecnicos TO service_role;
ALTER TABLE public.fabrica_arquivos_tecnicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fab_arqtec_sel" ON public.fabrica_arquivos_tecnicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "fab_arqtec_ins" ON public.fabrica_arquivos_tecnicos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fab_arqtec_upd" ON public.fabrica_arquivos_tecnicos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fab_arqtec_del" ON public.fabrica_arquivos_tecnicos FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_fab_arqtec_imp ON public.fabrica_arquivos_tecnicos(importacao_id);
CREATE INDEX idx_fab_arqtec_pedido ON public.fabrica_arquivos_tecnicos(pedido_id);
CREATE INDEX idx_fab_arqtec_chapa ON public.fabrica_arquivos_tecnicos(chapa_id);
CREATE INDEX idx_fab_arqtec_tipo ON public.fabrica_arquivos_tecnicos(tipo_arquivo);

CREATE TABLE public.fabrica_etiquetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID NOT NULL REFERENCES public.fabrica_importacoes_tecnicas(id) ON DELETE CASCADE,
  pedido_id UUID NULL REFERENCES public.pedidos(id) ON DELETE SET NULL,
  lote_id UUID NULL,
  loja_id UUID NULL REFERENCES public.lojas(id) ON DELETE SET NULL,
  peca_id UUID NULL,
  chapa_id UUID NULL REFERENCES public.fabrica_chapas_lote(id) ON DELETE SET NULL,
  codigo_etiqueta_completo TEXT NOT NULL,
  referencia_peca TEXT NULL,
  codigo_peca TEXT NULL,
  sufixo TEXT NULL,
  indice_duplicidade INTEGER NULL,
  arquivo_etiqueta_id UUID NULL REFERENCES public.fabrica_arquivos_tecnicos(id) ON DELETE SET NULL,
  arquivo_bmp_id UUID NULL REFERENCES public.fabrica_arquivos_tecnicos(id) ON DELETE SET NULL,
  arquivo_pdf_id UUID NULL REFERENCES public.fabrica_arquivos_tecnicos(id) ON DELETE SET NULL,
  codigo_barras TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_etiquetas TO authenticated;
GRANT ALL ON public.fabrica_etiquetas TO service_role;
ALTER TABLE public.fabrica_etiquetas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fab_etiq_sel" ON public.fabrica_etiquetas FOR SELECT TO authenticated USING (true);
CREATE POLICY "fab_etiq_ins" ON public.fabrica_etiquetas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fab_etiq_upd" ON public.fabrica_etiquetas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fab_etiq_del" ON public.fabrica_etiquetas FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_fab_etiq_imp ON public.fabrica_etiquetas(importacao_id);
CREATE INDEX idx_fab_etiq_pedido ON public.fabrica_etiquetas(pedido_id);
CREATE INDEX idx_fab_etiq_codigo ON public.fabrica_etiquetas(codigo_etiqueta_completo);

CREATE TABLE public.fabrica_peca_operacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID NOT NULL REFERENCES public.fabrica_importacoes_tecnicas(id) ON DELETE CASCADE,
  pedido_id UUID NULL REFERENCES public.pedidos(id) ON DELETE SET NULL,
  lote_id UUID NULL,
  loja_id UUID NULL REFERENCES public.lojas(id) ON DELETE SET NULL,
  peca_id UUID NULL,
  tipo_operacao TEXT NOT NULL,
  posicao_x NUMERIC NULL,
  posicao_y NUMERIC NULL,
  posicao_z NUMERIC NULL,
  diametro NUMERIC NULL,
  profundidade NUMERIC NULL,
  face TEXT NULL,
  dados_brutos TEXT NULL,
  origem_pasta TEXT NULL,
  arquivo_tecnico_id UUID NULL REFERENCES public.fabrica_arquivos_tecnicos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_peca_operacoes TO authenticated;
GRANT ALL ON public.fabrica_peca_operacoes TO service_role;
ALTER TABLE public.fabrica_peca_operacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fab_pop_sel" ON public.fabrica_peca_operacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "fab_pop_ins" ON public.fabrica_peca_operacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fab_pop_upd" ON public.fabrica_peca_operacoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fab_pop_del" ON public.fabrica_peca_operacoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_fab_pop_imp ON public.fabrica_peca_operacoes(importacao_id);

CREATE TRIGGER trg_fab_imp_tec_upd BEFORE UPDATE ON public.fabrica_importacoes_tecnicas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fab_chapas_upd BEFORE UPDATE ON public.fabrica_chapas_lote FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fab_arqtec_upd BEFORE UPDATE ON public.fabrica_arquivos_tecnicos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fab_etiq_upd BEFORE UPDATE ON public.fabrica_etiquetas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('fabrica-pacotes-tecnicos','fabrica-pacotes-tecnicos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fab_pkg_tec_sel" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'fabrica-pacotes-tecnicos');
CREATE POLICY "fab_pkg_tec_ins" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fabrica-pacotes-tecnicos');
CREATE POLICY "fab_pkg_tec_upd" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'fabrica-pacotes-tecnicos');
CREATE POLICY "fab_pkg_tec_del" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'fabrica-pacotes-tecnicos' AND public.has_role(auth.uid(),'admin'));

INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo)
VALUES ('fabrica_importacao_tecnica','acessar','Fábrica - Importação técnica Promob/Nesting/Cut Pro','Fábrica')
ON CONFLICT (modulo, acao) DO NOTHING;
