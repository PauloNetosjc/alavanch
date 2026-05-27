
CREATE TABLE public.regras_comissao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  meta_minima numeric NOT NULL DEFAULT 0,
  modo text NOT NULL DEFAULT 'premiacao',
  comissao_percentual numeric NOT NULL DEFAULT 0,
  premiacao_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  premiacao_step_a_partir_de numeric NOT NULL DEFAULT 0,
  premiacao_step_valor numeric NOT NULL DEFAULT 0,
  premiacao_step_tamanho numeric NOT NULL DEFAULT 10000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.regras_comissao TO authenticated;
GRANT ALL ON public.regras_comissao TO service_role;

ALTER TABLE public.regras_comissao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regras_comissao_select" ON public.regras_comissao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "regras_comissao_admin_write" ON public.regras_comissao
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_regras_comissao_updated_at
  BEFORE UPDATE ON public.regras_comissao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo)
VALUES ('comissoes','view','Acessar a tela de Cálculo de Comissão','Relatórios'),
       ('comissoes','config','Configurar regras de comissão/premiação','Relatórios')
ON CONFLICT DO NOTHING;
