import { supabase } from "@/integrations/supabase/client";

export type LancMatchInput = {
  id: string;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  pedido_id: string | null;
};

export type ComprovanteCandidato = {
  id: string;
  nome: string;
  storage_path: string;
  comissao_id: string | null;
  parceiro_id: string | null;
  created_at: string;
  valor_estimado?: number | null;
};

/** Score de match: 0-100. Considera proximidade de valor e datas. */
export function scoreMatch(
  lancValor: number,
  lancData: string | null,
  compValor: number | null | undefined,
  compData: string | null
): number {
  let score = 0;
  if (compValor != null && lancValor > 0) {
    const diff = Math.abs(compValor - lancValor) / lancValor;
    if (diff <= 0.001) score += 60;
    else if (diff <= 0.01) score += 45;
    else if (diff <= 0.05) score += 25;
  } else {
    score += 10; // sem valor, dá benefício de dúvida menor
  }
  if (lancData && compData) {
    const dl = new Date(lancData).getTime();
    const dc = new Date(compData).getTime();
    const days = Math.abs(dl - dc) / 86400000;
    if (days <= 1) score += 40;
    else if (days <= 3) score += 25;
    else if (days <= 7) score += 10;
  }
  return Math.min(100, score);
}

/** Sugere comprovantes para um lançamento (busca por pedido_id ou parceiro relacionado). */
export async function sugerirComprovantes(
  lanc: LancMatchInput
): Promise<Array<ComprovanteCandidato & { score: number }>> {
  // 1) Busca comissões vinculadas ao mesmo pedido (caso de RT)
  let comissaoIds: string[] = [];
  if (lanc.pedido_id) {
    const { data: coms } = await supabase
      .from("parceiro_comissoes")
      .select("id, valor_calculado, valor_corrigido")
      .eq("pedido_id", lanc.pedido_id);
    comissaoIds = (coms || []).map((c: any) => c.id);
  }

  // 2) Busca comprovantes desses comissões
  let comps: any[] = [];
  if (comissaoIds.length > 0) {
    const { data } = await supabase
      .from("parceiro_comprovantes")
      .select("id, nome, storage_path, comissao_id, parceiro_id, created_at")
      .in("comissao_id", comissaoIds);
    comps = data || [];
  }

  return comps
    .map((c) => ({
      ...c,
      valor_estimado: null,
      score: scoreMatch(lanc.valor, lanc.data_vencimento || lanc.data_pagamento, lanc.valor, c.created_at),
    }))
    .filter((c) => c.score >= 40)
    .sort((a, b) => b.score - a.score);
}

/** Marca um lançamento como conciliado, gravando comprovante e timestamp. */
export async function conciliarLancamento(
  lancId: string,
  comprovantePath: string | null,
  userId: string | null
) {
  const { error } = await supabase
    .from("lancamentos_financeiros")
    .update({
      conciliado: true,
      conciliado_em: new Date().toISOString(),
      conciliado_por: userId,
      comprovante_storage_path: comprovantePath,
    })
    .eq("id", lancId);
  if (error) throw error;
}

export async function desconciliar(lancId: string) {
  const { error } = await supabase
    .from("lancamentos_financeiros")
    .update({ conciliado: false, conciliado_em: null, conciliado_por: null })
    .eq("id", lancId);
  if (error) throw error;
}
