import { supabase } from "@/integrations/supabase/client";

export type ResultadoAlmox =
  | "item_bipado"
  | "item_separado_parcial"
  | "item_separado_completo"
  | "caixa_criada"
  | "caixa_fechada"
  | "etiqueta_impressa"
  | "item_faltante"
  | "item_nao_encontrado"
  | "item_de_outro_pedido"
  | "item_ja_completo"
  | "separacao_finalizada";

export interface AlmoxBipResultado {
  ok: boolean;
  resultado: ResultadoAlmox;
  mensagem: string;
  item?: any;
  pendente?: number;
}

async function registrarHistorico(p: {
  pedidoId: string;
  itemId?: string | null;
  volumeId?: string | null;
  codigoBipado?: string | null;
  resultado: ResultadoAlmox;
  mensagem: string;
  quantidade?: number | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  await (supabase as any).from("fabrica_almoxarifado_historico").insert({
    pedido_id: p.pedidoId,
    item_id: p.itemId || null,
    volume_id: p.volumeId || null,
    codigo_bipado: p.codigoBipado || null,
    resultado: p.resultado,
    mensagem: p.mensagem,
    quantidade: p.quantidade ?? null,
    usuario_id: u?.user?.id || null,
  });
}

async function proximoNumeroCaixa(pedidoId: string): Promise<number> {
  const { data } = await (supabase as any)
    .from("fabrica_volumes")
    .select("numero_volume")
    .eq("pedido_id", pedidoId)
    .order("numero_volume", { ascending: false })
    .limit(1);
  return (data?.[0]?.numero_volume || 0) + 1;
}

export async function caixaAbertaDoPedido(pedidoId: string) {
  const { data } = await (supabase as any)
    .from("fabrica_volumes")
    .select("*")
    .eq("pedido_id", pedidoId)
    .eq("tipo_volume", "caixa_almoxarifado")
    .eq("status", "aberto")
    .order("numero_volume", { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

export async function criarCaixa(pedidoId: string, codigoPedido?: string | null) {
  const numero = await proximoNumeroCaixa(pedidoId);
  const codigo = `CX-${(codigoPedido || pedidoId.slice(0, 6)).toString().toUpperCase()}-${numero}`;
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await (supabase as any)
    .from("fabrica_volumes")
    .insert({
      pedido_id: pedidoId,
      numero_volume: numero,
      tipo_volume: "caixa_almoxarifado",
      status: "aberto",
      codigo_barras: codigo,
      quantidade_pecas: 0,
      criado_por: u?.user?.id || null,
    })
    .select()
    .single();
  if (error) throw error;
  await registrarHistorico({
    pedidoId,
    volumeId: data.id,
    resultado: "caixa_criada",
    mensagem: `Caixa ${numero} criada.`,
  });
  return data;
}

export async function fecharCaixa(volumeId: string, pedidoId: string) {
  const { data: itens } = await (supabase as any)
    .from("fabrica_volume_almoxarifado_itens")
    .select("id, quantidade")
    .eq("volume_id", volumeId);
  const total = (itens || []).reduce((s: number, i: any) => s + Number(i.quantidade || 0), 0);
  if (!itens?.length) {
    return { ok: false, mensagem: "Caixa vazia. Inclua itens ou cancele a caixa." };
  }
  const { data: u } = await supabase.auth.getUser();
  await (supabase as any)
    .from("fabrica_volumes")
    .update({ status: "fechado", quantidade_pecas: total, atualizado_por: u?.user?.id || null })
    .eq("id", volumeId);
  await registrarHistorico({
    pedidoId,
    volumeId,
    resultado: "caixa_fechada",
    mensagem: `Caixa fechada com ${total} item(ns).`,
  });
  return { ok: true };
}

export async function cancelarCaixa(volumeId: string, pedidoId: string) {
  const { data: u } = await supabase.auth.getUser();
  await (supabase as any)
    .from("fabrica_volumes")
    .update({ status: "cancelado", atualizado_por: u?.user?.id || null })
    .eq("id", volumeId);
  await registrarHistorico({
    pedidoId,
    volumeId,
    resultado: "caixa_fechada",
    mensagem: "Caixa cancelada.",
  });
}

export async function marcarEtiquetaImpressa(volumeId: string, pedidoId: string) {
  const { data: u } = await supabase.auth.getUser();
  await (supabase as any)
    .from("fabrica_volumes")
    .update({ status: "etiquetado", atualizado_por: u?.user?.id || null })
    .eq("id", volumeId);
  await registrarHistorico({
    pedidoId,
    volumeId,
    resultado: "etiqueta_impressa",
    mensagem: "Etiqueta impressa.",
  });
}

export async function processarBipAlmox(
  pedidoId: string,
  codigo: string,
): Promise<AlmoxBipResultado> {
  const cod = (codigo || "").trim();
  if (!cod) return { ok: false, resultado: "item_nao_encontrado", mensagem: "Código vazio." };

  // Busca o item por código_barras ou referência em qualquer pedido
  const { data: itens } = await (supabase as any)
    .from("fabrica_almoxarifado_itens")
    .select("*")
    .or(`codigo_barras.eq.${cod},referencia.eq.${cod}`)
    .limit(5);

  if (!itens?.length) {
    await registrarHistorico({
      pedidoId,
      codigoBipado: cod,
      resultado: "item_nao_encontrado",
      mensagem: "Item não encontrado",
    });
    return { ok: false, resultado: "item_nao_encontrado", mensagem: "Item não encontrado." };
  }

  const doPedido = itens.find((i: any) => i.pedido_id === pedidoId);
  if (!doPedido) {
    await registrarHistorico({
      pedidoId,
      codigoBipado: cod,
      resultado: "item_de_outro_pedido",
      mensagem: "Item pertence a outro pedido",
    });
    return { ok: false, resultado: "item_de_outro_pedido", mensagem: "Item pertence a outro pedido." };
  }

  if (doPedido.status === "separado_completo") {
    await registrarHistorico({
      pedidoId,
      itemId: doPedido.id,
      codigoBipado: cod,
      resultado: "item_ja_completo",
      mensagem: "Item já separado completo",
    });
    return { ok: false, resultado: "item_ja_completo", mensagem: "Item já separado completo.", item: doPedido };
  }

  const pendente = Math.max(0, Number(doPedido.quantidade_necessaria || 0) - Number(doPedido.quantidade_separada || 0));
  await registrarHistorico({
    pedidoId,
    itemId: doPedido.id,
    codigoBipado: cod,
    resultado: "item_bipado",
    mensagem: `Item ${doPedido.referencia} bipado. Pendente: ${pendente}.`,
  });

  return { ok: true, resultado: "item_bipado", mensagem: "Item localizado.", item: doPedido, pendente };
}

export async function adicionarItemNaCaixa(p: {
  pedidoId: string;
  itemId: string;
  volumeId: string;
  quantidade: number;
}) {
  const { data: item, error: e1 } = await (supabase as any)
    .from("fabrica_almoxarifado_itens")
    .select("*")
    .eq("id", p.itemId)
    .single();
  if (e1 || !item) throw new Error("Item não encontrado");

  const novaQtd = Number(item.quantidade_separada || 0) + Number(p.quantidade || 0);
  const necessaria = Number(item.quantidade_necessaria || 0);
  let novoStatus: string = "pendente";
  if (novaQtd <= 0) novoStatus = "pendente";
  else if (novaQtd >= necessaria) novoStatus = "separado_completo";
  else novoStatus = "separado_parcial";

  const { data: u } = await supabase.auth.getUser();
  await (supabase as any).from("fabrica_volume_almoxarifado_itens").insert({
    volume_id: p.volumeId,
    almoxarifado_item_id: p.itemId,
    pedido_id: p.pedidoId,
    quantidade: p.quantidade,
    criado_por: u?.user?.id || null,
  });

  await (supabase as any)
    .from("fabrica_almoxarifado_itens")
    .update({
      quantidade_separada: novaQtd,
      status: novoStatus,
      atualizado_por: u?.user?.id || null,
    })
    .eq("id", p.itemId);

  await registrarHistorico({
    pedidoId: p.pedidoId,
    itemId: p.itemId,
    volumeId: p.volumeId,
    resultado: novoStatus === "separado_completo" ? "item_separado_completo" : "item_separado_parcial",
    mensagem: `+${p.quantidade} ${item.unidade || ""} em ${item.referencia}`.trim(),
    quantidade: p.quantidade,
  });

  return { ok: true, status: novoStatus };
}

export async function informarFalta(p: {
  pedidoId: string;
  itemId: string;
  quantidade?: number;
  observacao?: string;
}) {
  const { data: u } = await supabase.auth.getUser();
  await (supabase as any)
    .from("fabrica_almoxarifado_itens")
    .update({
      status: "faltante",
      observacoes: p.observacao || null,
      atualizado_por: u?.user?.id || null,
    })
    .eq("id", p.itemId);
  await registrarHistorico({
    pedidoId: p.pedidoId,
    itemId: p.itemId,
    resultado: "item_faltante",
    mensagem: p.observacao || "Item marcado como faltante",
    quantidade: p.quantidade ?? null,
  });
}

/** Calcula próximo status_fabrica a partir do estado das peças+almox. */
export async function finalizarSeparacaoAlmox(pedidoId: string) {
  // Validar itens pendentes
  const { data: itens } = await (supabase as any)
    .from("fabrica_almoxarifado_itens")
    .select("id, referencia, status, quantidade_necessaria, quantidade_separada")
    .eq("pedido_id", pedidoId);

  const pendencias = (itens || []).filter(
    (i: any) => i.status !== "separado_completo" && i.status !== "faltante" && i.status !== "substituido",
  );
  if (pendencias.length) {
    return { ok: false, mensagem: `Há ${pendencias.length} item(ns) pendentes.`, pendencias };
  }

  // Verificar se há caixa aberta
  const caixa = await caixaAbertaDoPedido(pedidoId);
  if (caixa) {
    return { ok: false, mensagem: "Há uma caixa aberta. Feche ou cancele antes de finalizar.", caixa };
  }

  // Verificar peças do pedido
  const { data: pecas } = await (supabase as any)
    .from("fabrica_pecas")
    .select("id, status")
    .eq("pedido_id", pedidoId);
  const pecasOk = !pecas?.length || pecas.every((p: any) => p.status === "embalada" || p.status === "faltante" || p.status === "avariada");
  const temFaltante =
    (itens || []).some((i: any) => i.status === "faltante") ||
    (pecas || []).some((p: any) => p.status === "faltante");

  let novoStatus = "pronto_para_expedicao";
  if (temFaltante) novoStatus = "ocorrencia_peca_faltante";
  else if (!pecasOk) novoStatus = "aguardando_conferencia";

  await (supabase as any).from("pedidos").update({ status_fabrica: novoStatus }).eq("id", pedidoId);

  await registrarHistorico({
    pedidoId,
    resultado: "separacao_finalizada",
    mensagem: `Separação finalizada. Status: ${novoStatus}.`,
  });

  return { ok: true, status: novoStatus };
}
