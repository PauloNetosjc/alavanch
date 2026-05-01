
-- 1) Pedidos: adicionar campos de cronograma e workflow
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS data_medicao_tecnica date,
  ADD COLUMN IF NOT EXISTS data_chegada_material date,
  ADD COLUMN IF NOT EXISTS data_limite_finalizacao date,
  ADD COLUMN IF NOT EXISTS workflow_estagio text DEFAULT 'aguardando',
  ADD COLUMN IF NOT EXISTS workflow_iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS observacoes_venda text,
  ADD COLUMN IF NOT EXISTS pedido_pai_id uuid,
  ADD COLUMN IF NOT EXISTS is_adendo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS critico boolean DEFAULT false;

-- 2) Chat interno do pedido
CREATE TABLE IF NOT EXISTS public.pedido_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  user_id uuid NOT NULL,
  mensagem text NOT NULL,
  mencionados uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedido_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY pedido_chat_select ON public.pedido_chat FOR SELECT TO authenticated USING (true);
CREATE POLICY pedido_chat_insert ON public.pedido_chat FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY pedido_chat_delete ON public.pedido_chat FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- 3) Pastas e Documentos do pedido
CREATE TABLE IF NOT EXISTS public.pedido_pastas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  nome text NOT NULL,
  ordem int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedido_pastas ENABLE ROW LEVEL SECURITY;
CREATE POLICY pedido_pastas_all ON public.pedido_pastas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.pedido_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  pasta_id uuid,
  nome text NOT NULL,
  storage_path text NOT NULL,
  tamanho bigint,
  mime_type text,
  enviado_para_assinatura boolean DEFAULT false,
  signing_token text,
  assinado_em timestamptz,
  assinatura_nome text,
  assinatura_cpf text,
  assinatura_data_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedido_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY pedido_docs_select ON public.pedido_documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY pedido_docs_insert ON public.pedido_documentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY pedido_docs_update ON public.pedido_documentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY pedido_docs_delete ON public.pedido_documentos FOR DELETE TO authenticated USING (true);
CREATE POLICY pedido_docs_select_anon_token ON public.pedido_documentos FOR SELECT TO anon USING (signing_token IS NOT NULL);
CREATE POLICY pedido_docs_update_anon_token ON public.pedido_documentos FOR UPDATE TO anon USING (signing_token IS NOT NULL AND assinado_em IS NULL);

-- 4) Revisões Promob (versionadas por ambiente)
CREATE TABLE IF NOT EXISTS public.pedido_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  ambiente_id uuid NOT NULL,
  versao int NOT NULL DEFAULT 1,
  raw_content text,
  parsed_data jsonb,
  diff jsonb,
  valor_original numeric DEFAULT 0,
  valor_revisado numeric DEFAULT 0,
  variacao_perc numeric DEFAULT 0,
  aprovada boolean DEFAULT false,
  aprovada_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedido_revisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pedido_revisoes_all ON public.pedido_revisoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5) Notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  link text,
  lida boolean DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_select_own ON public.notificacoes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_insert ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY notif_update_own ON public.notificacoes FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_delete_own ON public.notificacoes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 6) Pipeline produção: 4 kanbans
INSERT INTO public.pipeline_estagios (pipeline, nome, ordem, cor, ativo) VALUES
  ('medicao','Agendar',0,'#94a3b8',true),
  ('medicao','Em andamento',1,'#3b82f6',true),
  ('medicao','Concluído',2,'#10b981',true),
  ('fabrica','Aguardando envio',0,'#94a3b8',true),
  ('fabrica','Em produção',1,'#f59e0b',true),
  ('fabrica','Pronto',2,'#10b981',true),
  ('entrega','Agendar',0,'#94a3b8',true),
  ('entrega','Em rota',1,'#3b82f6',true),
  ('entrega','Entregue',2,'#10b981',true),
  ('montagem','Agendar',0,'#94a3b8',true),
  ('montagem','Em andamento',1,'#3b82f6',true),
  ('montagem','Concluída',2,'#10b981',true)
ON CONFLICT DO NOTHING;

-- 7) Bucket storage para documentos do pedido
INSERT INTO storage.buckets (id, name, public) VALUES ('pedido-docs','pedido-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "pedido_docs_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pedido-docs');
CREATE POLICY "pedido_docs_write_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pedido-docs');
CREATE POLICY "pedido_docs_update_auth" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pedido-docs');
CREATE POLICY "pedido_docs_delete_auth" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pedido-docs');
CREATE POLICY "pedido_docs_read_anon_signing" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'pedido-docs');

-- 8) Trigger para criar Pedido automaticamente quando orçamento for confirmado
CREATE OR REPLACE FUNCTION public.criar_pedido_ao_confirmar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_codigo text;
  v_seq int;
  v_pedido_id uuid;
BEGIN
  IF NEW.status = 'confirmado' AND (OLD.status IS DISTINCT FROM 'confirmado') THEN
    IF EXISTS (SELECT 1 FROM public.pedidos WHERE orcamento_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    SELECT COALESCE(MAX(CAST(split_part(split_part(codigo,'#',2),'/',1) AS int)),0)+1
      INTO v_seq FROM public.pedidos
      WHERE codigo LIKE 'VENDA #%/' || EXTRACT(YEAR FROM now())::text;
    v_codigo := 'VENDA #' || lpad(v_seq::text,3,'0') || '/' || EXTRACT(YEAR FROM now())::text;
    INSERT INTO public.pedidos (codigo, orcamento_id, cliente_id, loja_id, valor_total, status)
      VALUES (v_codigo, NEW.id, NEW.cliente_id, NEW.loja_id, NEW.total, 'em_producao')
      RETURNING id INTO v_pedido_id;
    INSERT INTO public.pedido_pastas (pedido_id, nome, ordem) VALUES
      (v_pedido_id,'Projetos/PDF',0),
      (v_pedido_id,'Check-in Obra',1),
      (v_pedido_id,'Fotos/Entrega',2);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_criar_pedido_ao_confirmar ON public.orcamentos;
CREATE TRIGGER trg_criar_pedido_ao_confirmar
  AFTER UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.criar_pedido_ao_confirmar();

-- Index úteis
CREATE INDEX IF NOT EXISTS idx_pedido_chat_pedido ON public.pedido_chat(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_docs_pedido ON public.pedido_documentos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_revisoes_pedido ON public.pedido_revisoes(pedido_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON public.notificacoes(user_id, lida);
