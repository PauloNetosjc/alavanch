
-- =========================================================
-- LOTE 0.1 — Segurança, RLS e integridade
-- =========================================================

-- 1) Funções helper para acesso por loja em tabelas filhas
CREATE OR REPLACE FUNCTION public.loja_de_orcamento(_orcamento_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT loja_id FROM public.orcamentos WHERE id = _orcamento_id
$$;

CREATE OR REPLACE FUNCTION public.loja_de_pedido(_pedido_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT loja_id FROM public.pedidos WHERE id = _pedido_id
$$;

CREATE OR REPLACE FUNCTION public.loja_de_assistencia(_assistencia_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT loja_id FROM public.assistencias WHERE id = _assistencia_id
$$;

CREATE OR REPLACE FUNCTION public.loja_de_comissao(_comissao_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT loja_id FROM public.parceiro_comissoes WHERE id = _comissao_id
$$;

CREATE OR REPLACE FUNCTION public.loja_de_parceiro(_parceiro_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT loja_id FROM public.parceiros WHERE id = _parceiro_id
$$;

CREATE OR REPLACE FUNCTION public.loja_de_ambiente(_ambiente_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.loja_id
  FROM public.ambientes a
  JOIN public.orcamentos o ON o.id = a.orcamento_id
  WHERE a.id = _ambiente_id
$$;

-- Helper unificado: pode acessar uma loja?
CREATE OR REPLACE FUNCTION public.pode_acessar_loja(_loja_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _loja_id IS NULL
      OR has_role(auth.uid(), 'admin')
      OR _loja_id = current_loja_id()
$$;

-- =========================================================
-- 2) RLS endurecida — recria policies abertas
-- =========================================================

-- AMBIENTES (via orcamentos)
DROP POLICY IF EXISTS ambientes_select ON public.ambientes;
DROP POLICY IF EXISTS ambientes_insert ON public.ambientes;
DROP POLICY IF EXISTS ambientes_update ON public.ambientes;
DROP POLICY IF EXISTS ambientes_delete ON public.ambientes;
CREATE POLICY ambientes_select ON public.ambientes FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_orcamento(orcamento_id)));
CREATE POLICY ambientes_insert ON public.ambientes FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_orcamento(orcamento_id)));
CREATE POLICY ambientes_update ON public.ambientes FOR UPDATE TO authenticated
  USING (pode_acessar_loja(loja_de_orcamento(orcamento_id)));
CREATE POLICY ambientes_delete ON public.ambientes FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR pode_acessar_loja(loja_de_orcamento(orcamento_id)));

-- SUB_ITENS_AMBIENTE (via ambientes->orcamentos)
DROP POLICY IF EXISTS sub_itens_ambiente_select ON public.sub_itens_ambiente;
DROP POLICY IF EXISTS sub_itens_ambiente_insert ON public.sub_itens_ambiente;
DROP POLICY IF EXISTS sub_itens_ambiente_update ON public.sub_itens_ambiente;
DROP POLICY IF EXISTS sub_itens_ambiente_delete ON public.sub_itens_ambiente;
CREATE POLICY sub_itens_ambiente_select ON public.sub_itens_ambiente FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_ambiente(ambiente_id)));
CREATE POLICY sub_itens_ambiente_insert ON public.sub_itens_ambiente FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_ambiente(ambiente_id)));
CREATE POLICY sub_itens_ambiente_update ON public.sub_itens_ambiente FOR UPDATE TO authenticated
  USING (pode_acessar_loja(loja_de_ambiente(ambiente_id)));
CREATE POLICY sub_itens_ambiente_delete ON public.sub_itens_ambiente FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR pode_acessar_loja(loja_de_ambiente(ambiente_id)));

