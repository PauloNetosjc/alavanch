import { supabase } from "@/integrations/supabase/client";

export type ResultadoExp =
  | "volume_bipado"
  | "volume_carregado"
  | "volume_nao_encontrado"
  | "volume_de_outro_pedido"
  | "volume_ja_carregado"
  | "volume_cancelado"
  | "volume_com_problema"
  | "expedicao_finalizada";

export interface ExpBipResultado {
  ok: boolean;
  resultado: ResultadoExp;
  mensagem: string;
  volume?: any;
}

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

async function registrar(p: {
  pedidoId: string;
  volumeId?: string | null;
  codigoBipado?: string | null;
  resultado: ResultadoExp;
  mensagem: string;
}) {
  await (supabase as any).from("fabrica_expedicao_historico").insert({
    pedido_id: p.pedidoId,
    volume_id: p.volumeId || null,
    codigo_bipado: p.codigoBipado || null,
    resultado: p.resultado,
    mensagem: p.mensagem,
    usuario_id: await uid(),
  });
}

export async function listarVolumesPedido(pedidoId: string) {
  const { data } = await (supabase as any)
    .from("fabrica_volumes")
    .select("*")
    .eq("pedido_id", pedidoId)
    .neq("status", "cancelado")
    .order("numero_volume", { ascending: true });
  return data || [];
}

export async function listarHistoricoExp(pedidoId: string, limit = 100) {
  const { data } = await (supabase as any)
    .from("fabrica_expedicao_historico")
    .select("*")
    .eq("pedido_id", pedidoId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

export async function processarBipExpedicao(
  pedidoId: string,
  codigo: string
): Promise<ExpBipResultado> {
  const code = (codigo || "").trim();
  if (!code) {
    return { ok: false, resultado: "volume_nao_encontrado", mensagem: "Código vazio" };
  }

  // Buscar global por código (para detectar de outro pedido)
  const { data: vols } = await (supabase as any)
    .from("fabrica_volumes")
    .select("*")
    .eq("codigo_barras", code)
    .limit(1);
  const vol = vols?.[0];

  if (!vol) {
    await registrar({ pedidoId, codigoBipado: code, resultado: "volume_nao_encontrado", mensagem: `Volume "${code}" não encontrado` });
    return { ok: false, resultado: "volume_nao_encontrado", mensagem: "Volume não encontrado" };
  }
  if (vol.pedido_id !== pedidoId) {
    await registrar({ pedidoId, volumeId: vol.id, codigoBipado: code, resultado: "volume_de_outro_pedido", mensagem: "Volume pertence a outro pedido" });
    return { ok: false, resultado: "volume_de_outro_pedido", mensagem: "Volume pertence a outro pedido", volume: vol };
  }
  if (vol.status === "cancelado") {
    await registrar({ pedidoId, volumeId: vol.id, codigoBipado: code, resultado: "volume_cancelado", mensagem: "Volume cancelado" });
    return { ok: false, resultado: "volume_cancelado", mensagem: "Volume cancelado", volume: vol };
  }
  if (vol.status === "carregado") {
    await registrar({ pedidoId, volumeId: vol.id, codigoBipado: code, resultado: "volume_ja_carregado", mensagem: "Volume já carregado" });
    return { ok: false, resultado: "volume_ja_carregado", mensagem: "Volume já carregado", volume: vol };
  }

  // Carregar
  const userId = await uid();
  const { data: updated, error } = await (supabase as any)
    .from("fabrica_volumes")
    .update({
      status: "carregado",
      carregado_em: new Date().toISOString(),
      carregado_por: userId,
    })
    .eq("id", vol.id)
    .select()
    .single();

  if (error) {
    return { ok: false, resultado: "volume_nao_encontrado", mensagem: error.message };
  }

  await registrar({ pedidoId, volumeId: vol.id, codigoBipado: code, resultado: "volume_carregado", mensagem: `Volume ${vol.numero_volume} carregado` });

  // Garantir status_fabrica = em_expedicao
  await (supabase as any)
    .from("pedidos")
    .update({ status_fabrica: "em_expedicao" })
    .eq("id", pedidoId)
    .in("status_fabrica", ["pronto_para_expedicao"]);

  return { ok: true, resultado: "volume_carregado", mensagem: "Volume carregado", volume: updated };
}

export async function marcarVolumeProblema(volumeId: string, pedidoId: string, motivo: string) {
  await (supabase as any)
    .from("fabrica_volumes")
    .update({ problema_expedicao: true, observacao_expedicao: motivo })
    .eq("id", volumeId);
  await registrar({ pedidoId, volumeId, resultado: "volume_com_problema", mensagem: motivo });
}

export async function resolverProblemaVolume(volumeId: string) {
  await (supabase as any)
    .from("fabrica_volumes")
    .update({ problema_expedicao: false, observacao_expedicao: null })
    .eq("id", volumeId);
}

export interface ResumoExp {
  total: number;
  carregados: number;
  pendentes: number;
  caixas: number;
  problemas: number;
}

export function resumirVolumes(vols: any[]): ResumoExp {
  const total = vols.length;
  const carregados = vols.filter((v) => v.status === "carregado").length;
  const pendentes = total - carregados;
  const caixas = vols.filter((v) => v.tipo_volume === "caixa_almoxarifado").length;
  const problemas = vols.filter((v) => v.problema_expedicao).length;
  return { total, carregados, pendentes, caixas, problemas };
}

export async function finalizarExpedicao(pedidoId: string): Promise<{ ok: boolean; erro?: string }> {
  const vols = await listarVolumesPedido(pedidoId);
  if (vols.length === 0) return { ok: false, erro: "Pedido não possui volumes registrados" };
  const pendentes = vols.filter((v) => v.status !== "carregado");
  if (pendentes.length > 0) return { ok: false, erro: `Existem ${pendentes.length} volume(s) pendente(s)` };
  const problemas = vols.filter((v) => v.problema_expedicao);
  if (problemas.length > 0) return { ok: false, erro: `Resolva ${problemas.length} volume(s) com problema antes de finalizar` };

  const userId = await uid();
  const { error } = await (supabase as any)
    .from("pedidos")
    .update({
      status_fabrica: "expedido",
      fabrica_expedido_em: new Date().toISOString(),
      fabrica_expedido_por: userId,
    })
    .eq("id", pedidoId);
  if (error) return { ok: false, erro: error.message };

  await registrar({ pedidoId, resultado: "expedicao_finalizada", mensagem: "Expedição finalizada" });
  return { ok: true };
}

export const MOTIVOS_PROBLEMA = [
  "Etiqueta ilegível",
  "Volume danificado",
  "Volume não localizado",
  "Divergência de pedido",
  "Outro",
];

export const RESULTADO_EXP_LABEL: Record<string, string> = {
  volume_bipado: "Bipado",
  volume_carregado: "Carregado",
  volume_nao_encontrado: "Não encontrado",
  volume_de_outro_pedido: "Outro pedido",
  volume_ja_carregado: "Já carregado",
  volume_cancelado: "Cancelado",
  volume_com_problema: "Com problema",
  expedicao_finalizada: "Expedição finalizada",
};
