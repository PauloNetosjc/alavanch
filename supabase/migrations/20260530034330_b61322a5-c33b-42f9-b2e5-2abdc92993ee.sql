INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, grupo, descricao)
VALUES ('sistema.painel_master', 'view', 'sistema', 'Acessar o Painel Master do SaaS')
ON CONFLICT DO NOTHING;