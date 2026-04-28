# Cálculo de VPL (Valor Presente Líquido) no Orçamento

## Objetivo
Adicionar à Calculadora Comercial o cálculo de **VPL** — o valor real que a loja receberá quando os juros embutidos em parcelamentos longos são descontados — e exibir a **margem real** com base no custo dos itens.

Isso resolve o problema de vendedores darem desconto + parcelar longo prazo, achando que o pedido é lucrativo quando na prática o lucro foi corroído pelos juros do dinheiro no tempo.

## Conceito de VPL aplicado

Cada parcela futura vale menos hoje. A fórmula:

```
VPL = Σ ( valor_parcela_i / (1 + taxa_mensal)^meses_até_vencimento_i )
```

- `taxa_mensal` = custo de oportunidade do capital (taxa de desconto) — configurável por orçamento, com valor padrão definido em Administração.
- `meses_até_vencimento_i` = diferença em meses entre a data base e o vencimento da parcela.
- A primeira parcela (à vista) tem peso total; as seguintes são descontadas.

A diferença `Valor Final - VPL` é o "custo financeiro embutido" — quanto a loja perde só pelo prazo.

## Margem real

Custo total dos itens vem da soma de `order_items.cost` (já existe) dos ambientes do orçamento (via `quote_environments`). Como hoje os custos ficam em `order_items` (apenas pedido), vamos:

- Adicionar coluna `cost` em `quote_environments` (custo total do ambiente, editável).
- Calcular: `Custo Total = Σ quote_environments.cost`.
- `Lucro Bruto = Valor Final - Custo Total`
- `Margem Bruta % = Lucro Bruto / Valor Final`
- `Lucro VPL = VPL - Custo Total` (este é o lucro REAL)
- `Margem Real % = Lucro VPL / VPL` ← métrica-chave

## Configuração global

Nova tabela `financial_settings` (singleton) com:
- `default_discount_rate_monthly` (numeric, default 1.5% — taxa de desconto mensal padrão)
- `vpl_alert_threshold` (numeric, default 15% — alerta quando margem real cair abaixo)

Editável em **Administração** (nova seção "Configurações Financeiras / VPL").

## Mudanças na Calculadora Comercial

Adicionar um **bloco "Análise de Rentabilidade (VPL)"** abaixo do parcelamento, com:

```
┌─ Análise de Rentabilidade ────────────────────────────┐
│ Taxa de desconto mensal: [1,50] %    (custo capital)  │
│                                                        │
│ Valor Nominal (final):       R$ 25.000,00             │
│ VPL (Valor Presente):        R$ 23.420,15             │
│ Custo financeiro embutido:   R$  1.579,85  (6,3%)     │
│                                                        │
│ Custo dos ambientes:         R$ 14.000,00             │
│ Lucro nominal:               R$ 11.000,00  (44%)      │
│ Lucro real (VPL - custo):    R$  9.420,15  (40,2%) ⚠ │
└────────────────────────────────────────────────────────┘
```

- Campo editável da taxa de desconto (padrão vem de `financial_settings`).
- Indicador visual: verde se margem real ≥ threshold, amarelo se entre threshold e metade, vermelho se abaixo da metade.
- Ao recalcular parcelas o VPL recalcula automaticamente.
- Tooltip explicando o conceito.

## Comissão sobre VPL (bonus relacionado)

Persistir o VPL calculado em `quotes.npv_value` para uso futuro pelo módulo de comissões (não implementado nesta etapa, só a base de dados).

## Mudanças no Banco

**Migration:**
1. `ALTER TABLE quotes ADD COLUMN npv_value numeric DEFAULT 0`
2. `ALTER TABLE quotes ADD COLUMN discount_rate_monthly numeric DEFAULT 1.5`
3. `ALTER TABLE quote_environments ADD COLUMN cost numeric DEFAULT 0`
4. `ALTER TABLE orders ADD COLUMN npv_value numeric DEFAULT 0` (espelha quando converte)
5. `ALTER TABLE orders ADD COLUMN discount_rate_monthly numeric DEFAULT 1.5`
6. Nova tabela `financial_settings`:
   ```sql
   CREATE TABLE financial_settings (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     default_discount_rate_monthly numeric DEFAULT 1.5,
     vpl_alert_threshold numeric DEFAULT 15,
     updated_at timestamptz DEFAULT now()
   );
   ```
   - RLS: SELECT para autenticados, ALL para admin.
   - Seed com 1 linha default.

## Mudanças no Código

1. **`src/lib/financial.ts`** (novo):
   - `calculateNPV(installments, baseDate, monthlyRate)` — retorna número.
   - `monthsBetween(from, to)` — utilitário.
   - `calculateMargins({ finalValue, npv, totalCost })` — retorna `{ grossProfit, grossMargin, realProfit, realMargin, financialCost, financialCostPct }`.

2. **`src/components/quotes/QuoteCalculator.tsx`**:
   - Carregar `financial_settings` ao abrir.
   - Carregar `quote_environments` para somar custo total.
   - Estado novo: `discountRateMonthly`, derivar `npv`, `margins`.
   - Recalcular sempre que parcelas/data base/taxa mudarem.
   - Renderizar o bloco "Análise de Rentabilidade".
   - Salvar `npv_value` e `discount_rate_monthly` no `quotes.update`.

3. **`src/components/quotes/QuoteFormDialog.tsx`** (ambientes):
   - Adicionar campo `cost` em cada ambiente (input numérico).

4. **`src/components/quotes/QuoteDetailSheet.tsx`**:
   - Exibir VPL e margem real no bloco financeiro (read-only).

5. **`src/components/orders/OrderDetailSheet.tsx`** — aba Financeiro:
   - Mostrar VPL e margem real do pedido (já espelhados na conversão).

6. **`src/pages/Configuracoes.tsx`** — nova seção "Financeiro / VPL":
   - Editar `default_discount_rate_monthly` e `vpl_alert_threshold` (apenas admin).

## Fora de escopo (para próximas etapas)
- Comissões automáticas calculadas sobre VPL (apenas persistimos o valor).
- DRE detalhado por contrato (custos de fábrica, frete, impostos separados).
- Recalcular VPL retroativamente em pedidos antigos.

## Confirmações
A taxa de desconto mensal padrão sugerida é **1,5% a.m.** (≈19,6% a.a.) — alinhada com custo médio de capital de giro no Brasil. Você poderá alterar a qualquer momento em Administração.
