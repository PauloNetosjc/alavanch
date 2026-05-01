import { supabase } from "@/integrations/supabase/client";

/**
 * Registra um evento de auditoria na timeline de uma assistência.
 */
export async function logAssistenciaEvent(
  assistenciaId: string,
  tipo: string,
  descricao: string,
  metadata: Record<string, any> = {}
) {
  try {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("timeline_eventos").insert({
      entidade_tipo: "assistencia",
      entidade_id: assistenciaId,
      tipo,
      descricao,
      usuario_id: u.user?.id ?? null,
      metadata,
    });
  } catch (e) {
    console.error("logAssistenciaEvent failed", e);
  }
}

/**
 * Cria notificações in-app para um conjunto de usuários.
 * Tenta também disparar e-mail/WhatsApp via edge function (silencioso se não configurado).
 */
export async function notifyAssistencia(opts: {
  assistenciaId: string;
  userIds: (string | null | undefined)[];
  tipo: string;
  titulo: string;
  mensagem?: string;
  link?: string;
  metadata?: Record<string, any>;
}) {
  const ids = Array.from(new Set(opts.userIds.filter(Boolean) as string[]));
  if (ids.length === 0) return;
  const rows = ids.map((uid) => ({
    user_id: uid,
    tipo: opts.tipo,
    titulo: opts.titulo,
    mensagem: opts.mensagem ?? null,
    link: opts.link ?? `/meus-chamados/${opts.assistenciaId}`,
    metadata: opts.metadata ?? null,
  }));
  await supabase.from("notificacoes").insert(rows);

  // Disparo opcional (silencioso) por edge function
  try {
    await supabase.functions.invoke("notify-assistencia", {
      body: {
        assistencia_id: opts.assistenciaId,
        user_ids: ids,
        tipo: opts.tipo,
        titulo: opts.titulo,
        mensagem: opts.mensagem,
      },
    });
  } catch {
    // Função não obrigatória
  }
}

/**
 * Retorna ids de admins (para incluir em notificações de mudanças).
 */
export async function getAdminUserIds(): Promise<string[]> {
  const { data } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  return (data || []).map((r: any) => r.user_id);
}
