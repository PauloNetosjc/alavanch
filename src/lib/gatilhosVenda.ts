// Helpers de Gatilhos de Venda usados no Painel de Fechamento e na proposta impressa.

export type GatilhosTemplate = {
  mostrar_gatilhos_venda?: boolean | null;
  mostrar_gatilhos_na_negociacao?: boolean | null;
  mostrar_gatilhos_na_impressao?: boolean | null;
  titulo_painel_fechamento?: string | null;
  usar_gatilho_escassez?: boolean | null;
  titulo_escassez?: string | null;
  quantidade_contratos_total?: number | null;
  quantidade_contratos_restantes?: number | null;
  texto_escassez?: string | null;
  usar_gatilho_urgencia?: boolean | null;
  tipo_validade?: string | null;
  validade_horas?: number | null;
  validade_data_hora?: string | null;
  texto_urgencia?: string | null;
  sugestao_texto_fechamento?: string | null;
};

export type GatilhosCtx = {
  cliente_nome?: string;
  numero_orcamento?: string;
  nome_projeto?: string;
  valor_total?: number;
  desconto_total?: number;
};

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export function calcularValidade(tpl: GatilhosTemplate, base: Date = new Date()): Date | null {
  if (!tpl?.usar_gatilho_urgencia) return null;
  const tipo = tpl.tipo_validade || "horas";
  if (tipo === "data_hora_fixa") {
    if (!tpl.validade_data_hora) return null;
    const d = new Date(tpl.validade_data_hora);
    return isNaN(d.getTime()) ? null : d;
  }
  const horas = Number(tpl.validade_horas) || 0;
  if (horas <= 0) return null;
  return new Date(base.getTime() + horas * 3600 * 1000);
}

export function tempoRestante(validade: Date | null): string {
  if (!validade) return "";
  const diffMs = validade.getTime() - Date.now();
  if (diffMs <= 0) return "vencida";
  const totalMin = Math.floor(diffMs / 60000);
  const dias = Math.floor(totalMin / (60 * 24));
  const horas = Math.floor((totalMin % (60 * 24)) / 60);
  const min = totalMin % 60;
  if (dias > 0) return `${dias}d ${horas.toString().padStart(2, "0")}h`;
  return `${horas.toString().padStart(2, "0")}h ${min.toString().padStart(2, "0")}min`;
}

export function formatarValidade(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function isVencida(validade: Date | null): boolean {
  if (!validade) return false;
  return validade.getTime() < Date.now();
}

export function resolverTexto(texto: string, tpl: GatilhosTemplate, ctx: GatilhosCtx, validade: Date | null): string {
  if (!texto) return "";
  const mapa: Record<string, string> = {
    validade: formatarValidade(validade) || "—",
    tempo_restante: tempoRestante(validade),
    contratos_restantes: tpl.quantidade_contratos_restantes != null ? String(tpl.quantidade_contratos_restantes) : "—",
    contratos_total: tpl.quantidade_contratos_total != null ? String(tpl.quantidade_contratos_total) : "—",
    valor_total: ctx.valor_total != null ? fmtBrl(ctx.valor_total) : "—",
    desconto_total: ctx.desconto_total != null ? fmtBrl(ctx.desconto_total) : "—",
    cliente_nome: ctx.cliente_nome || "—",
    numero_orcamento: ctx.numero_orcamento || "—",
    nome_projeto: ctx.nome_projeto || "—",
  };
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => (k in mapa ? mapa[k] : `{{${k}}}`));
}
