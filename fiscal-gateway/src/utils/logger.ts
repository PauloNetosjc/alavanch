// Logger mínimo, com mascaramento. NUNCA logamos PFX, senha ou XML completo.

type Level = "info" | "warn" | "error";

function safe(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  const clone: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  for (const k of Object.keys(clone)) {
    const key = k.toLowerCase();
    if (key.includes("senha") || key.includes("password") || key === "pfx" || key === "pfxbase64") {
      clone[k] = "[REDACTED]";
    }
    if (key === "envelope" || key === "xmlnfeassinada" || key === "xmlretornobruto") {
      const v = clone[k];
      if (typeof v === "string") clone[k] = `[xml ${v.length} bytes]`;
    }
  }
  return clone;
}

function log(level: Level, msg: string, extra?: unknown): void {
  const entry = { ts: new Date().toISOString(), level, msg, extra: safe(extra) };
  // eslint-disable-next-line no-console
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](JSON.stringify(entry));
}

export const logger = {
  info: (m: string, e?: unknown) => log("info", m, e),
  warn: (m: string, e?: unknown) => log("warn", m, e),
  error: (m: string, e?: unknown) => log("error", m, e),
};
