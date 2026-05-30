/**
 * Utilitário de renderização de modelos de contrato SaaS.
 * Substitui variáveis {{nome}} no HTML, formata datas/valores.
 */

export type DadosContratoSaaS = {
  base_nome?: string | null;
  razao_social?: string | null;
  cnpj?: string | null;
  responsavel_nome?: string | null;
  email_responsavel?: string | null;
  telefone_responsavel?: string | null;
  plano?: string | null;
  valor_implantacao?: number | null;
  valor_mensal?: number | null;
  dia_vencimento?: number | null;
  lojas_incluidas?: number | null;
  usuarios_incluidos?: number | null;
  armazenamento_incluido_mb?: number | null;
  armazenamento_adicional_mb?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  modulos_contratados?: string[] | null;
};

const fmtBRL = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
};

const fmtArmazenamento = (mb: number | null | undefined) => {
  if (mb == null) return "—";
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${mb} MB`;
};

const fmtModulos = (mods: string[] | null | undefined) => {
  if (!mods || mods.length === 0) return "—";
  return mods.join(", ");
};

const safe = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v));

export function renderContratoSaasTemplate(
  templateHtml: string,
  dados: DadosContratoSaaS,
): string {
  const map: Record<string, string> = {
    base_nome: safe(dados.base_nome),
    razao_social: safe(dados.razao_social),
    cnpj: safe(dados.cnpj),
    responsavel_nome: safe(dados.responsavel_nome),
    email_responsavel: safe(dados.email_responsavel),
    telefone_responsavel: safe(dados.telefone_responsavel),
    plano: safe(dados.plano),
    valor_implantacao: fmtBRL(dados.valor_implantacao ?? null),
    valor_mensal: fmtBRL(dados.valor_mensal ?? null),
    dia_vencimento: safe(dados.dia_vencimento),
    lojas_incluidas: safe(dados.lojas_incluidas),
    usuarios_incluidos: safe(dados.usuarios_incluidos),
    armazenamento_incluido: fmtArmazenamento(dados.armazenamento_incluido_mb ?? null),
    armazenamento_adicional: fmtArmazenamento(dados.armazenamento_adicional_mb ?? null),
    data_inicio: fmtDate(dados.data_inicio ?? null),
    data_fim: fmtDate(dados.data_fim ?? null),
    modulos_contratados: fmtModulos(dados.modulos_contratados ?? null),
    data_atual: new Date().toLocaleDateString("pt-BR"),
  };

  return templateHtml.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_m, key) => map[key] ?? "—");
}

export const VARIAVEIS_CONTRATO_SAAS = [
  "base_nome", "razao_social", "cnpj",
  "responsavel_nome", "email_responsavel", "telefone_responsavel",
  "plano", "valor_implantacao", "valor_mensal", "dia_vencimento",
  "lojas_incluidas", "usuarios_incluidos",
  "armazenamento_incluido", "armazenamento_adicional",
  "data_inicio", "data_fim", "modulos_contratados", "data_atual",
] as const;
