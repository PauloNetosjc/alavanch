## Contexto atual

Hoje o sistema tem dois caminhos:

- **PV-{SIGLA}-####** — pedido novo, gerado quando o orçamento é confirmado (trigger `gerar_pedido_codigo_e_inserir`).
- **AD-{SIGLA}-####** — adendo, criado por "Criar Adendo" no `PedidoDetalhe`. Vive como aba do pedido raiz (`pedido_pai_id`), gera contrato/financeiro vinculados ao mesmo pedido.

Falta o terceiro fluxo: **Complemento (COMP)** — venda nova do mesmo ambiente/cliente, com contrato próprio, apenas referenciando o pedido anterior nas notas. Não compartilha contrato/financeiro.

## Comportamento desejado

| Tipo | Prefixo | Contrato | Financeiro | Vínculo | Onde aparece |
|---|---|---|---|---|---|
| Pedido novo | `PV-SIGLA-####` | Próprio | Próprio | Nenhum | Pedido autônomo |
| Complemento | `COMP-SIGLA-####` | **Próprio** (menciona o pedido original nas observações) | **Próprio** | `pedido_origem_complemento_id` (somente consulta) | Pedido autônomo, com link "Complemento de PV-…" no header |
| Adendo | `AD-SIGLA-####` | Mesmo contrato do pai (aditivo) | Lançamentos somam ao pai | `pedido_pai_id` + `is_adendo` | Aba dentro do pedido raiz |

## Mudanças

### 1. Banco (migration)

- `orcamentos`: adicionar `is_complemento boolean default false` e `pedido_origem_complemento_id uuid` (FK lógica para `pedidos.id`).
- `pedidos`: adicionar `is_complemento boolean default false` e `pedido_origem_complemento_id uuid`.
- Atualizar `gerar_pedido_codigo_e_inserir`:
  - Decidir prefixo: `AD` se `is_adendo`, `COMP` se `is_complemento`, senão `PV`.
  - Sequência independente por prefixo+sigla.
  - Complemento **cria pastas próprias** (igual PV), adendo continua sem pastas.
  - Copia `pedido_origem_complemento_id` do orçamento para o pedido.

### 2. `PedidoDetalhe.tsx`

- Adicionar botão **"Criar Complemento"** ao lado de "Criar Adendo" (cor distinta, ícone diferente).
- `criarComplemento()`: clona o orçamento raiz com `is_complemento=true` + `pedido_origem_complemento_id=<pedido atual>`, copia ambientes/itens como template, redireciona para `ComercialNovo` para o usuário negociar normalmente. Resulta em pedido COMP-… autônomo.
- Se o pedido atual for um complemento (`pedido_origem_complemento_id`), mostrar no header uma tarja/badge **"Complemento de PV-…"** com link de consulta ao pedido original. Sem abas (diferente de adendo).
- Atualizar o aviso "Pedido fechado" para mencionar os dois caminhos: Adendo (mesmo contrato) vs Complemento (contrato novo).

### 3. `ComercialNovo.tsx`

- Selecionar e gravar `is_complemento` e `pedido_origem_complemento_id` no orçamento.
- Não bloquear edição em complementos (são pedidos novos).
- Ao gerar contrato/snapshot de um orçamento complemento, incluir nas observações: *"Complemento ao pedido {codigo_origem} — refere-se ao mesmo ambiente."*

### 4. Listagens e Kanban

- Coluna/badge na lista de pedidos identificando tipo (PV / AD / COMP).
- KanbanComercial / Pedidos: complementos aparecem como cards próprios (porque são pedidos novos); adendos continuam ocultos (vivem dentro do pai).

### 5. Contrato

- `contratoTemplate.ts`: já usa snapshot; adicionar variável opcional `pedido_origem_codigo`. Para complementos, injetar no header/observações automaticamente.

## Fora do escopo

- Não mudar fluxo de adendo existente.
- Não migrar pedidos antigos — só novos.
- Sem alterações em permissões (segue o mesmo perfil que cria pedido).
