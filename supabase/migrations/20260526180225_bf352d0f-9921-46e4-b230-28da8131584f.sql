
ALTER TABLE public.permissoes_modulos_catalogo
  ADD COLUMN IF NOT EXISTS grupo text;

-- Classifica os módulos existentes
UPDATE public.permissoes_modulos_catalogo SET grupo = CASE
  WHEN modulo IN ('orcamentos','pedidos','clientes','crm','contratos','descontos','itens') THEN 'Comercial'
  WHEN modulo IN ('agenda','tarefas','assistencias') THEN 'Operacional'
  WHEN modulo IN ('financeiro','notas_fiscais') THEN 'Financeiro'
  WHEN modulo IN ('parceiros','lojas') THEN 'Cadastros'
  WHEN modulo IN ('relatorios') THEN 'Relatórios'
  WHEN modulo IN ('configuracoes') THEN 'Sistema'
  ELSE grupo
END WHERE grupo IS NULL;

-- Cadastra autorizações de telas que ainda não estão no catálogo
INSERT INTO public.permissoes_modulos_catalogo (modulo, acao, descricao, grupo) VALUES
  ('dashboard','view','Acesso ao Dashboard principal','Relatórios'),
  ('dashboard','export','Exportar indicadores do Dashboard','Relatórios'),
  ('ranking','view','Acesso ao Ranking de vendas','Relatórios'),
  ('radar_prazos','view','Acesso ao Radar de Prazos','Relatórios'),
  ('analise_financeira','view','Acesso à Análise Financeira','Relatórios'),

  ('kanban_comercial','view','Acesso ao Kanban Comercial','Operacional'),
  ('kanban_comercial','edit','Mover cards no Kanban Comercial','Operacional'),
  ('kanban_fabrica','view','Acesso ao Kanban Fábrica','Operacional'),
  ('kanban_fabrica','edit','Mover cards no Kanban Fábrica','Operacional'),
  ('kanban_montagem','view','Acesso ao Kanban Montagem','Operacional'),
  ('kanban_montagem','edit','Mover cards no Kanban Montagem','Operacional'),
  ('kanban_pos_venda','view','Acesso ao Kanban Pós-Venda','Operacional'),
  ('kanban_pos_venda','edit','Mover cards no Kanban Pós-Venda','Operacional'),
  ('kanban_revisao','view','Acesso ao Kanban de Revisão','Operacional'),
  ('kanban_revisao','edit','Mover cards no Kanban de Revisão','Operacional'),
  ('montagem','view','Acesso à tela de Montagem','Operacional'),
  ('montagem','edit','Editar registros de Montagem','Operacional'),

  ('fornecedores','view','Acesso ao cadastro de Fornecedores','Cadastros'),
  ('fornecedores','create','Criar fornecedores','Cadastros'),
  ('fornecedores','edit','Editar fornecedores','Cadastros'),
  ('fornecedores','delete','Excluir fornecedores','Cadastros'),
  ('origens','view','Acesso ao cadastro de Origens','Cadastros'),
  ('origens','create','Criar origens','Cadastros'),
  ('origens','edit','Editar origens','Cadastros'),
  ('origens','delete','Excluir origens','Cadastros'),
  ('aniversariantes','view','Acesso a Aniversariantes do Mês','Cadastros'),
  ('produtos','view','Acesso ao Cadastro de Produtos','Cadastros'),
  ('produtos','create','Criar produtos','Cadastros'),
  ('produtos','edit','Editar produtos','Cadastros'),
  ('produtos','delete','Excluir produtos','Cadastros'),
  ('produtos','view_custo','Visualizar custo do produto','Cadastros'),

  ('bancos','view','Acesso a Bancos','Financeiro'),
  ('bancos','edit','Editar Bancos','Financeiro'),
  ('contas','view','Acesso a Contas Correntes','Financeiro'),
  ('contas','edit','Editar Contas Correntes','Financeiro'),
  ('extrato','view','Acesso ao Extrato de Conta','Financeiro'),
  ('extrato','export','Exportar extrato','Financeiro'),
  ('lancamentos','view','Acesso a Lançamentos Financeiros','Financeiro'),
  ('lancamentos','create','Criar lançamentos','Financeiro'),
  ('lancamentos','edit','Editar lançamentos','Financeiro'),
  ('lancamentos','delete','Excluir lançamentos','Financeiro'),
  ('lancamentos','baixar','Baixar lançamentos','Financeiro'),
  ('lancamentos','aprovar','Aprovar lançamentos pendentes','Financeiro'),
  ('categorias_financeiras','view','Acesso a Categorias Financeiras','Financeiro'),
  ('categorias_financeiras','edit','Editar Categorias Financeiras','Financeiro'),
  ('formas_pagamento','view','Acesso a Formas de Pagamento','Financeiro'),
  ('formas_pagamento','edit','Editar Formas de Pagamento','Financeiro'),
  ('metodos_pagamento','view','Acesso a Métodos de Pagamento','Financeiro'),
  ('metodos_pagamento','edit','Editar Métodos de Pagamento','Financeiro'),
  ('auditoria_parceiros','view','Acesso à Auditoria de Parceiros','Financeiro'),
  ('auditoria_parceiros','edit','Atualizar status na auditoria','Financeiro'),

  ('administracao','view','Acesso à área de Administração','Sistema'),
  ('usuarios','view','Acesso a Usuários','Sistema'),
  ('usuarios','create','Criar usuários','Sistema'),
  ('usuarios','edit','Editar usuários','Sistema'),
  ('usuarios','delete','Excluir usuários','Sistema'),
  ('cargos','view','Acesso a Cargos e Permissões','Sistema'),
  ('cargos','edit','Editar Cargos e Permissões','Sistema'),
  ('cargos','delete','Excluir cargos','Sistema'),
  ('autorizacoes_catalogo','view','Acesso ao catálogo de Autorizações','Sistema'),
  ('autorizacoes_catalogo','edit','Editar catálogo de Autorizações','Sistema'),
  ('autorizacoes','view','Acesso à Central de Autorizações','Sistema'),
  ('autorizacoes','decidir','Aprovar/Rejeitar autorizações','Sistema'),
  ('simulador_automacoes','view','Acesso ao Simulador de Automações','Sistema'),
  ('info_sistema','view','Acesso a Info Sistema','Sistema'),
  ('assinaturas','view','Acesso a Assinaturas Digitais','Sistema'),
  ('assinaturas','create','Solicitar assinaturas','Sistema'),

  ('checklist_templates','view','Acesso a Modelos de Checklist','Documentos'),
  ('checklist_templates','edit','Editar Modelos de Checklist','Documentos'),
  ('checklist_assistencia','view','Acesso ao Checklist de Assistência','Documentos'),
  ('checklist_assistencia','edit','Editar Checklist de Assistência','Documentos'),
  ('contrato_template','view','Visualizar modelo de Contrato','Documentos'),
  ('contrato_template','edit','Editar modelo de Contrato','Documentos')
ON CONFLICT (modulo, acao) DO UPDATE SET
  descricao = COALESCE(EXCLUDED.descricao, public.permissoes_modulos_catalogo.descricao),
  grupo = COALESCE(EXCLUDED.grupo, public.permissoes_modulos_catalogo.grupo);
