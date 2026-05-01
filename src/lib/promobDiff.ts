import type { PromobItem } from "./promobParser";

export type DiffStatus = "mantido" | "alterado" | "adicionado" | "removido";

export interface DiffItem {
  status: DiffStatus;
  descricao: string;
  qtd_original?: number;
  qtd_revisada?: number;
  valor_original?: number;
  valor_revisado?: number;
  diff_qtd?: number;
  diff_valor?: number;
}

export interface DiffResult {
  itens: DiffItem[];
  totals: {
    mantidos: number;
    alterados: number;
    adicionados: number;
    removidos: number;
    valorOriginal: number;
    valorRevisado: number;
    variacao: number; // valor
    variacaoPerc: number;
  };
}

const keyOf = (it: { description?: string; descricao?: string }) =>
  ((it.description ?? it.descricao ?? "") as string).trim().toLowerCase();

/** Compara duas listas de itens Promob por descrição (chave). */
export function diffPromobItems(
  originais: Array<Pick<PromobItem, "description" | "quantity" | "clientPrice" | "storePrice">> | any[],
  revisados: Array<Pick<PromobItem, "description" | "quantity" | "clientPrice" | "storePrice">> | any[],
  precoField: "clientPrice" | "storePrice" = "clientPrice",
): DiffResult {
  const orig = new Map<string, any>();
  for (const it of originais) {
    const k = keyOf(it);
    if (!k) continue;
    orig.set(k, { ...it, _qtd: it.quantity ?? it.quantidade ?? 1, _val: (it as any)[precoField] ?? (it as any).custo_cliente ?? 0 });
  }
  const rev = new Map<string, any>();
  for (const it of revisados) {
    const k = keyOf(it);
    if (!k) continue;
    rev.set(k, { ...it, _qtd: it.quantity ?? it.quantidade ?? 1, _val: (it as any)[precoField] ?? (it as any).custo_cliente ?? 0 });
  }

  const itens: DiffItem[] = [];
  let valOrig = 0, valRev = 0;
  let mantidos = 0, alterados = 0, adicionados = 0, removidos = 0;

  // Mantidos / alterados / removidos
  for (const [k, o] of orig) {
    valOrig += (o._val * o._qtd);
    if (rev.has(k)) {
      const r = rev.get(k);
      valRev += (r._val * r._qtd);
      const mudou = r._qtd !== o._qtd || Math.abs(r._val - o._val) > 0.005;
      if (mudou) {
        alterados++;
        itens.push({
          status: "alterado",
          descricao: o.description ?? o.descricao,
          qtd_original: o._qtd, qtd_revisada: r._qtd,
          valor_original: o._val, valor_revisado: r._val,
          diff_qtd: r._qtd - o._qtd, diff_valor: (r._val * r._qtd) - (o._val * o._qtd),
        });
      } else {
        mantidos++;
        itens.push({
          status: "mantido",
          descricao: o.description ?? o.descricao,
          qtd_original: o._qtd, qtd_revisada: r._qtd,
          valor_original: o._val, valor_revisado: r._val,
        });
      }
    } else {
      removidos++;
      itens.push({
        status: "removido",
        descricao: o.description ?? o.descricao,
        qtd_original: o._qtd,
        valor_original: o._val,
        diff_valor: -(o._val * o._qtd),
      });
    }
  }
  // Adicionados
  for (const [k, r] of rev) {
    if (orig.has(k)) continue;
    valRev += (r._val * r._qtd);
    adicionados++;
    itens.push({
      status: "adicionado",
      descricao: r.description ?? r.descricao,
      qtd_revisada: r._qtd,
      valor_revisado: r._val,
      diff_valor: r._val * r._qtd,
    });
  }

  const variacao = valRev - valOrig;
  const variacaoPerc = valOrig > 0 ? (variacao / valOrig) * 100 : 0;

  return {
    itens,
    totals: { mantidos, alterados, adicionados, removidos, valorOriginal: valOrig, valorRevisado: valRev, variacao, variacaoPerc },
  };
}
