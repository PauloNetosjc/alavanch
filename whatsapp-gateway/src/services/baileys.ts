// Serviço Baileys — gerencia sessões WhatsApp Web por conta.
// Persiste sessão em disco (useMultiFileAuthState) — use um VOLUME em produção.
// Eventos importantes são enviados via webhook para a edge function whatsapp-webhook.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type ConnectionState,
  type WAMessage,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

type SessionState = {
  contaId: string;
  lojaId: string;
  status: "desconectado" | "aguardando_qr" | "conectando" | "conectado" | "erro";
  qrCodeDataUrl?: string;
  qrAtualizadoEm?: string;
  numeroConectado?: string;
  jid?: string;
  ultimaMensagem?: string;
  sock?: WASocket;
};

const sessions = new Map<string, SessionState>();

function sessionDir(contaId: string): string {
  return path.join(config.sessionsDir, contaId);
}

async function postWebhook(payload: Record<string, unknown>): Promise<void> {
  if (!config.supabaseWebhookUrl) return;
  try {
    await fetch(config.supabaseWebhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-whatsapp-webhook-secret": config.supabaseWebhookSecret,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    logger.warn("webhook_falhou", { erro: String(e) });
  }
}

export function getSessionState(contaId: string): SessionState | undefined {
  return sessions.get(contaId);
}

export function listSessions(): Array<Omit<SessionState, "sock">> {
  return Array.from(sessions.values()).map(({ sock, ...rest }) => rest);
}

export async function startSession(contaId: string, lojaId: string): Promise<SessionState> {
  let state = sessions.get(contaId);
  if (state?.sock && state.status === "conectado") return state;

  await mkdir(sessionDir(contaId), { recursive: true });
  const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir(contaId));
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: authState,
    printQRInTerminal: false,
    syncFullHistory: false, // Histórico recente apenas — completo não é garantido
    markOnlineOnConnect: false,
  });

  state = {
    contaId,
    lojaId,
    status: "conectando",
    sock,
  };
  sessions.set(contaId, state);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
    const cur = sessions.get(contaId);
    if (!cur) return;

    if (update.qr) {
      const dataUrl = await QRCode.toDataURL(update.qr, { width: 320, margin: 1 });
      cur.qrCodeDataUrl = dataUrl;
      cur.qrAtualizadoEm = new Date().toISOString();
      cur.status = "aguardando_qr";
      logger.info("qr_atualizado", { contaId });
      await postWebhook({
        tipo: "qr_atualizado",
        conta_id: contaId,
        loja_id: lojaId,
        qr_code: dataUrl,
        qr_atualizado_em: cur.qrAtualizadoEm,
      });
    }

    if (update.connection === "open") {
      cur.status = "conectado";
      cur.numeroConectado = sock.user?.id?.split(":")[0]?.split("@")[0];
      cur.jid = sock.user?.id;
      cur.qrCodeDataUrl = undefined;
      logger.info("conectado", { contaId, numero: cur.numeroConectado });
      await postWebhook({
        tipo: "conectado",
        conta_id: contaId,
        loja_id: lojaId,
        numero: cur.numeroConectado,
        jid: cur.jid,
      });
    }

    if (update.connection === "close") {
      const reasonCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
        ?.statusCode;
      const shouldReconnect = reasonCode !== DisconnectReason.loggedOut;
      cur.status = "desconectado";
      logger.warn("desconectado", { contaId, reasonCode, reconectar: shouldReconnect });
      await postWebhook({
        tipo: "desconectado",
        conta_id: contaId,
        loja_id: lojaId,
        motivo: reasonCode,
      });
      if (shouldReconnect) {
        setTimeout(() => {
          startSession(contaId, lojaId).catch((e) => logger.error("reconectar_falhou", { erro: String(e) }));
        }, 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" && type !== "append") return;
    for (const m of messages) {
      await postWebhook({
        tipo: "mensagem_recebida",
        conta_id: contaId,
        loja_id: lojaId,
        origem: type === "append" ? "whatsapp_web_history_sync" : "whatsapp_web_runtime",
        mensagem: simplifyMessage(m),
      });
    }
  });

  return state;
}

export async function stopSession(contaId: string): Promise<void> {
  const cur = sessions.get(contaId);
  if (!cur) return;
  try {
    await cur.sock?.logout();
  } catch {
    /* ignore */
  }
  sessions.delete(contaId);
  logger.info("sessao_encerrada", { contaId });
}

export async function sendText(contaId: string, jid: string, text: string): Promise<{ id?: string }> {
  const cur = sessions.get(contaId);
  if (!cur?.sock || cur.status !== "conectado") {
    throw new Error("sessao_nao_conectada");
  }
  const r = await cur.sock.sendMessage(jid, { text });
  return { id: r?.key?.id ?? undefined };
}

/**
 * Sincronização de histórico recente.
 * IMPORTANTE: WhatsApp Web só expõe o que o dispositivo vinculado já tem em cache.
 * Não há garantia de histórico antigo completo.
 */
export async function syncHistory(contaId: string): Promise<{ chats: number }> {
  const cur = sessions.get(contaId);
  if (!cur?.sock || cur.status !== "conectado") throw new Error("sessao_nao_conectada");
  // Baileys dispara events 'messaging-history.set' naturalmente após conexão.
  // Aqui apenas marcamos o pedido; o gateway repassa via webhook conforme chegam.
  await postWebhook({
    tipo: "sync_historico_iniciado",
    conta_id: contaId,
    loja_id: cur.lojaId,
  });
  return { chats: 0 };
}

function simplifyMessage(m: WAMessage): Record<string, unknown> {
  const msg = m.message ?? {};
  const text =
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    null;
  return {
    id: m.key.id,
    chat_id: m.key.remoteJid,
    from_me: !!m.key.fromMe,
    participant: m.key.participant,
    timestamp: Number(m.messageTimestamp ?? 0),
    push_name: m.pushName,
    tipo: Object.keys(msg)[0] ?? "unknown",
    texto: text,
  };
}
