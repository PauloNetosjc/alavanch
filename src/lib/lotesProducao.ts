import { supabase } from "@/integrations/supabase/client";

export type EtapaFabrica = {
  id: string;
  chave: string;
  nome: string;
  ordem: number;
  cor_hex: string | null;
  prazo_dias_uteis: number | null;
  ativo: boolean;
  loja_id: string | null;
};

export type LoteProducao = {
  id: string;
  numero_lote: string;
  descricao: string | null;
  data_criacao: string;
  data_previsao_conclusao: string | null;
  status_lote: "rascunho" | "em_producao" | "concluido" | "cancelado";
  responsavel_id: string | null;
  loja_id: string | null;
  created_at: string;
};

export type LotePedido = {
  id: string;
  lote_id: string;
  pedido_id: string;
  etapa_atual: string;
  data_inclusao: string;
};

/** Busca etapas ativas (loja atual + globais), ordenadas. */
export async function carregarEtapasFabrica(lojaId: string | null): Promise<EtapaFabrica[]> {
  let q = (supabase as any).from("etapas_kanban_fabrica").select("*").eq("ativo", true).order("ordem", { ascending: true });
  if (lojaId) {
    q = q.or(`loja_id.is.null,loja_id.eq.${lojaId}`);
  } else {
    q = q.is("loja_id", null);
  }
  const { data, error } = await q;
  if (error) throw error;
  // se houver duplicado loja vs global pela mesma chave, prevalece o da loja
  const map = new Map<string, EtapaFabrica>();
  for (const e of (data || []) as EtapaFabrica[]) {
    const cur = map.get(e.chave);
    if (!cur || (cur.loja_id == null && e.loja_id != null)) map.set(e.chave, e);
  }
  return Array.from(map.values()).sort((a, b) => a.ordem - b.ordem);
}

/** Gera próximo número de lote via RPC. */
export async function gerarNumeroLote(lojaId: string | null): Promise<string> {
  const { data, error } = await (supabase as any).rpc("proximo_numero_lote", { _loja_id: lojaId });
  if (error) throw error;
  return String(data);
}

/** Cria lote + adiciona pedidos + atualiza status_fabrica='em_producao'. */
export async function criarLoteComPedidos(params: {
  lojaId: string | null;
  descricao: string | null;
  dataPrevisaoConclusao: string | null;
  pedidoIds: string[];
}): Promise<LoteProducao> {
  const numero = await gerarNumeroLote(params.lojaId);
  const { data: lote, error: e1 } = await (supabase as any)
    .from("lotes_producao")
    .insert({
      numero_lote: numero,
      descricao: params.descricao,
      data_previsao_conclusao: params.dataPrevisaoConclusao,
      status_lote: "em_producao",
      loja_id: params.lojaId,
    })
    .select("*")
    .single();
  if (e1) throw e1;

  if (params.pedidoIds.length > 0) {
    const rows = params.pedidoIds.map((pid, idx) => ({
      lote_id: lote.id,
      pedido_id: pid,
      etapa_atual: "corte",
      posicao_ordem: idx,
    }));
    const { error: e2 } = await (supabase as any).from("lote_pedidos").insert(rows);
    if (e2) throw e2;

    // histórico inicial
    const hist = params.pedidoIds.map((pid) => ({
      pedido_id: pid,
      lote_id: lote.id,
      etapa_chave: "corte",
    }));
    await (supabase as any).from("pedido_etapa_fabrica").insert(hist);

    // atualiza status_fabrica dos pedidos
    await (supabase as any)
      .from("pedidos")
      .update({ status_fabrica: "em_producao" })
      .in("id", params.pedidoIds);
  }

  return lote as LoteProducao;
}

/** Move card (pedido em lote) para outra etapa. Registra histórico. */
export async function moverPedidoEtapa(params: {
  lotePedidoId: string;
  pedidoId: string;
  loteId: string;
  etapaAnterior: string;
  etapaNova: string;
}) {
  // fecha etapa anterior no histórico
  await (supabase as any)
    .from("pedido_etapa_fabrica")
    .update({ data_saida: new Date().toISOString() })
    .eq("pedido_id", params.pedidoId)
    .eq("lote_id", params.loteId)
    .eq("etapa_chave", params.etapaAnterior)
    .is("data_saida", null);

  // abre nova etapa no histórico
  await (supabase as any).from("pedido_etapa_fabrica").insert({
    pedido_id: params.pedidoId,
    lote_id: params.loteId,
    etapa_chave: params.etapaNova,
  });

  // atualiza etapa atual no lote_pedidos
  await (supabase as any)
    .from("lote_pedidos")
    .update({ etapa_atual: params.etapaNova })
    .eq("id", params.lotePedidoId);

  // se chegou em expedição, status_fabrica = concluido_fabrica
  if (params.etapaNova === "expedicao") {
    await (supabase as any)
      .from("pedidos")
      .update({ status_fabrica: "concluido_fabrica" })
      .eq("id", params.pedidoId);
  }
}

export async function concluirLote(loteId: string) {
  const { error } = await (supabase as any)
    .from("lotes_producao")
    .update({ status_lote: "concluido" })
    .eq("id", loteId);
  if (error) throw error;
}

export async function cancelarLote(loteId: string) {
  const { error } = await (supabase as any)
    .from("lotes_producao")
    .update({ status_lote: "cancelado" })
    .eq("id", loteId);
  if (error) throw error;
}
