# Gatilhos de "Criar card neste estágio"

Hoje os editores de estágio (`EstagiosEditDialog` para Operacional/Revisão/Fábrica/Montagem/Pós-venda e `CrmEstagiosEditDialog` para CRM Comercial) permitem configurar **automações de saída** (o que acontece quando o card chega/é movido). Falta o inverso: dizer **quando um card deve nascer** naquele estágio.

Vou adicionar, dentro do painel expandido de cada estágio, uma nova seção **"Criar card neste estágio quando…"** com checkboxes para os gatilhos solicitados.

## Gatilhos disponíveis

| Valor | Rótulo | Pipelines em que faz sentido (sugestão padrão) |
|---|---|---|
| `orcamento_criado` | Quando um orçamento é criado | CRM Comercial |
| `negociacao_criada` | Quando uma negociação é criada | CRM Comercial |
| `contrato_criado` | Quando um contrato é gerado | Operacional |
| `revisao_concluida` | Quando a revisão de projeto é concluída | Fábrica |
| `entrega_agendada` | Quando uma entrega é agendada | Montagem (ou Operacional) |
| `montagem_agendada` | Quando a montagem é agendada | Montagem |
| `assistencia_aberta` | Quando uma nova assistência é aberta | Pós-venda |

Cada estágio pode marcar **um ou mais** gatilhos. O usuário escolhe livremente — não vou forçar combinações por pipeline.

## Mudanças

### 1. Banco (`pipeline_estagios`)
- Adicionar coluna `criar_card_em text[] not null default '{}'` (lista dos gatilhos acima).
- Apenas adição de coluna; nada quebra para estágios existentes.

### 2. Editor de estágios (Kanbans operacionais)
Arquivo: `src/components/kanban/EstagiosEditDialog.tsx`
- Tipo `Estagio` ganha `criar_card_em: string[]`.
- Carregamento e `save` incluem o novo campo.
- Dentro do bloco expandido (após "Concluir card", antes de "Automações"), nova seção com checkboxes para os 7 gatilhos.

### 3. Editor de estágios do CRM Comercial
Arquivo: `src/components/CrmEstagiosEditDialog.tsx`
- Mesma alteração visual e de persistência.

### 4. Disparo dos gatilhos (criação real do card)
Helper novo `src/lib/kanbanTriggers.ts` com função `dispatchKanbanTrigger(trigger, ctx)` que:
- Consulta `pipeline_estagios` onde `criar_card_em` contém o gatilho e `ativo = true`.
- Para cada estágio encontrado, insere em `kanban_cards` um card vinculado à entidade do contexto (pedido/orçamento/assistência), evitando duplicidade pelo par `(pipeline, entidade_id)`.
- Loga no `timeline_eventos` (`tipo: 'card_criado_auto'`).

Pontos de chamada (mínimos, apenas onde já existe o evento de negócio):
- `orcamento_criado` → ao salvar novo orçamento em `ComercialNovo.tsx`.
- `negociacao_criada` → ao criar negociação em `ComercialNegociacao.tsx`.
- `contrato_criado` → ao gerar contrato no fluxo de contratos.
- `revisao_concluida` → ao concluir o estágio final do kanban Revisão (já existe hook em `concluirAction.ts`).
- `entrega_agendada` / `montagem_agendada` → ao salvar evento de agenda com tipo correspondente (`AgendaEventoDialog.tsx`).
- `assistencia_aberta` → ao abrir chamado em `Assistencia.tsx` / `MeusChamados.tsx`.

## Fora do escopo
- Não vou mexer no fluxo de automações **de saída** já existentes.
- Não vou alterar `kanbanRegistry` nem a UI do board (cards continuam aparecendo pelo carregamento normal).
- Não vou adicionar permissões novas — quem já edita estágios passa a editar gatilhos.

Confirma para eu seguir?