-- PAGAMENTOS_ORCAMENTO
DROP POLICY IF EXISTS pagamentos_orcamento_select ON public.pagamentos_orcamento;
DROP POLICY IF EXISTS pagamentos_orcamento_insert ON public.pagamentos_orcamento;
DROP POLICY IF EXISTS pagamentos_orcamento_update ON public.pagamentos_orcamento;
DROP POLICY IF EXISTS pagamentos_orcamento_delete ON public.pagamentos_orcamento;
CREATE POLICY pagamentos_orcamento_select ON public.pagamentos_orcamento FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_orcamento(orcamento_id)));
CREATE POLICY pagamentos_orcamento_insert ON public.pagamentos_orcamento FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_orcamento(orcamento_id)));
CREATE POLICY pagamentos_orcamento_update ON public.pagamentos_orcamento FOR UPDATE TO authenticated
  USING (pode_acessar_loja(loja_de_orcamento(orcamento_id)));
CREATE POLICY pagamentos_orcamento_delete ON public.pagamentos_orcamento FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR pode_acessar_loja(loja_de_orcamento(orcamento_id)));

-- PEDIDO_PASTAS
DROP POLICY IF EXISTS pedido_pastas_all ON public.pedido_pastas;
CREATE POLICY pedido_pastas_select ON public.pedido_pastas FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_pedido(pedido_id)));
CREATE POLICY pedido_pastas_insert ON public.pedido_pastas FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_pedido(pedido_id)));
CREATE POLICY pedido_pastas_update ON public.pedido_pastas FOR UPDATE TO authenticated
  USING (pode_acessar_loja(loja_de_pedido(pedido_id)));
CREATE POLICY pedido_pastas_delete ON public.pedido_pastas FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR pode_acessar_loja(loja_de_pedido(pedido_id)));

-- PEDIDO_DOCUMENTOS (preserva acesso anônimo via signing_token)
DROP POLICY IF EXISTS pedido_docs_select ON public.pedido_documentos;
DROP POLICY IF EXISTS pedido_docs_insert ON public.pedido_documentos;
DROP POLICY IF EXISTS pedido_docs_update ON public.pedido_documentos;
DROP POLICY IF EXISTS pedido_docs_delete ON public.pedido_documentos;
CREATE POLICY pedido_docs_select ON public.pedido_documentos FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_pedido(pedido_id)));
CREATE POLICY pedido_docs_insert ON public.pedido_documentos FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_pedido(pedido_id)));
CREATE POLICY pedido_docs_update ON public.pedido_documentos FOR UPDATE TO authenticated
  USING (pode_acessar_loja(loja_de_pedido(pedido_id)));
CREATE POLICY pedido_docs_delete ON public.pedido_documentos FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR pode_acessar_loja(loja_de_pedido(pedido_id)));

-- PEDIDO_CHAT
DROP POLICY IF EXISTS pedido_chat_select ON public.pedido_chat;
DROP POLICY IF EXISTS pedido_chat_insert ON public.pedido_chat;
DROP POLICY IF EXISTS pedido_chat_delete ON public.pedido_chat;
CREATE POLICY pedido_chat_select ON public.pedido_chat FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_pedido(pedido_id)));
CREATE POLICY pedido_chat_insert ON public.pedido_chat FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND pode_acessar_loja(loja_de_pedido(pedido_id)));
CREATE POLICY pedido_chat_delete ON public.pedido_chat FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR auth.uid() = user_id);

-- PEDIDO_REVISOES
DROP POLICY IF EXISTS pedido_revisoes_all ON public.pedido_revisoes;
CREATE POLICY pedido_revisoes_select ON public.pedido_revisoes FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_pedido(pedido_id)));
CREATE POLICY pedido_revisoes_insert ON public.pedido_revisoes FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_pedido(pedido_id)));
CREATE POLICY pedido_revisoes_update ON public.pedido_revisoes FOR UPDATE TO authenticated
  USING (pode_acessar_loja(loja_de_pedido(pedido_id)));
CREATE POLICY pedido_revisoes_delete ON public.pedido_revisoes FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR pode_acessar_loja(loja_de_pedido(pedido_id)));

-- ASSISTENCIA_CHECKLIST
DROP POLICY IF EXISTS ac_select ON public.assistencia_checklist;
DROP POLICY IF EXISTS ac_insert ON public.assistencia_checklist;
DROP POLICY IF EXISTS ac_update ON public.assistencia_checklist;
DROP POLICY IF EXISTS ac_delete ON public.assistencia_checklist;
CREATE POLICY ac_select ON public.assistencia_checklist FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY ac_insert ON public.assistencia_checklist FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY ac_update ON public.assistencia_checklist FOR UPDATE TO authenticated
  USING (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY ac_delete ON public.assistencia_checklist FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR pode_acessar_loja(loja_de_assistencia(assistencia_id)));

