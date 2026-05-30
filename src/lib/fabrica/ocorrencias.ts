import { supabase } from "@/integrations/supabase/client";

export type TipoOcorrencia =
  | "peca_faltante"
  | "peca_avariada"
  | "peca_medida_divergente"
  | "peca_duplicada"
  | "ferragem_item_faltante"
  | "modulo_incompleto"
  | "volume_incompleto"
  | "item_nao_pertence_ao_pedido"
  | "volume_nao_localizado"
  | "volume_com_problema"
  | "divergencia_almoxarifado"
  | "outro";

export type SetorOcorrencia =
  | "corte"
  | "atelie"
  | "conferencia"
  | "almoxarifado"
  | "expedicao"
  | "compras"
  | "engenharia"
  | "projeto"
  | "fabrica"
  | "outro";

export type PrioridadeOcorrencia = "baixa" | "normal" | "alta" | "critica";
export type StatusOcorrencia =
  | "aberta"
  | "em_analise"
  | "em_reproducao"
  | "aguardando_compra"
  | "aguardando_resolucao"
  | "resolvida"
  | "cancelada";

export const TIPO_OCORRENCIA_LABEL: Record<string, string> = {
  peca_faltante: "Peça faltante",
  peca_avariada: "Peça avariada",
  peca_medida_divergente: "Peça com medida divergente",
  peca_duplicada: "Peça duplicada",
  ferragem_item_faltante: "Ferragem / item faltante",
  modulo_incompleto: "Módulo incompleto",
  volume_incompleto: "Volume incompleto",
  item_nao_pertence_ao_pedido: "Item de outro pedido",
  volume_nao_localizado: "Volume não localizado",
  volume_com_problema: "Volume com problema",
  divergencia_almoxarifado: "Divergência de almoxarifado",
  outro: "Outro",
};

export const SETOR_LABEL: Record<string, string> = {
  corte: "Corte",
  atelie: "Ateliê",
  conferencia: "Conferência",
  almoxarifado: "Almoxarifado",
  expedicao: "Expedição",
  compras: "Compras",
  engenharia: "Engenharia",
  projeto: "Projeto",
  fabrica: "Fábrica",
  outro: "Outro",
};

export const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  critica: "Crítica",
};

export const STATUS_OCORRENCIA_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  em_reproducao: "Em reprodução",
  aguardando_compra: "Aguardando compra",
  aguardando_resolucao: "Aguardando resolução",
  resolvida: "Resolvida",
  cancelada: "Cancelada",
};

export const STATUS_ABERTOS: StatusOcorrencia[] = [
  "aberta", "em_analise", "em_reproducao", "aguardando_compra", "aguardando_resolucao",
];

export function prioridadeBadge(p: string | null | undefined) {
  switch (p) {
    case "critica": return "bg-red-100 text-red-800 border-red-200";
    case "alta": return "bg-orange-100 text-orange-800 border-orange-200";
    case "normal": return "bg-blue-100 text-blue-800 border-blue-200";
    case "baixa": return "bg-muted text-foreground border-border";
    default: return "bg-muted text-foreground border-border";
  }
}

export function statusOcorrenciaBadge(s: string | null | undefined) {
  switch (s) {
    case "resolvida": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "cancelada": return "bg-muted text-muted-foreground border-border";
    case "aberta": return "bg-red-100 text-red-800 border-red-200";
    case "em_analise":
    case "em_reproducao": return "bg-amber-100 text-amber-800 border-amber-200";
    case "aguardando_compra":
    case "aguardando_resolucao": return "bg-violet-100 text-violet-800 border-violet-200";
    default: return "bg-muted text-foreground border-border";
  }
}

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

export interface CriarOcorrenciaInput {
  pedido_id: string;
  tipo_ocorrencia: TipoOcorrencia;
  setor_responsavel?: SetorOcorrencia;
  prioridade?: PrioridadeOcorrencia;
  titulo: string;
  descricao?: string;
  modulo_id?: string | null;
  peca_id?: string | null;
  almoxarifado_item_id?: string | null;
  volume_id?: string | null;
  lote_id?: string | null;
  loja_id?: string | null;
  quantidade_afetada?: number | null;
  responsavel_id?: string | null;
  data_previsao_resolucao?: string | null;
  observacoes?: string | null;
  bloqueante?: boolean;
}

export const TIPOS_BLOQUEANTES: TipoOcorrencia[] = [
  "peca_faltante", "ferragem_item_faltante", "volume_incompleto",
];

