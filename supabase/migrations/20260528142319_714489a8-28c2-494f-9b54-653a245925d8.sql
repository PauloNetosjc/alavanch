-- Tabela de configuração de visibilidade dos kanbans
CREATE TABLE public.configuracoes_kanbans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  chave_kanban text NOT NULL,
  nome_kanban text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid,
  UNIQUE (loja_id, chave_kanban)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_kanbans TO authenticated;
GRANT ALL ON public.configuracoes_kanbans TO service_role;

ALTER TABLE public.configuracoes_kanbans ENABLE ROW LEVEL SECURITY;

-- Todos autenticados leem (para o menu filtrar)
CREATE POLICY "ck_select" ON public.configuracoes_kanbans
  FOR SELECT TO authenticated USING (true);

-- Apenas admin altera
CREATE POLICY "ck_admin_ins" ON public.configuracoes_kanbans
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ck_admin_upd" ON public.configuracoes_kanbans
  FOR UPDATE TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "ck_admin_del" ON public.configuracoes_kanbans
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger atualizado_em
CREATE OR REPLACE FUNCTION public.tg_configuracoes_kanbans_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_configuracoes_kanbans_touch
BEFORE UPDATE ON public.configuracoes_kanbans
FOR EACH ROW EXECUTE FUNCTION public.tg_configuracoes_kanbans_touch();

-- Permissões no catálogo
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('sistema_configurar_kanbans', 'view', 'Acessar Configuração de Kanbans', 'Sistema'),
  ('sistema_configurar_kanbans', 'edit', 'Alterar visibilidade dos kanbans', 'Sistema')
ON CONFLICT (modulo, acao) DO NOTHING;