-- MATERIAIS_ASSISTENCIA
DROP POLICY IF EXISTS materiais_assistencia_select ON public.materiais_assistencia;
DROP POLICY IF EXISTS materiais_assistencia_insert ON public.materiais_assistencia;
DROP POLICY IF EXISTS materiais_assistencia_update ON public.materiais_assistencia;
DROP POLICY IF EXISTS materiais_assistencia_delete ON public.materiais_assistencia;
CREATE POLICY materiais_assistencia_select ON public.materiais_assistencia FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY materiais_assistencia_insert ON public.materiais_assistencia FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY materiais_assistencia_update ON public.materiais_assistencia FOR UPDATE TO authenticated
  USING (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY materiais_assistencia_delete ON public.materiais_assistencia FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR pode_acessar_loja(loja_de_assistencia(assistencia_id)));

-- ANEXOS_ASSISTENCIA
DROP POLICY IF EXISTS anx_select ON public.anexos_assistencia;
DROP POLICY IF EXISTS anx_insert ON public.anexos_assistencia;
DROP POLICY IF EXISTS anx_update ON public.anexos_assistencia;
DROP POLICY IF EXISTS anx_delete ON public.anexos_assistencia;
CREATE POLICY anx_select ON public.anexos_assistencia FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY anx_insert ON public.anexos_assistencia FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY anx_update ON public.anexos_assistencia FOR UPDATE TO authenticated
  USING (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY anx_delete ON public.anexos_assistencia FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR pode_acessar_loja(loja_de_assistencia(assistencia_id)));

-- FOTOS_ASSISTENCIA
DROP POLICY IF EXISTS fotos_assistencia_select ON public.fotos_assistencia;
DROP POLICY IF EXISTS fotos_assistencia_insert ON public.fotos_assistencia;
DROP POLICY IF EXISTS fotos_assistencia_update ON public.fotos_assistencia;
DROP POLICY IF EXISTS fotos_assistencia_delete ON public.fotos_assistencia;
CREATE POLICY fotos_assistencia_select ON public.fotos_assistencia FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY fotos_assistencia_insert ON public.fotos_assistencia FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY fotos_assistencia_update ON public.fotos_assistencia FOR UPDATE TO authenticated
  USING (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY fotos_assistencia_delete ON public.fotos_assistencia FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR pode_acessar_loja(loja_de_assistencia(assistencia_id)));

-- CHECKINS
DROP POLICY IF EXISTS checkins_select ON public.checkins;
DROP POLICY IF EXISTS checkins_insert ON public.checkins;
DROP POLICY IF EXISTS checkins_update ON public.checkins;
DROP POLICY IF EXISTS checkins_delete ON public.checkins;
CREATE POLICY checkins_select ON public.checkins FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY checkins_insert ON public.checkins FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY checkins_update ON public.checkins FOR UPDATE TO authenticated
  USING (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY checkins_delete ON public.checkins FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR pode_acessar_loja(loja_de_assistencia(assistencia_id)));

-- ASSINATURAS (via assistencia)
DROP POLICY IF EXISTS assinaturas_select ON public.assinaturas;
DROP POLICY IF EXISTS assinaturas_insert ON public.assinaturas;
DROP POLICY IF EXISTS assinaturas_update ON public.assinaturas;
DROP POLICY IF EXISTS assinaturas_delete ON public.assinaturas;
CREATE POLICY assinaturas_select ON public.assinaturas FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY assinaturas_insert ON public.assinaturas FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY assinaturas_update ON public.assinaturas FOR UPDATE TO authenticated
  USING (pode_acessar_loja(loja_de_assistencia(assistencia_id)));
CREATE POLICY assinaturas_delete ON public.assinaturas FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR pode_acessar_loja(loja_de_assistencia(assistencia_id)));

