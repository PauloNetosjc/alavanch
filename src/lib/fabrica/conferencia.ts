import { supabase } from "@/integrations/supabase/client";

export type ResultadoBip =
  | "peca_conferida"
  | "volume_criado"
  | "volume_fechado"
  | "etiqueta_impressa"
  | "peca_nao_encontrada"
  | "peca_de_outro_pedido"
  | "peca_ja_conferida"
  | "peca_divergente"
  | "aguardando_par"
  | "ocorrencia_gerada";

export interface BipResultado {
  ok: boolean;
  resultado: ResultadoBip;
  mensagem: string;
  peca?: any;
  volume?: any;
  parcial?: boolean; // true se peça ficou aguardando par
}

/** Normaliza medida para comparação. */
export function medidaKey(p: any): string {
  const l = Number(p.medida_largura) || 0;
  const a = Number(p.medida_altura) || 0;
  const pr = Number(p.medida_profundidade) || 0;
  if (l || a || pr) return `${l}x${a}x${pr}`;
  return String(p.medida_texto || "").trim().toLowerCase().replace(/\s+/g, "");
}

function gerarCodigoVolume(): string {
  return `VOL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

async function proximoNumeroVolume(pedidoId: string): Promise<number> {
  const { data } = await (supabase as any)
    .from("fabrica_volumes")
    .select("numero_volume")
    .eq("pedido_id", pedidoId)
    .order("numero_volume", { ascending: false })
    .limit(1);
  return (data?.[0]?.numero_volume || 0) + 1;
}

async function registrarHistorico(params: {
  pedidoId: string;
  pecaId?: string | null;
  volumeId?: string | null;
  codigoBipado?: string | null;
  resultado: ResultadoBip;
  mensagem: string;
}) {
  const { data: u } = await supabase.auth.getUser();
  await (supabase as any).from("fabrica_conferencia_historico").insert({
    pedido_id: params.pedidoId,
    peca_id: params.pecaId || null,
    volume_id: params.volumeId || null,
    codigo_bipado: params.codigoBipado || null,
    resultado: params.resultado,
    mensagem: params.mensagem,
    usuario_id: u?.user?.id || null,
  });
}

/** Processa um código bipado dentro do contexto do pedido aberto. */
export async function processarBip(
  pedidoId: string,
  codigo: string,
): Promise<BipResultado> {
  const cod = (codigo || "").trim();
  if (!cod) return { ok: false, resultado: "peca_nao_encontrada", mensagem: "Código vazio." };

  // 1) buscar peça em qualquer pedido (para detectar pertencente a outro)
  const { data: pecas } = await (supabase as any)
    .from("fabrica_pecas")
    .select("*")
    .or(`codigo_barras.eq.${cod},codigo_peca.eq.${cod}`)
    .limit(5);

  if (!pecas || pecas.length === 0) {
    const msg = `Peça não encontrada: ${cod}`;
    await registrarHistorico({ pedidoId, codigoBipado: cod, resultado: "peca_nao_encontrada", mensagem: msg });
    return { ok: false, resultado: "peca_nao_encontrada", mensagem: msg };
  }

  const pecaDoPedido = pecas.find((p: any) => p.pedido_id === pedidoId);
  if (!pecaDoPedido) {
    const msg = `Peça pertence a outro pedido (${cod}).`;
    await registrarHistorico({ pedidoId, codigoBipado: cod, pecaId: pecas[0].id, resultado: "peca_de_outro_pedido", mensagem: msg });
    return { ok: false, resultado: "peca_de_outro_pedido", mensagem: msg };
  }

  if (pecaDoPedido.status === "embalada") {
    const msg = `Peça já conferida e embalada (${cod}).`;
    await registrarHistorico({ pedidoId, pecaId: pecaDoPedido.id, codigoBipado: cod, resultado: "peca_ja_conferida", mensagem: msg });
    return { ok: false, resultado: "peca_ja_conferida", mensagem: msg, peca: pecaDoPedido };
  }

  // 2) Verificar se há outra peça pendente com mesma medida (não a própria, não embalada)
  const key = medidaKey(pecaDoPedido);
  const { data: irmasRaw } = await (supabase as any)
    .from("fabrica_pecas")
    .select("*")
    .eq("pedido_id", pedidoId)
    .neq("id", pecaDoPedido.id)
    .in("status", ["aguardando_producao", "produzida", "conferida", "aguardando_par_embalagem"]);
  const irmas = (irmasRaw || []).filter((p: any) => medidaKey(p) === key);

  // Procurar peça-par que JÁ está aguardando_par_embalagem (= primeira já bipada)
  const par = irmas.find((p: any) => p.status === "aguardando_par_embalagem");

  if (par) {
    // 3) Embalagem CONJUNTA — fechar volume com a peça-par + esta peça
    return await criarVolume(pedidoId, [par, pecaDoPedido], "peca_conjunta", cod);
  }

  // 4) Se há outra peça pendente com mesma medida (não bipada ainda) → marcar como aguardando_par_embalagem
  const algumaPendente = irmas.find((p: any) => p.status !== "aguardando_par_embalagem");
  if (algumaPendente) {
    await (supabase as any)
      .from("fabrica_pecas")
      .update({ status: "aguardando_par_embalagem" })
      .eq("id", pecaDoPedido.id);
    const msg = `Existe outra peça com a mesma medida neste pedido: ${algumaPendente.codigo_peca} – ${algumaPendente.descricao || ""}. Separe esta peça para embalagem conjunta. A etiqueta será impressa quando o par for conferido.`;
    await registrarHistorico({ pedidoId, pecaId: pecaDoPedido.id, codigoBipado: cod, resultado: "aguardando_par", mensagem: msg });
    return { ok: true, resultado: "aguardando_par", mensagem: msg, peca: { ...pecaDoPedido, status: "aguardando_par_embalagem" }, parcial: true };
  }

  // 5) Embalagem INDIVIDUAL
  return await criarVolume(pedidoId, [pecaDoPedido], "peca_individual", cod);
}

async function criarVolume(
  pedidoId: string,
  pecas: any[],
  tipo: "peca_individual" | "peca_conjunta",
  codigoBipado: string,
): Promise<BipResultado> {
  const { data: u } = await supabase.auth.getUser();
  const numero = await proximoNumeroVolume(pedidoId);
  const codigo = gerarCodigoVolume();
  const { data: vol, error } = await (supabase as any)
    .from("fabrica_volumes")
    .insert({
      pedido_id: pedidoId,
      numero_volume: numero,
      tipo_volume: tipo,
      status: "etiquetado",
      codigo_barras: codigo,
      quantidade_pecas: pecas.length,
      criado_por: u?.user?.id || null,
    })
    .select("*")
    .single();
  if (error || !vol) {
    return { ok: false, resultado: "peca_divergente", mensagem: error?.message || "Erro ao criar volume." };
  }
  // vincular peças
  await (supabase as any).from("fabrica_volume_pecas").insert(
    pecas.map((p) => ({ volume_id: vol.id, peca_id: p.id, pedido_id: pedidoId, criado_por: u?.user?.id || null })),
  );
  // atualizar peças
  await (supabase as any)
    .from("fabrica_pecas")
    .update({ status: "embalada", volume_id: vol.id })
    .in("id", pecas.map((p) => p.id));

  const desc = pecas.map((p) => p.codigo_peca).join(" + ");
  const msg = tipo === "peca_conjunta"
    ? `Volume conjunto criado (${desc}). Etiqueta pronta para impressão.`
    : `Peça conferida e embalagem individual criada (${desc}).`;
  await registrarHistorico({ pedidoId, pecaId: pecas[pecas.length - 1].id, volumeId: vol.id, codigoBipado, resultado: "volume_criado", mensagem: msg });

  return { ok: true, resultado: "volume_criado", mensagem: msg, volume: { ...vol, pecas }, peca: pecas[pecas.length - 1] };
}

export async function marcarPecaFaltante(pedidoId: string, pecaId: string, obs: string) {
  await (supabase as any).from("fabrica_pecas").update({ status: "faltante" }).eq("id", pecaId);
  await registrarHistorico({ pedidoId, pecaId, resultado: "ocorrencia_gerada", mensagem: `Peça marcada como FALTANTE. ${obs || ""}`.trim() });
}

export async function marcarPecaAvariada(pedidoId: string, pecaId: string, obs: string) {
  await (supabase as any).from("fabrica_pecas").update({ status: "avariada" }).eq("id", pecaId);
  await registrarHistorico({ pedidoId, pecaId, resultado: "ocorrencia_gerada", mensagem: `Peça marcada como AVARIADA. ${obs || ""}`.trim() });
}

export async function registrarImpressao(pedidoId: string, volumeId: string) {
  await registrarHistorico({ pedidoId, volumeId, resultado: "etiqueta_impressa", mensagem: "Etiqueta impressa." });
}

/** Atualiza status_fabrica conforme progresso. */
export async function atualizarStatusFabricaSeNecessario(pedidoId: string) {
  const { data: ped } = await (supabase as any)
    .from("pedidos").select("status_fabrica").eq("id", pedidoId).maybeSingle();
  if (!ped) return;
  const { data: pecas } = await (supabase as any)
    .from("fabrica_pecas").select("status").eq("pedido_id", pedidoId);
  const lista = pecas || [];
  if (lista.length === 0) return;
  const pendentes = lista.filter((p: any) => !["embalada", "faltante"].includes(p.status));
  let novo: string | null = null;
  if (ped.status_fabrica === "aguardando_conferencia") novo = "em_separacao_pecas";
  if (pendentes.length === 0) novo = "aguardando_almoxarifado";
  if (novo && novo !== ped.status_fabrica) {
    await (supabase as any).from("pedidos").update({ status_fabrica: novo }).eq("id", pedidoId);
  }
}
