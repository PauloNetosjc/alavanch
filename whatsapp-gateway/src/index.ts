// WhatsApp Gateway Alavanch — entrypoint Fastify.
// Sessões Baileys persistentes para WhatsApp Web (QR Code).
// Autentica por header x-whatsapp-api-secret compartilhado com o Supabase.

import Fastify from "fastify";
import { assertConfig, config } from "./config.js";
import { logger } from "./utils/logger.js";
import { registerWhatsappRoutes } from "./routes/whatsapp.js";

async function main(): Promise<void> {
  assertConfig();

  const app = Fastify({
    logger: false,
    bodyLimit: 4 * 1024 * 1024,
    trustProxy: true,
  });

  app.addHook("onRequest", async (req, reply) => {
    if (req.url === "/health") return;
    const secret = req.headers["x-whatsapp-api-secret"];
    if (!secret || secret !== config.apiSecret) {
      reply.code(401).send({ erro: "Unauthorized" });
    }
  });

  app.get("/health", async () => ({
    ok: true,
    service: "alavanch-whatsapp-gateway",
    env: config.nodeEnv,
    ts: new Date().toISOString(),
  }));

  await registerWhatsappRoutes(app);

  await app.listen({ port: config.port, host: "0.0.0.0" });
  logger.info(`WhatsApp gateway ouvindo em :${config.port}`, { env: config.nodeEnv });
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
