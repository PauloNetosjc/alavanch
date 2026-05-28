## Relatórios Financeiros — Plano de implementação

Nova página `/financeiro/relatorios` acessada pelo botão "Relatórios" hoje existente no topo do módulo Financeiro. Reutiliza `lancamentos_financeiros`, `categorias_financeiras`, `centros_custo`, `contas_bancarias`, `clientes`, `fornecedores`, `parceiros` e `pedidos` — sem alterar lógica de baixa, contratos, RT ou workflow.

### Estrutura da página

```
[Header] Relatórios Financeiros
         Análise de receitas, despesas, categorias, contatos, centros de custo e resultado por pedido.

[Filtros] Período (default = mês atual) · Loja · Categoria · Subcategoria · Centro de custo
          Conta bancária · Status · Tipo de entidade · Entidade · Forma de pagamento · DRE
          [Buscar] [Limpar] [Exportar Excel] [Imprimir]

[Cards resumo] Receitas · Despesas · Resultado · Recebidas · Pendentes ·
               Pagas · A pagar · Vencidas · Margem (%)

[Tabs]
  Despesas:  Por Categoria | Mês a Mês | Por Contato | Por Centro de Custo
  Receitas:  Por Pedido    | Por Contato | Por Categoria
```

### Componentes novos

- `src/pages/RelatoriosFinanceiros.tsx` — página principal, filtros, cards, tabs.
- `src/components/relatorios/RelatoriosFiltros.tsx` — barra de filtros reaproveitando padrão de `LancamentosFiltros`.
- `src/components/relatorios/DespesasPorCategoria.tsx` — tabela agrupada Categoria → Subcategoria → Lançamentos com Recharts (barra + pizza).
- `src/components/relatorios/DespesasMesAMes.tsx` — agrupamento Mês → Categoria → Lançamentos, gráfico de coluna empilhado por status.
- `src/components/relatorios/DespesasPorContato.tsx` — ranking de contatos, expandir lançamentos.
- `src/components/relatorios/DespesasPorCentroCusto.tsx` — Centro → Categoria → Lançamentos.
- `src/components/relatorios/ReceitasPorContato.tsx` — espelho do equivalente em despesas, filtrando tipo=receita.
- `src/components/relatorios/ReceitasPorCategoria.tsx` — espelho da despesa por categoria.
- `src/components/relatorios/ReceitaPorPedido.tsx` — tabela com colunas Pedido, Etiqueta, Data, Cliente, Valor Venda, Juros Financeiros, RT, Valor Venda Líquida (editável), Custo Venda, Custo Revisão (editável), Lucro Venda, Lucro Revisado, Margem Venda %, Margem Revisado %.
- `src/lib/relatoriosFinanceiros.ts` — helpers de agregação puros (testáveis).
- `src/lib/exportRelatorios.ts` — exports XLSX por relatório.

### Banco de dados

Nova migration cria **uma tabela auxiliar** apenas para os ajustes do relatório "Receita por Pedido":

```sql
CREATE TABLE public.resultado_pedido_ajustes (
  id uuid pk default gen_random_uuid(),
  pedido_id uuid not null unique references public.pedidos(id) on delete cascade,
  loja_id uuid references public.lojas(id),
  valor_venda_liquida_ajustado numeric,
  custo_revisao_ajustado numeric,
  atualizado_por uuid,
  atualizado_em timestamptz default now(),
  created_at timestamptz default now()
);
-- GRANTs (authenticated + service_role) + RLS por loja
```

Sem alteração em pedidos, contratos, lancamentos, baixas ou RT.

Permissões registradas no catálogo:
- `relatorios_financeiros.view`
- `relatorios_financeiros.export`
- `relatorios_financeiros.editar_resultado_pedido`

### Navegação / botão "Relatórios"

- Botão "Relatórios" em `src/pages/Financeiro.tsx` → `navigate('/financeiro/relatorios')`.
- Rota nova em `src/App.tsx` protegida com `RequirePermission modulo="relatorios_financeiros"`.
- (Sidebar não é alterada — acesso pelo botão dentro do Financeiro, conforme pedido.)

### Cálculos centrais (helpers puros)

- Status derivado: `pago` (data_pagamento ≠ null), `vencido` (sem pago e vencimento < hoje), `pendente` (sem pago e vencimento ≥ hoje).
- Agregações: somatório por chave, % sobre total, contagem.
- Resultado: `receitas - despesas`. Margem: `resultado / receitas * 100` (0 se receitas=0).
- Receita por Pedido:
  - `valor_venda` = `pedidos.valor_total` (ou contrato).
  - `juros` = soma de juros financeiros do contrato/parcelas (se existir).
  - `rt` = soma de despesas com categoria "RT/Indicação" vinculadas ao pedido, ou campo de RT do pedido.
  - `valor_liquido = ajuste.valor_venda_liquida_ajustado ?? (valor_venda - juros - rt)`.
  - `custo_venda` = custo de fábrica/produto do pedido (campo já existente).
  - `custo_revisao = ajuste.custo_revisao_ajustado ?? custo_venda` (0 se ausente).
  - Lucro/Margem conforme fórmulas do briefing.

### Edição inline (Receita por Pedido)

- Apenas com permissão `editar_resultado_pedido`.
- `onBlur` → upsert em `resultado_pedido_ajustes` (pedido_id único) + revalidação otimista.
- Não modifica pedido, contas ou baixas.

### Performance

- Período default = mês atual; data inicial obrigatória.
- 1 query consolidada de `lancamentos_financeiros` por aplicação de filtro, com joins para nomes (categoria, centro, conta).
- Receita por Pedido busca apenas pedidos do período + ajustes em uma única query paralela.
- Agregações no client (já filtrado por período/loja). Usar `useMemo`.

### Export / Print

- `exportRelatorios.ts` usa XLSX (já presente em `exportFinanceiro.ts`) — uma função por relatório, respeitando filtros.
- Print: `window.print()` + classe `print:` Tailwind escondendo sidebar, filtros, botões. Cabeçalho de impressão com título, data e filtros aplicados.

### Entregáveis

1. Migration `resultado_pedido_ajustes` + permissões em `permissoes_modulos_catalogo`.
2. Rota + botão "Relatórios" linkado.
3. Página + 7 componentes de relatório + filtros + cards.
4. Helpers de agregação e export XLSX.
5. Estilos de impressão.

Sem alterações em fluxos existentes (A Receber, A Pagar, baixas, pedidos, contratos, RT, workflow).
