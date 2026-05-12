## Limpeza de dados transacionais

Operação de baixa complexidade. Vamos apagar apenas dados **transacionais** (pedidos, financeiro, kanban, assinaturas, comissões, assistências) e preservar toda a **configuração** do sistema (lojas, usuários, permissões, categorias financeiras, contas correntes, pipelines, estágios, templates de contrato/checklist, parceiros, clientes, leads).

### O que será apagado

**Comercial / Pedidos**
- `pedidos` (e tudo vinculado: pastas, documentos, checklist de estágio, histórico de estágio, adendos)
- `orcamentos`, `ambientes`, `itens_avulsos`, `pagamentos_orcamento`
- `contratos`

**Financeiro**
- `lancamentos_financeiros` (entradas, saídas, custos fábrica, comissões)
- Movimentações de conta vinculadas a esses lançamentos
- Conciliações e comprovantes vinculados

**Kanban / Pipelines**
- `kanban_cards` (todos os pipelines: comercial, fábrica, montagem, revisão, pós-venda, operacional)

**Assinaturas**
- `solicitacoes_assinatura`, `assinatura_participantes`, `assinatura_eventos`, `assinatura_evidencias`

**Parceiros / Comissões**
- `parceiro_comissoes`, `parceiro_comprovantes`

**Assistência / Pós-venda**
- `assistencias` e tabelas filhas (materiais, checklist)
- `ocorrencias`

**Outros transacionais**
- `agenda_eventos`
- `timeline_eventos`
- `notificacoes`

### O que será preservado

- Lojas, usuários, perfis, papéis (`user_roles`), permissões
- Clientes, leads, parceiros (cadastros), vendedores, origens
- Categorias financeiras, contas correntes (saldo será zerado/recalculado)
- Estágios CRM, estágios de pipeline, automações
- Templates de contrato e de checklist
- Tipos de documento, feriados, configurações da agenda
- Branding e configurações gerais

### Como será executado

Um único script SQL com `DELETE` em ordem correta (filhos antes de pais) dentro de uma transação. Os triggers de geração automática (pedido a partir de orçamento, lançamentos, kanban cards) não disparam em DELETE, então não há efeito colateral.

Sequências de código (`PV-XXX-NNNN`, `AD-XXX-NNNN`, `receita_codigo`) são calculadas via `MAX()`, então automaticamente reiniciam.

### Confirmação necessária

Antes de executar, preciso confirmar:

1. **Ambiente**: isso roda no banco **único** que está conectado ao app (não há separação test/prod aqui). Confirma que pode apagar tudo?
2. **Clientes e Leads**: mantenho como cadastro? Ou também apago? (recomendo manter)
3. **Parceiros**: mantenho cadastro, apago só comissões? (recomendo manter)
4. **Saldo de contas correntes**: zero todas as contas para o saldo inicial atual, ou deixo o saldo como está?

Após sua confirmação, gero a migration de limpeza em uma única execução.