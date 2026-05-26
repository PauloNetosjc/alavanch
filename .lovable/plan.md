# Replicar filtro de Loja nas demais telas financeiras

As 3 telas principais (Financeiro, Contas a Pagar, Contas a Receber) já usam `LojasFilter` + estado `lojasFiltro` (inicializa com a loja do topbar; `[]` = todas as lojas acessíveis). Vou replicar exatamente o mesmo padrão nas demais.

## Telas a ajustar

### 1. `src/pages/ContasCorrentes.tsx`
- Importar `LojasFilter` e `useLoja`.
- Estado `lojasFiltro` inicializado com `[lojaSelecionada.id]` (se houver).
- Adicionar `<LojasFilter />` no header da página (ao lado do botão "Voltar ao Financeiro").
- Filtrar `contas_bancarias` e `cartoes_credito` por `loja_id ∈ lojasFiltro` (quando `lojasFiltro.length > 0`).
- Ao criar nova conta/cartão, default `loja_id = lojaSelecionada?.id`.
- Passar `lojasFiltro` como prop para `FluxoCaixaDashboard`.

### 2. `src/components/financeiro/FluxoCaixaDashboard.tsx`
- Receber prop `lojasFiltro: string[]`.
- Aplicar `.in("loja_id", lojasFiltro)` (quando não vazio) nas queries de `contas_bancarias` e `lancamentos_financeiros`.
- Recalcular saldo/projeção sempre que `lojasFiltro` mudar.

### 3. `src/pages/AnaliseFinanceira.tsx`
- Importar `LojasFilter` + `useLoja`; estado `lojasFiltro` inicializado com loja atual.
- `<LojasFilter />` no header (junto aos filtros de período já existentes).
- Aplicar filtro em todas as queries: `lancamentos_financeiros`, `pedidos`, `clientes` (via `loja_id`).
- Recalcular KPIs/DRE/gráficos a partir do dataset filtrado.

### 4. `src/pages/AprovadorFinanceiro.tsx`
- Importar `LojasFilter` + `useLoja`; estado `lojasFiltro` inicializado com loja atual.
- `<LojasFilter />` no header.
- Aplicar filtro em `lancamentos_financeiros` (pendentes de aprovação) por `loja_id`.
- Mantém comportamento de aprovação atual; só a lista exibida muda.

## Padrão visual (igual às 3 telas já feitas)

```
<div className="flex items-center justify-between mb-4">
  <h1 ...>{título}</h1>
  <LojasFilter value={lojasFiltro} onChange={setLojasFiltro} />
</div>
```

## Comportamento garantido (consistente com Financeiro/A Pagar/A Receber)

- Ao abrir a tela: filtro pré-selecionado com a loja ativa no topbar.
- Trocar loja no topbar não força reset (usuário controla via filtro local).
- `lojasFiltro = []` → exibe todas as lojas que o usuário tem permissão para acessar.
- Se o usuário só tem 1 loja, `LojasFilter` já se renderiza como rótulo (sem dropdown).

## Fora do escopo

- Sem alterações em RLS/migrations (a coluna `loja_id` já existe em `contas_bancarias`, `cartoes_credito` e `lancamentos_financeiros`).
- Sem mudanças nas 3 telas que já usam o filtro.
