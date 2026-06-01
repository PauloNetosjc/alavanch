// Logger mínimo (NUNCA loga texto completo de mensagens nem credenciais).
type Level = "info" | "warn" | "error";

function safe(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  const clone: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  for (const k of Object.keys(clone)) {
    const key = k.toLowerCase();
    if (["secret", "token", "password", "senha", "apikey", "api_key"].some((s) => key.includes(s))) {
      clone[k] = "[REDACTED]";
    }
    if (key === "qr" || key === "qrcode" || key === "qr_code") {
      const v = clone[k];
      if (typeof v === "string") clone[k] = `[qr ${v.length}b]`;
    }
  }
  return clone;
}

function log(level: Level, msg: string, extra?: unknown): void {
  const entry = { ts: new Date().toISOString(), level, msg, extra: safe(extra) };
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](JSON.stringify(entry));
}

export const logger = {
  info: (m: string, e?: unknown) => log("info", m, e),
  warn: (m: string, e?: unknown) => log("warn", m, e),
  error: (m: string, e?: unknown) => log("error", m, e),
};