-- PROMOB_IMPORTS (via orcamento)
DROP POLICY IF EXISTS promob_imports_select ON public.promob_imports;
DROP POLICY IF EXISTS promob_imports_insert ON public.promob_imports;
DROP POLICY IF EXISTS promob_imports_update ON public.promob_imports;
DROP POLICY IF EXISTS promob_imports_delete ON public.promob_imports;
CREATE POLICY promob_imports_select ON public.promob_imports FOR SELECT TO authenticated
  USING (pode_acessar_loja(loja_de_orcamento(orcamento_id)));
CREATE POLICY promob_imports_insert ON public.promob_imports FOR INSERT TO authenticated
  WITH CHECK (pode_acessar_loja(loja_de_orcamento(orcamento_id)));
CREATE POLICY promob_imports_update ON public.promob_imports FOR UPDATE TO authenticated
  USING (pode_acessar_loja(loja_de_orcamento(orcamento_id)));
CREATE POLICY promob_imports_delete ON public.promob_imports FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR pode_acessar_loja(loja_de_orcamento(orcamento_id)));

-- PARCEIRO_COMPROVANTES (via comissao -> loja, fallback parceiro)
DROP POLICY IF EXISTS pcomp_select ON public.parceiro_comprovantes;
DROP POLICY IF EXISTS pcomp_insert ON public.parceiro_comprovantes;
DROP POLICY IF EXISTS pcomp_update ON public.parceiro_comprovantes;
DROP POLICY IF EXISTS pcomp_delete ON public.parceiro_comprovantes;
CREATE POLICY pcomp_select ON public.parceiro_comprovantes FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin')
    OR pode_acessar_loja(loja_de_comissao(comissao_id))
    OR pode_acessar_loja(loja_de_parceiro(parceiro_id))
  );
CREATE POLICY pcomp_insert ON public.parceiro_comprovantes FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'admin')
    OR pode_acessar_loja(loja_de_comissao(comissao_id))
    OR pode_acessar_loja(loja_de_parceiro(parceiro_id))
  );
CREATE POLICY pcomp_update ON public.parceiro_comprovantes FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'admin')
    OR pode_acessar_loja(loja_de_comissao(comissao_id))
    OR pode_acessar_loja(loja_de_parceiro(parceiro_id))
  );
