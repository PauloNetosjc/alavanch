// Utilitários XML mínimos para NF-e.
// Sem dependências externas para manter portabilidade.

export function escapeXml(v: unknown): string {
  const s = String(v ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function tag(name: string, value: unknown, opts: { skipIfEmpty?: boolean } = {}): string {
  if (value === undefined || value === null || value === "") {
    if (opts.skipIfEmpty) return "";
  }
  return `<${name}>${escapeXml(value)}</${name}>`;
}

export function pad(n: number | string, len: number): string {
  return String(n).padStart(len, "0");
}

export function onlyDigits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

export function fmt(v: number | string | null | undefined, decimals = 2): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return (0).toFixed(decimals);
  return n.toFixed(decimals);
}

/**
 * Canonicalização C14N simplificada para o nó infNFe.
 * AVISO: implementação reduzida — para produção é mandatório C14N completo
 * com normalização exata de namespaces conforme o MOC NF-e.
 */
export function c14nSimples(xml: string): string {
  return xml.trim().replace(/\r/g, "").replace(/>\s+</g, "><");
}
