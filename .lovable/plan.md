## Relatório ABC de Produtos

### Onde fica
Nova aba **"Curva ABC"** dentro da tela **Cadastros → Produtos** (`/produtos`), ao lado da listagem atual.

### Banco de dados
Hoje os itens dos pedidos estão em `pedido_itens_avulsos`, mas **não têm vínculo com a tabela `produtos`** nem campo de quantidade. Para o ABC funcionar de verdade, vou adicionar:

- `pedido_itens_avulsos.produto_id` (UUID, opcional, FK lógica para `produtos.id`)
- `pedido_itens_avulsos.quantidade` (numeric, default 1)
- `pedido_itens_avulsos.preco_custo_unit` (numeric, opcional — preenchido a partir do produto na hora da venda; usado para cálculo de lucro mesmo se o custo do produto mudar depois)

No formulário de **itens avulsos** do pedido, adiciono um campo opcional de "Produto" (autocomplete buscando em `produtos`). Ao selecionar, ele preenche descrição, preço de venda sugerido e trava o custo do snapshot. Itens manuais sem vínculo continuam funcionando como hoje (ficam fora do ABC).

### Tela do Relatório ABC

**Filtros no topo:**
- Período (data inicial / data final, padrão: últimos 90 dias)
- Loja (respeita `LojaContext`; admin pode ver "todas")
- Status do pedido (padrão: somente pedidos "ativos/concluídos")
- **Critério** (radio): Faturamento • Quantidade • Lucro bruto
- Faixas A/B/C configuráveis (padrão 80% / 95% / 100%)

**Cálculo:**
1. Buscar `pedido_itens_avulsos` com `produto_id NOT NULL` no período/loja
2. Agregar por produto: somar `quantidade`, `valor_venda * quantidade`, `(valor_venda - preco_custo_unit) * quantidade`
3. Ordenar decrescente pelo critério escolhido
4. Calcular `% individual` e `% acumulado`
5. Classificar A (≤80%), B (≤95%), C (resto)

**Visual:**
- 3 cards de resumo: total de itens A, B, C (qtd produtos + % faturamento de cada)
- Gráfico de Pareto (Recharts): barras = valor por produto + linha = % acumulado
- Tabela ordenada: posição, descrição, código interno, qtd vendida, faturamento, lucro, % individual, % acumulado, **badge da classe** (verde A, amarelo B, cinza C)
- Botão **Exportar CSV**

### Detalhes técnicos
- Migration: alteração em `pedido_itens_avulsos` (3 colunas novas, nullable, sem quebra)
- Componente novo: `src/pages/Produtos.tsx` recebe `Tabs` com "Lista" e "Curva ABC"
- Subcomponente: `src/components/produtos/CurvaABC.tsx` com filtros, query Supabase, cálculo, gráfico e tabela
- Form de item avulso (provavelmente em `OrderDetailSheet` ou similar) ganha autocomplete de produto — vou localizar e ajustar
- Gráfico via `recharts` (já usado no projeto)
- Exportação CSV client-side (sem libs novas)

### Fora de escopo
- Não vou recalcular ABC histórico de itens antigos (sem `produto_id` vinculado) — eles simplesmente não aparecem no relatório. Conforme novos pedidos forem cadastrados vinculando produtos, o ABC ganha massa.
- Não vou criar tabela separada de "venda de produtos" — reaproveito `pedido_itens_avulsos` para não duplicar fonte de verdade.
