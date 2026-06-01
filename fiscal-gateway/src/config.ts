// Configuração central do gateway fiscal mTLS.
// IMPORTANTE: este serviço NUNCA persiste PFX ou senha.

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 8787),
  apiSecret: process.env.FISCAL_GATEWAY_SECRET ?? "",
  sefazTimeoutMs: Number(process.env.SEFAZ_TIMEOUT_MS ?? 30000),
};

export function assertConfig(): void {
  if (!config.apiSecret) {
    throw new Error("FISCAL_GATEWAY_SECRET não configurado");
  }
}
