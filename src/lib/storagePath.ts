/**
 * Sanitiza um nome de arquivo para uso seguro como key no Supabase Storage.
 * - normaliza unicode (NFD) e remove diacríticos
 * - troca espaços e separadores por hífen
 * - remove caracteres inválidos
 * - colapsa hífens repetidos
 * - converte para minúsculas
 * - preserva extensão (até 8 chars)
 * - limita o nome a maxLen (default 120)
 * - fallback "arquivo" se ficar vazio
 */
export function sanitizeStorageFileName(fileName: string, maxLen = 120): string {
  const raw = (fileName || "").trim();
  const lastDot = raw.lastIndexOf(".");
  let base = lastDot > 0 ? raw.slice(0, lastDot) : raw;
  let ext = lastDot > 0 ? raw.slice(lastDot + 1) : "";

  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // diacríticos
      .replace(/[^a-zA-Z0-9.\-_ ]+/g, "") // só alfa-num, ponto, hífen, underscore, espaço
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .toLowerCase();

  base = clean(base);
  ext = clean(ext).replace(/\./g, "").slice(0, 8);

  if (!base) base = "arquivo";
  if (base.length > maxLen) base = base.slice(0, maxLen).replace(/-+$/g, "");

  return ext ? `${base}.${ext}` : base;
}