export async function criarOcorrencia(input: CriarOcorrenciaInput) {
  const userId = await uid();

  // resolver loja_id do pedido se não vier
  let loja_id = input.loja_id;
  let status_atual: string | null = null;
  if (!loja_id || input.bloqueante !== false) {
    const { data: p } = await (supabase as any)
      .from("pedidos")
      .select("loja_id, status_fabrica")
      .eq("id", input.pedido_id)
      .maybeSingle();
    if (!loja_id) loja_id = p?.loja_id ?? null;
    status_atual = p?.status_fabrica ?? null;
  }

  const bloqueante = input.bloqueante ?? TIPOS_BLOQUEANTES.includes(input.tipo_ocorrencia);

  const { data, error } = await (supabase as any)
    .from("fabrica_ocorrencias")
    .insert({
      pedido_id: input.pedido_id,
      lote_id: input.lote_id ?? null,
      loja_id,
      modulo_id: input.modulo_id ?? null,
      peca_id: input.peca_id ?? null,
      almoxarifado_item_id: input.almoxarifado_item_id ?? null,
      volume_id: input.volume_id ?? null,
      tipo_ocorrencia: input.tipo_ocorrencia,
      setor_responsavel: input.setor_responsavel ?? "fabrica",
      prioridade: input.prioridade ?? "normal",
      status: "aberta",
      titulo: input.titulo,
      descricao: input.descricao ?? null,
      quantidade_afetada: input.quantidade_afetada ?? null,
      responsavel_id: input.responsavel_id ?? null,
      data_previsao_resolucao: input.data_previsao_resolucao ?? null,
      observacoes: input.observacoes ?? null,
      bloqueante,
      aberto_por: userId,
      atualizado_por: userId,
    })
    .select()
    .single();

  if (error) throw error;

  await registrarEvento(data.id, {
    tipo_evento: "ocorrencia_criada",
    descricao: `Ocorrência ${data.codigo || ""} criada (${TIPO_OCORRENCIA_LABEL[input.tipo_ocorrencia] || input.tipo_ocorrencia})`,
    status_novo: "aberta",
  });

  // Atualizar status/estado do recurso relacionado
  if (input.peca_id) {
    const novoStatus = input.tipo_ocorrencia === "peca_faltante" ? "faltante"
      : input.tipo_ocorrencia === "peca_avariada" ? "avariada"
      : input.tipo_ocorrencia === "peca_medida_divergente" ? "divergente"
      : input.tipo_ocorrencia === "peca_duplicada" ? "duplicada" : null;
    if (novoStatus) {
      await (supabase as any).from("fabrica_pecas").update({ status: novoStatus }).eq("id", input.peca_id);
    }
  }
  if (input.almoxarifado_item_id && input.tipo_ocorrencia === "ferragem_item_faltante") {
    await (supabase as any).from("fabrica_almoxarifado_itens").update({ status: "faltante", item_faltante: true }).eq("id", input.almoxarifado_item_id);
  }
  if (input.volume_id && (input.tipo_ocorrencia === "volume_com_problema" || input.tipo_ocorrencia === "volume_nao_localizado")) {
    await (supabase as any).from("fabrica_volumes").update({ problema_expedicao: true, observacao_expedicao: input.titulo }).eq("id", input.volume_id);
  }

  // Atualizar status_fabrica se bloqueante (e não estiver expedido)
  if (bloqueante && status_atual && !["expedido", "ocorrencia_peca_faltante"].includes(status_atual)) {
    await (supabase as any)
      .from("pedidos")
      .update({ status_fabrica: "ocorrencia_peca_faltante", status_fabrica_anterior: status_atual })
      .eq("id", input.pedido_id);
  }

  return data;
}

export async function registrarEvento(ocorrenciaId: string, p: {
  tipo_evento: string;
  descricao?: string;
  status_anterior?: string | null;
  status_novo?: string | null;
  dados_anteriores?: any;
  dados_novos?: any;
}) {
  const userId = await uid();
  await (supabase as any).from("fabrica_ocorrencias_historico").insert({
    ocorrencia_id: ocorrenciaId,
    tipo_evento: p.tipo_evento,
    descricao: p.descricao ?? null,
    status_anterior: p.status_anterior ?? null,
    status_novo: p.status_novo ?? null,
    dados_anteriores: p.dados_anteriores ?? null,
    dados_novos: p.dados_novos ?? null,
    criado_por: userId,
  });
}

