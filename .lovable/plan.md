## Visão geral

Refatoração das telas analíticas do sistema para padronizar filtros, separar métricas brutas/líquidas e introduzir gamificação no Ranking. Os tipos de pedido (PV/AD/COMP) já existem no banco e serão usados como dimensão de análise.

## 1. Filtro de período + loja (componente compartilhado)

- Criar `<PageFilters>` reutilizável: chip de período (Mês, Ano, Tudo, Personalizado) + seletor de loja com Avatar (Todas as lojas / loja X).
- Remover o `LojaSelector` global do `Topbar` (passa a ser por página).
- Aplicar em: Dashboard, Relatórios, Financeiro, Ranking, Kanbans (em telas onde já existe filtro próprio, substituir).

## 2. Dashboard (`src/pages/Dashboard.tsx`)

**Topo:** `<PageFilters>` com período (default mês corrente) + loja.

**Meta de Vendas:**
- "Venda Bruta": soma `valor_total` dos pedidos do período (atual VPL).
- "Venda Líquida": `valor_total - juros - rt_repassado` por pedido.
  - Juros: derivado do plano de pagamento (`parcelas.juros` em `lancamentos_financeiros`), ou somatório dos juros das parcelas com `tipo='juros'`.
  - RT: somatório de `parceiro_comissoes.valor_calculado` do pedido, quando `repassado=true`.
- Meta: configurada em Administração (já existe `metas` por loja/mês).

**Receitas e despesas:** mantém os cards, mas agora respondem ao filtro do topo (dia/semana/mês/personalizado).

**Fluxo de trabalho (cards de estágio):**
- Cada card exibe: `qtd`, `valor`, `vencidos` (badge vermelha).
- Clique → navega para o Kanban correspondente filtrado pelo estágio.
- Cálculo de vencidos: `pedidos` com `data_limite_finalizacao < hoje` E ainda no estágio.

## 3. Política de juros (Administração)

- Nova aba em `Administracao.tsx`: "Política de Juros".
  - Toggle por loja: "Juros assumido pela loja" x "Juros repassado ao cliente".
  - Campo % padrão por nº de parcelas (1x, 2x, 3-6x, 7-12x, 13x+).
- Tabela `politica_juros` (loja_id, faixa_min, faixa_max, perc, responsavel).
- Usado pelo calculador de pedido na hora de gerar o plano de pagamento.

## 4. Ranking (`src/pages/Ranking.tsx`) — Gamificado

- `<PageFilters>` com período + loja + grupo (Vendedor / Loja).
- **Pódio top 3:** colunas com alturas 2-1-3, medalhas ouro/prata/bronze, avatar grande, valor vendido, animação de entrada em escada (framer-motion).
- **Confete** no topo no carregamento (canvas-confetti).
- **Tabela restante (4º+):** linha animada, badge de evolução vs período anterior (▲ ▼ %).
- **Cards de métrica por vendedor:** contratos apresentados, contratos vendidos, taxa de conversão (gauge), ticket médio.
- **Ranking de loja:** mesmo padrão de pódio, com agregação por `loja_id`.

## 5. Relatórios (`src/pages/Relatorios.tsx`)

**Topo:** `<PageFilters>` (período: Este Mês / Este Ano / Tudo / Personalizado) + filtro de loja.

**KPIs (substitui os 5 atuais):**
- Faturamento Bruto (soma `valor_total`)
- Faturamento Líquido (bruto − juros − RT)
- Margem Líquida % (substituindo "Markup Médio"): `(líquido − custo) / líquido`
- Ticket Médio (substituindo "Bilheteria")
- Taxa de Conversão
- Cancelados

**Tabela por tipo de pedido** (nova seção):
| Tipo | Qtd | Faturamento | Margem | Ticket Médio |
|------|-----|-------------|--------|--------------|
| Pedido (PV) | … | … | … | … |
| Adendo (AD) | … | … | … | … |
| Complemento (COMP)| … | … | … | … |

Agrupa pedidos por `is_adendo`/`is_complemento`.

**Agendamentos por Tipo:**
- Adiciona filtro de origem do lead (multi-select de `origens`).
- Junta `agenda_eventos` → `pedido_id` → `orcamentos.origem_id`.

## 6. Banco (migração)

```sql
CREATE TABLE public.politica_juros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid REFERENCES lojas(id),
  responsavel text NOT NULL DEFAULT 'cliente', -- 'cliente' | 'loja'
  faixa_min int NOT NULL DEFAULT 1,
  faixa_max int NOT NULL DEFAULT 12,
  perc_mes numeric NOT NULL DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.parceiro_comissoes
  ADD COLUMN IF NOT EXISTS repassado boolean DEFAULT false;

-- (opcional) cache em pedidos para acelerar relatórios:
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS juros_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rt_repassado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_liquido numeric GENERATED ALWAYS AS (valor_total - COALESCE(juros_total,0) - COALESCE(rt_repassado,0)) STORED;
```

RLS: política `politica_juros` admin-only para mutação, leitura por loja.

## 7. Arquivos afetados

**Novos:**
- `src/components/PageFilters.tsx`
- `src/components/ranking/Podium.tsx`
- `src/pages/PoliticaJurosAdmin.tsx` (aba em Administração)
- migração SQL

**Editados:**
- `src/components/Topbar.tsx` — remove `LojaSelector`
- `src/pages/Dashboard.tsx` — filtros, venda líquida, cards com vencidos clicáveis
- `src/pages/Ranking.tsx` — pódio + confete + gamificação
- `src/pages/Relatorios.tsx` — KPIs líquidos, tabela PV/AD/COMP, filtro origem
- `src/pages/Administracao.tsx` — nova aba Juros
- `src/lib/financeiro.ts` — helpers `calcJurosPedido`, `calcRtRepassado`, `calcMargem`

## Fora do escopo
- Refazer cálculo de comissão por parceiro (já existe e fica como está).
- Migrar histórico de pedidos para preencher `juros_total`/`rt_repassado` retroativos — fica `0` para pedidos antigos até reabrir/recalcular.
- Alterações de design system, ícones do sidebar, ou outras telas além das listadas.
