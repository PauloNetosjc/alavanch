export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 8788),
  apiSecret: process.env.WHATSAPP_GATEWAY_SECRET ?? "",
  sessionsDir: process.env.SESSIONS_DIR ?? "./sessions",
  supabaseWebhookUrl: process.env.SUPABASE_WEBHOOK_URL ?? "",
  supabaseWebhookSecret: process.env.SUPABASE_WEBHOOK_SECRET ?? "",
};

export function assertConfig(): void {
  if (!config.apiSecret) {
    throw new Error("WHATSAPP_GATEWAY_SECRET não configurado");
  }
}
