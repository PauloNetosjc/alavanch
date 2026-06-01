// Gateway Fiscal mTLS Alavanch — entrypoint Fastify.
// Responsável por transmitir SOAP NF-e em HOMOLOGAÇÃO para SEFAZ usando
// certificado A1 (cliente TLS) somente em memória, por requisição.

import Fastify from "fastify";
import { config, assertConfig } from "./config.js";
import { logger } from "./utils/logger.js";
import { registerNfeRoutes } from "./routes/nfe.js";

async function main(): Promise<void> {
  assertConfig();

  const app = Fastify({
    logger: false,
    bodyLimit: 8 * 1024 * 1024, // 8MB — XML + PFX base64
    trustProxy: true,
  });

  // Autenticação por secret compartilhado
  app.addHook("onRequest", async (req, reply) => {
    if (req.url === "/health") return;
    const secret = req.headers["x-fiscal-api-secret"];
    if (!secret || secret !== config.apiSecret) {
      reply.code(401).send({ erro: "Unauthorized" });
    }
  });

  app.get("/health", async () => ({
    ok: true,
    service: "alavanch-fiscal-gateway",
    env: config.nodeEnv,
    ts: new Date().toISOString(),
  }));

  await registerNfeRoutes(app);

  await app.listen({ port: config.port, host: "0.0.0.0" });
  logger.info(`Gateway fiscal mTLS ouvindo em :${config.port}`, { env: config.nodeEnv });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[fatal]", e);
  process.exit(1);
});