export async function alterarStatus(ocorrenciaId: string, novoStatus: StatusOcorrencia, observacao?: string, solucao?: string) {
  const { data: atual } = await (supabase as any)
    .from("fabrica_ocorrencias")
    .select("status")
    .eq("id", ocorrenciaId)
    .maybeSingle();
  const userId = await uid();
  const patch: any = { status: novoStatus, atualizado_por: userId };
  if (novoStatus === "resolvida") {
    patch.data_resolucao = new Date().toISOString();
    if (solucao) patch.solucao_descricao = solucao;
  }
  await (supabase as any).from("fabrica_ocorrencias").update(patch).eq("id", ocorrenciaId);
  await registrarEvento(ocorrenciaId, {
    tipo_evento: novoStatus === "resolvida" ? "ocorrencia_resolvida"
      : novoStatus === "cancelada" ? "ocorrencia_cancelada"
      : "status_alterado",
    descricao: observacao || `Status alterado para ${STATUS_OCORRENCIA_LABEL[novoStatus]}`,
    status_anterior: atual?.status ?? null,
    status_novo: novoStatus,
  });
}

export async function listarOcorrencias(filtros: {
  lojaId?: string | null;
  pedidoId?: string | null;
  status?: string[];
  tipos?: string[];
  setor?: string | null;
  prioridade?: string | null;
  busca?: string | null;
  limit?: number;
} = {}) {
  let q = (supabase as any)
    .from("fabrica_ocorrencias")
    .select("*, pedido:pedidos(codigo, cliente:clientes(nome), loja:lojas(nome), status_fabrica)")
    .order("created_at", { ascending: false })
    .limit(filtros.limit ?? 500);
  if (filtros.lojaId) q = q.eq("loja_id", filtros.lojaId);
  if (filtros.pedidoId) q = q.eq("pedido_id", filtros.pedidoId);
  if (filtros.status?.length) q = q.in("status", filtros.status);
  if (filtros.tipos?.length) q = q.in("tipo_ocorrencia", filtros.tipos);
  if (filtros.setor) q = q.eq("setor_responsavel", filtros.setor);
  if (filtros.prioridade) q = q.eq("prioridade", filtros.prioridade);
  if (filtros.busca) {
    const t = filtros.busca.trim();
    q = q.or(`titulo.ilike.%${t}%,descricao.ilike.%${t}%,codigo.ilike.%${t}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listarHistoricoOcorrencia(ocorrenciaId: string) {
  const { data } = await (supabase as any)
    .from("fabrica_ocorrencias_historico")
    .select("*")
    .eq("ocorrencia_id", ocorrenciaId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function listarAnexosOcorrencia(ocorrenciaId: string) {
  const { data } = await (supabase as any)
    .from("fabrica_ocorrencias_anexos")
    .select("*")
    .eq("ocorrencia_id", ocorrenciaId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function uploadAnexo(ocorrenciaId: string, file: File) {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${ocorrenciaId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("fabrica-ocorrencias").upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) throw upErr;
  const userId = await uid();
  await (supabase as any).from("fabrica_ocorrencias_anexos").insert({
    ocorrencia_id: ocorrenciaId,
    nome_arquivo: file.name,
    url_arquivo: path,
    mime_type: file.type || null,
    tamanho_bytes: file.size,
    criado_por: userId,
  });
  await registrarEvento(ocorrenciaId, { tipo_evento: "anexo_adicionado", descricao: file.name });
}

export async function urlAssinadaAnexo(path: string) {
  const { data } = await supabase.storage.from("fabrica-ocorrencias").createSignedUrl(path, 3600);
  return data?.signedUrl || "";
}

export async function removerAnexo(id: string, path: string) {
  await supabase.storage.from("fabrica-ocorrencias").remove([path]);
  await (supabase as any).from("fabrica_ocorrencias_anexos").delete().eq("id", id);
}

export async function atribuirResponsavel(ocorrenciaId: string, responsavelId: string | null) {
  await (supabase as any).from("fabrica_ocorrencias").update({ responsavel_id: responsavelId }).eq("id", ocorrenciaId);
  await registrarEvento(ocorrenciaId, { tipo_evento: "responsavel_alterado", descricao: responsavelId ? "Responsável atribuído" : "Responsável removido" });
}

export async function retomarFluxo(pedidoId: string, novoStatus: string) {
  await (supabase as any)
    .from("pedidos")
    .update({ status_fabrica: novoStatus, status_fabrica_anterior: null })
    .eq("id", pedidoId);
}
