// Helpers para cálculos financeiros e RT de parceiros
export const BRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Calcula a comissão (RT) com base em valor do pedido × percentual. Arredonda para 2 casas. */
export function calcularRT(valorPedido: number, percentual: number): number {
  if (!valorPedido || !percentual) return 0;
  return Math.round(valorPedido * percentual) / 100;
}

export type Lancamento = { tipo: "entrada" | "saida"; valor: number };

/** Soma entradas e saídas, retornando totais separados. */
export function somarMovimento(lancamentos: Lancamento[]) {
  return lancamentos.reduce(
    (acc, l) => {
      if (l.tipo === "entrada") acc.entradas += Number(l.valor) || 0;
      else acc.saidas += Number(l.valor) || 0;
      return acc;
    },
    { entradas: 0, saidas: 0 }
  );
}

/** Retorna saldo final = saldo inicial + entradas - saídas */
export function saldoFinal(saldoInicial: number, entradas: number, saidas: number) {
  return (saldoInicial || 0) + (entradas || 0) - (saidas || 0);
}

/** Lista 6 competências mensais terminando no mês atual. Formato: { key: 'YYYY-MM', label: 'mmm/aa' } */
export function ultimasCompetencias(refDate = new Date(), n = 6) {
  const out: { key: string; label: string; year: number; month: number }[] = [];
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    out.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: `${meses[m]}/${String(y).slice(-2)}`,
      year: y,
      month: m + 1,
    });
  }
  return out;
}
