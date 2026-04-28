/**
 * Cálculo de VPL (Valor Presente Líquido) e margens reais.
 *
 * VPL desconta o "valor do dinheiro no tempo" das parcelas futuras,
 * mostrando quanto a loja realmente recebe quando uma venda é parcelada
 * — diferente do valor nominal que muitos sistemas exibem como receita.
 */

export interface InstallmentLike {
  value: number;
  due_date: string | null | undefined;
}

export function monthsBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return ms / (1000 * 60 * 60 * 24 * 30.4375);
}

/**
 * VPL = Σ ( valor_i / (1 + taxa_mensal)^meses_i )
 * @param installments parcelas com valor e data de vencimento
 * @param baseDate data-base (geralmente hoje ou data de fechamento)
 * @param monthlyRatePct taxa de desconto mensal em PERCENTUAL (ex: 1.5 para 1,5% a.m.)
 */
export function calculateNPV(
  installments: InstallmentLike[],
  baseDate: Date | string,
  monthlyRatePct: number
): number {
  const base = typeof baseDate === 'string' ? new Date(baseDate) : baseDate;
  const r = monthlyRatePct / 100;
  let npv = 0;
  for (const inst of installments) {
    if (!inst.due_date) {
      npv += inst.value;
      continue;
    }
    const due = new Date(inst.due_date);
    const months = Math.max(0, monthsBetween(base, due));
    const factor = Math.pow(1 + r, months);
    npv += inst.value / factor;
  }
  return Math.round(npv * 100) / 100;
}

export interface MarginInputs {
  finalValue: number;
  npv: number;
  totalCost: number;
}

export interface MarginResults {
  grossProfit: number;
  grossMarginPct: number;
  realProfit: number;
  realMarginPct: number;
  financialCost: number;
  financialCostPct: number;
}

export function calculateMargins({ finalValue, npv, totalCost }: MarginInputs): MarginResults {
  const grossProfit = finalValue - totalCost;
  const realProfit = npv - totalCost;
  const financialCost = finalValue - npv;
  return {
    grossProfit,
    grossMarginPct: finalValue > 0 ? (grossProfit / finalValue) * 100 : 0,
    realProfit,
    realMarginPct: npv > 0 ? (realProfit / npv) * 100 : 0,
    financialCost,
    financialCostPct: finalValue > 0 ? (financialCost / finalValue) * 100 : 0,
  };
}

export const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;