CREATE POLICY pcomp_delete ON public.parceiro_comprovantes FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- =========================================================
-- 3) FOREIGN KEYS faltantes
-- =========================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ambientes_orcamento_id_fkey') THEN
    ALTER TABLE public.ambientes ADD CONSTRAINT ambientes_orcamento_id_fkey
      FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pagamentos_orcamento_orcamento_id_fkey') THEN
    ALTER TABLE public.pagamentos_orcamento ADD CONSTRAINT pagamentos_orcamento_orcamento_id_fkey
      FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pedidos_orcamento_id_fkey') THEN
    ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_orcamento_id_fkey
      FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pedido_pastas_pedido_id_fkey') THEN
    ALTER TABLE public.pedido_pastas ADD CONSTRAINT pedido_pastas_pedido_id_fkey
      FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pedido_documentos_pedido_id_fkey') THEN
    ALTER TABLE public.pedido_documentos ADD CONSTRAINT pedido_documentos_pedido_id_fkey
      FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pedido_documentos_pasta_id_fkey') THEN
    ALTER TABLE public.pedido_documentos ADD CONSTRAINT pedido_documentos_pasta_id_fkey
      FOREIGN KEY (pasta_id) REFERENCES public.pedido_pastas(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pedido_chat_pedido_id_fkey') THEN
    ALTER TABLE public.pedido_chat ADD CONSTRAINT pedido_chat_pedido_id_fkey
      FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pedido_revisoes_pedido_id_fkey') THEN
    ALTER TABLE public.pedido_revisoes ADD CONSTRAINT pedido_revisoes_pedido_id_fkey
      FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pedido_revisoes_ambiente_id_fkey') THEN
    ALTER TABLE public.pedido_revisoes ADD CONSTRAINT pedido_revisoes_ambiente_id_fkey
      FOREIGN KEY (ambiente_id) REFERENCES public.ambientes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='contratos_orcamento_id_fkey') THEN
    ALTER TABLE public.contratos ADD CONSTRAINT contratos_orcamento_id_fkey
      FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assistencias_pedido_id_fkey') THEN
    ALTER TABLE public.assistencias ADD CONSTRAINT assistencias_pedido_id_fkey
      FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assistencia_checklist_assistencia_id_fkey') THEN
    ALTER TABLE public.assistencia_checklist ADD CONSTRAINT assistencia_checklist_assistencia_id_fkey
      FOREIGN KEY (assistencia_id) REFERENCES public.assistencias(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='materiais_assistencia_assistencia_id_fkey') THEN
    ALTER TABLE public.materiais_assistencia ADD CONSTRAINT materiais_assistencia_assistencia_id_fkey
      FOREIGN KEY (assistencia_id) REFERENCES public.assistencias(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='anexos_assistencia_assistencia_id_fkey') THEN
    ALTER TABLE public.anexos_assistencia ADD CONSTRAINT anexos_assistencia_assistencia_id_fkey
      FOREIGN KEY (assistencia_id) REFERENCES public.assistencias(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fotos_assistencia_assistencia_id_fkey') THEN
    ALTER TABLE public.fotos_assistencia ADD CONSTRAINT fotos_assistencia_assistencia_id_fkey
      FOREIGN KEY (assistencia_id) REFERENCES public.assistencias(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='checkins_assistencia_id_fkey') THEN
    ALTER TABLE public.checkins ADD CONSTRAINT checkins_assistencia_id_fkey
      FOREIGN KEY (assistencia_id) REFERENCES public.assistencias(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assinaturas_assistencia_id_fkey') THEN
    ALTER TABLE public.assinaturas ADD CONSTRAINT assinaturas_assistencia_id_fkey
      FOREIGN KEY (assistencia_id) REFERENCES public.assistencias(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='parceiro_comissoes_pedido_id_fkey') THEN
    ALTER TABLE public.parceiro_comissoes ADD CONSTRAINT parceiro_comissoes_pedido_id_fkey
      FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='parceiro_comissoes_parceiro_id_fkey') THEN
    ALTER TABLE public.parceiro_comissoes ADD CONSTRAINT parceiro_comissoes_parceiro_id_fkey
      FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='parceiro_comprovantes_comissao_id_fkey') THEN
    ALTER TABLE public.parceiro_comprovantes ADD CONSTRAINT parceiro_comprovantes_comissao_id_fkey
      FOREIGN KEY (comissao_id) REFERENCES public.parceiro_comissoes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='parceiro_comprovantes_parceiro_id_fkey') THEN
    ALTER TABLE public.parceiro_comprovantes ADD CONSTRAINT parceiro_comprovantes_parceiro_id_fkey
      FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lancamentos_financeiros_pedido_id_fkey') THEN
    ALTER TABLE public.lancamentos_financeiros ADD CONSTRAINT lancamentos_financeiros_pedido_id_fkey
      FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orcamentos_cliente_id_fkey') THEN
    ALTER TABLE public.orcamentos ADD CONSTRAINT orcamentos_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pedidos_cliente_id_fkey') THEN
    ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =========================================================
-- 4) Catálogo de módulos de permissão
-- =========================================================
CREATE TABLE IF NOT EXISTS public.permissoes_modulos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL,
  acao text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modulo, acao)
);

ALTER TABLE public.permissoes_modulos_catalogo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pmc_select ON public.permissoes_modulos_catalogo;
CREATE POLICY pmc_select ON public.permissoes_modulos_catalogo
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pmc_admin ON public.permissoes_modulos_catalogo;
CREATE POLICY pmc_admin ON public.permissoes_modulos_catalogo
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

-- Popula catálogo
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao)
SELECT m, a FROM
  unnest(ARRAY[
    'clientes','crm','orcamentos','pedidos','assistencias','contratos',
    'agenda','tarefas','notas_fiscais','relatorios','configuracoes',
    'financeiro','parceiros'
  ]) m
CROSS JOIN unnest(ARRAY['view','create','edit','delete','approve','export']) a
ON CONFLICT (modulo, acao) DO NOTHING;
