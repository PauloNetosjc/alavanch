import type { FastifyInstance } from "fastify";
import { startSession, stopSession, getSessionState, sendText, syncHistory, listSessions } from "../services/baileys.js";
import { logger } from "../utils/logger.js";

export async function registerWhatsappRoutes(app: FastifyInstance): Promise<void> {
  // Inicia sessão / gera QR
  app.post<{ Body: { conta_id: string; loja_id: string } }>("/sessions/start", async (req, reply) => {
    const { conta_id, loja_id } = req.body ?? ({} as { conta_id: string; loja_id: string });
    if (!conta_id || !loja_id) return reply.code(400).send({ erro: "conta_id e loja_id obrigatórios" });
    try {
      const s = await startSession(conta_id, loja_id);
      return reply.send({
        ok: true,
        status: s.status,
        qr_code: s.qrCodeDataUrl ?? null,
        qr_atualizado_em: s.qrAtualizadoEm ?? null,
      });
    } catch (e) {
      logger.error("start_session_erro", { erro: String(e) });
      return reply.code(500).send({ erro: String(e) });
    }
  });

  // Status atual
  app.get<{ Querystring: { conta_id: string } }>("/sessions/status", async (req, reply) => {
    const contaId = req.query.conta_id;
    if (!contaId) return reply.code(400).send({ erro: "conta_id obrigatório" });
    const s = getSessionState(contaId);
    if (!s) return reply.send({ status: "desconectado" });
    return reply.send({
      status: s.status,
      qr_code: s.qrCodeDataUrl ?? null,
      qr_atualizado_em: s.qrAtualizadoEm ?? null,
      numero: s.numeroConectado ?? null,
      jid: s.jid ?? null,
    });
  });

  // Lista todas as sessões ativas no gateway (diagnóstico)
  app.get("/sessions", async () => ({ sessions: listSessions() }));

  // Desconectar (logout)
  app.post<{ Body: { conta_id: string } }>("/sessions/stop", async (req, reply) => {
    const { conta_id } = req.body ?? { conta_id: "" };
    if (!conta_id) return reply.code(400).send({ erro: "conta_id obrigatório" });
    await stopSession(conta_id);
    return reply.send({ ok: true });
  });

  // Envio de texto
  app.post<{ Body: { conta_id: string; to: string; text: string } }>("/messages/send", async (req, reply) => {
    const { conta_id, to, text } = req.body ?? ({} as { conta_id: string; to: string; text: string });
    if (!conta_id || !to || !text) return reply.code(400).send({ erro: "conta_id, to e text obrigatórios" });
    try {
      const jid = to.includes("@") ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;
      const r = await sendText(conta_id, jid, text);
      return reply.send({ ok: true, id: r.id, to: jid });
    } catch (e) {
      return reply.code(500).send({ erro: String(e) });
    }
  });

  // Sincronização de histórico recente
  app.post<{ Body: { conta_id: string } }>("/history/sync", async (req, reply) => {
    const { conta_id } = req.body ?? { conta_id: "" };
    if (!conta_id) return reply.code(400).send({ erro: "conta_id obrigatório" });
    try {
      const r = await syncHistory(conta_id);
      return reply.send({ ok: true, ...r });
    } catch (e) {
      return reply.code(500).send({ erro: String(e) });
    }
  });
}
