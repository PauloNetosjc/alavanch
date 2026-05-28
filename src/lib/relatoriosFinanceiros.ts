// Helpers puros para Relatórios Financeiros.
// Não altera nenhum dado — apenas deriva status, agrega e formata.

export type LancRaw = {
  id: string;
  tipo: string; // entrada | saida (compat: receita | despesa)
  descricao: string | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string | null;
  categoria_id: string | null;
  centro_custo_id: string | null;
  conta_id: string | null;
  pedido_id: string | null;
  loja_id: string | null;
  entidade_tipo: string | null;
  entidade_id: string | null;
  entidade_nome: string | null;
  forma_pagamento_prevista: string | null;
};

export type Cat = { id: string; nome: string; parent_id: string | null; contabilizar_dre: boolean | null };
export type CC = { id: string; nome: string };
export type Conta = { id: string; nome: string };

export type LancEnriched = LancRaw & {
  natureza: "receita" | "despesa";
  statusDerivado: "pago" | "pendente" | "vencido";
  categoriaNome: string;
  subcategoriaNome: string | null;
  parentCategoriaId: string | null;
  centroCustoNome: string;
  contaNome: string;
  contabilizarDre: boolean;
};

const PAGO_STATUS = new Set(["pago", "recebido", "liquidado", "quitado"]);

export function isPago(l: { data_pagamento: string | null; status: string | null }) {
  if (l.data_pagamento) return true;
  return l.status ? PAGO_STATUS.has(l.status.toLowerCase()) : false;
}

export function derivaStatus(l: LancRaw, hoje = new Date()): "pago" | "pendente" | "vencido" {
  if (isPago(l)) return "pago";
  if (l.data_vencimento) {
    const v = new Date(l.data_vencimento + "T00:00:00");
    const h = new Date(hoje.toISOString().slice(0, 10) + "T00:00:00");
    if (v < h) return "vencido";
  }
  return "pendente";
}

export function deriveNatureza(tipo: string): "receita" | "despesa" {
  const t = (tipo || "").toLowerCase();
  if (t === "entrada" || t === "receita") return "receita";
  return "despesa";
}

export function enrich(
  rows: LancRaw[],
  cats: Cat[],
  centros: CC[],
  contas: Conta[],
): LancEnriched[] {
  const catById = new Map(cats.map((c) => [c.id, c]));
  const ccById = new Map(centros.map((c) => [c.id, c]));
  const contaById = new Map(contas.map((c) => [c.id, c]));
  return rows.map((r) => {
    const cat = r.categoria_id ? catById.get(r.categoria_id) : null;
    const parent = cat?.parent_id ? catById.get(cat.parent_id) : null;
    const isSub = !!cat?.parent_id;
    return {
      ...r,
      natureza: deriveNatureza(r.tipo),
      statusDerivado: derivaStatus(r),
      categoriaNome: (isSub ? parent?.nome : cat?.nome) || "Sem categoria",
      subcategoriaNome: isSub ? cat?.nome || null : null,
      parentCategoriaId: cat?.parent_id || cat?.id || null,
      centroCustoNome: (r.centro_custo_id && ccById.get(r.centro_custo_id)?.nome) || "Sem centro de custo",
      contaNome: (r.conta_id && contaById.get(r.conta_id)?.nome) || "—",
      contabilizarDre: cat?.contabilizar_dre !== false,
    };
  });
}

export type GroupTotals = {
  total: number;
  pago: number;
  pendente: number;
  vencido: number;
  qtd: number;
};

export function totalize(rows: LancEnriched[]): GroupTotals {
  const t: GroupTotals = { total: 0, pago: 0, pendente: 0, vencido: 0, qtd: rows.length };
  for (const r of rows) {
    const v = Number(r.valor) || 0;
    t.total += v;
    if (r.statusDerivado === "pago") t.pago += v;
    else if (r.statusDerivado === "vencido") t.vencido += v;
    else t.pendente += v;
  }
  return t;
}

export type Group<K> = { key: K; label: string; sub?: string | null; rows: LancEnriched[]; totals: GroupTotals; pct: number };

export function groupBy<K extends string>(
  rows: LancEnriched[],
  keyFn: (r: LancEnriched) => { key: K; label: string; sub?: string | null },
): Group<K>[] {
  const map = new Map<K, { label: string; sub?: string | null; rows: LancEnriched[] }>();
  for (const r of rows) {
    const k = keyFn(r);
    const g = map.get(k.key);
    if (g) g.rows.push(r);
    else map.set(k.key, { label: k.label, sub: k.sub, rows: [r] });
  }
  const grandTotal = rows.reduce((s, r) => s + Number(r.valor || 0), 0) || 1;
  const result: Group<K>[] = [];
  for (const [key, v] of map.entries()) {
    const totals = totalize(v.rows);
    result.push({ key, label: v.label, sub: v.sub, rows: v.rows, totals, pct: (totals.total / grandTotal) * 100 });
  }
  return result.sort((a, b) => b.totals.total - a.totals.total);
}

export function monthKey(d: string | null): string {
  if (!d) return "0000-00";
  return d.slice(0, 7);
}
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  if (!y || !m) return "—";
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[+m - 1]}/${y}`;
}
