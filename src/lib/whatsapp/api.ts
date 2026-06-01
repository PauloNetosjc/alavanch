import { supabase } from "@/integrations/supabase/client";

export type WhatsappStatusResponse = {
  configured: boolean;
  secrets: { WHATSAPP_GATEWAY_URL: boolean; WHATSAPP_GATEWAY_SECRET: boolean };
  gateway: { ok: boolean; status?: number; latency_ms?: number; erro?: string };
  contas: Array<{
    id: string;
    nome: string;
    tipo_integracao: "whatsapp_web" | "cloud_api";
    status_conexao: string;
    numero_conectado: string | null;
    historico_sync_status: string;
    ultima_conexao_em: string | null;
  }>;
  aviso: string;
};

export async function fetchWhatsappStatus(): Promise<WhatsappStatusResponse> {
  const { data, error } = await supabase.functions.invoke("whatsapp-status", { body: {} });
  if (error) throw error;
  return data as WhatsappStatusResponse;
}

export async function whatsappGerarQr(conta_id: string) {
  const { data, error } = await supabase.functions.invoke("whatsapp-qr", { body: { conta_id } });
  if (error) throw error;
  return data as { ok: boolean; configured?: boolean; status?: string; qr_code?: string | null; erro?: string };
}

export async function whatsappDesconectar(conta_id: string) {
  // Atualização local + tentativa via gateway (gateway encerra sessão no próximo /sessions/stop).
  await supabase
    .from("whatsapp_contas")
    .update({ status_conexao: "desconectado", qr_code: null })
    .eq("id", conta_id);
}

export async function whatsappSincronizarHistorico(conta_id: string) {
  const { data, error } = await supabase.functions.invoke("whatsapp-sync-historico", { body: { conta_id } });
  if (error) throw error;
  return data as { ok: boolean; erro?: string };
}

export async function whatsappEnviarMensagem(conta_id: string, to: string, text: string) {
  const { data, error } = await supabase.functions.invoke("whatsapp-enviar", { body: { conta_id, to, text } });
  if (error) throw error;
  return data as { ok: boolean; id?: string; erro?: string };
}
