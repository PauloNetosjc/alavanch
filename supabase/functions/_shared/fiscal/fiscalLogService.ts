// fiscalLogService — registra eventos amigáveis e logs técnicos.
// IMPORTANTE: nunca grava senha, PFX, certificado, headers de auth.
// Recebe um supabase client com SERVICE_ROLE (a função já validou JWT do usuário antes).

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export type EventoNfe =
  | "emissao_iniciada"
  | "xml_gerado"
  | "xml_assinado"
  | "xml_validado"
  | "lote_enviado"
  | "recibo_recebido"
  | "consulta_recibo"
  | "autorizada"
  | "rejeitada"
  | "erro_transmissao"
  | "cancelamento_solicitado"
  | "cancelada";

export async function registrarEvento(
  supabase: SupabaseLike,
  params: {
    nota_fiscal_id: string;
    loja_id: string | null;
    tipo: EventoNfe;
    descricao?: string;
    payload?: Record<string, unknown>;
    user_id?: string | null;
  },
) {
  try {
    await supabase.from("notas_fiscais_eventos").insert({
      nota_fiscal_id: params.nota_fiscal_id,
      tipo: params.tipo,
      descricao: params.descricao ?? params.tipo,
      payload: params.payload ?? null,
      created_by: params.user_id ?? null,
    });
  } catch (e) {
    console.error("[fiscalLog] evento falhou:", (e as Error).message);
  }
}

function sanitizePayload(p: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!p) return null;
  const banned = ["senha", "password", "pfx", "certificado", "authorization", "cookie"];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (banned.some((b) => k.toLowerCase().includes(b))) continue;
    if (typeof v === "string" && v.length > 4000) out[k] = v.slice(0, 4000) + "...[truncado]";
    else out[k] = v;
  }
  return out;
}

export async function registrarLogTecnico(
  supabase: SupabaseLike,
  params: {
    nota_fiscal_id: string;
    loja_id: string | null;
    etapa: string;
    payload?: Record<string, unknown>;
    retorno?: Record<string, unknown>;
    erro?: string | null;
    duracao_ms?: number;
  },
) {
  try {
    await supabase.from("notas_fiscais_logs_tecnicos").insert({
      nota_fiscal_id: params.nota_fiscal_id,
      loja_id: params.loja_id,
      etapa: params.etapa,
      payload_resumido: sanitizePayload(params.payload),
      retorno_resumido: sanitizePayload(params.retorno),
      erro: params.erro ?? null,
      duracao_ms: params.duracao_ms ?? null,
    });
  } catch (e) {
    console.error("[fiscalLog] log técnico falhou:", (e as Error).message);
  }
}
