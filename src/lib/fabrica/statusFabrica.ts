// Status do Módulo Fábrica — Fase 1

export type StatusFabrica =
  | "aguardando_arquivos"
  | "arquivos_importados"
  | "aguardando_corte"
  | "em_corte"
  | "corte_finalizado"
  | "atelie"
  | "aguardando_conferencia"
  | "em_separacao_pecas"
  | "aguardando_almoxarifado"
  | "em_separacao_almoxarifado"
  | "pronto_para_expedicao"
  | "em_expedicao"
  | "expedido"
  | "ocorrencia_peca_faltante"
  | "liberado_para_lote"
  | "em_producao"
  | "concluido_fabrica";

export const STATUS_FABRICA_LABEL: Record<string, string> = {
  liberado_para_lote: "Liberado para lote",
  aguardando_arquivos: "Aguardando arquivos",
  arquivos_importados: "Arquivos importados",
  aguardando_corte: "Aguardando corte",
  em_corte: "Em corte",
  corte_finalizado: "Corte finalizado",
  atelie: "Ateliê",
  aguardando_conferencia: "Aguardando conferência",
  em_separacao_pecas: "Separação peças",
  aguardando_almoxarifado: "Aguardando almoxarifado",
  em_separacao_almoxarifado: "Separação almoxarifado",
  pronto_para_expedicao: "Pronto para expedição",
  expedido: "Expedido",
  ocorrencia_peca_faltante: "Ocorrência / peça faltante",
  em_producao: "Em produção",
  concluido_fabrica: "Concluído fábrica",
};

export const STATUS_FABRICA_ORDEM: StatusFabrica[] = [
  "aguardando_arquivos",
  "arquivos_importados",
  "aguardando_corte",
  "em_corte",
  "corte_finalizado",
  "atelie",
  "aguardando_conferencia",
  "em_separacao_pecas",
  "aguardando_almoxarifado",
  "em_separacao_almoxarifado",
  "pronto_para_expedicao",
  "expedido",
  "ocorrencia_peca_faltante",
];

export function statusFabricaLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return STATUS_FABRICA_LABEL[s] || s;
}

export function statusFabricaBadgeClass(s: string | null | undefined): string {
  switch (s) {
    case "expedido":
    case "concluido_fabrica":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "pronto_para_expedicao":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "ocorrencia_peca_faltante":
      return "bg-red-100 text-red-800 border-red-200";
    case "em_corte":
    case "em_separacao_pecas":
    case "em_separacao_almoxarifado":
    case "em_producao":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "arquivos_importados":
    case "corte_finalizado":
      return "bg-violet-100 text-violet-800 border-violet-200";
    default:
      return "bg-muted text-foreground border-border";
  }
}

export const STATUS_PECA_LABEL: Record<string, string> = {
  aguardando_producao: "Aguardando produção",
  produzida: "Produzida",
  conferida: "Conferida",
  aguardando_par_embalagem: "Aguardando par",
  embalada: "Embalada",
  avariada: "Avariada",
  faltante: "Faltante",
  duplicada: "Duplicada",
  divergente: "Divergente",
};

export function statusPecaBadgeClass(s: string | null | undefined): string {
  switch (s) {
    case "embalada": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "conferida": return "bg-blue-100 text-blue-800 border-blue-200";
    case "aguardando_par_embalagem": return "bg-amber-100 text-amber-800 border-amber-200";
    case "avariada":
    case "faltante":
    case "divergente": return "bg-red-100 text-red-800 border-red-200";
    case "produzida": return "bg-violet-100 text-violet-800 border-violet-200";
    default: return "bg-muted text-foreground border-border";
  }
}

export const TIPO_VOLUME_LABEL: Record<string, string> = {
  peca_individual: "Peça individual",
  peca_conjunta: "Peça conjunta",
  caixa_almoxarifado: "Caixa almoxarifado",
  avulso: "Avulso",
};

export const STATUS_VOLUME_LABEL: Record<string, string> = {
  aberto: "Aberto",
  fechado: "Fechado",
  etiquetado: "Etiquetado",
  carregado: "Carregado",
  cancelado: "Cancelado",
};

export const STATUS_MODULO_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_producao: "Em produção",
  completo: "Completo",
  incompleto: "Incompleto",
  ocorrencia: "Ocorrência",
};

export const STATUS_ALMOX_LABEL: Record<string, string> = {
  pendente: "Pendente",
  separado_parcial: "Separado parcial",
  separado_completo: "Separado completo",
  faltante: "Faltante",
  substituido: "Substituído",
};

export const TIPO_ARQUIVO_LABEL: Record<string, string> = {
  relatorio_fabricacao_modulo: "Relatório de fabricação por módulo",
  relatorio_almoxarifado: "Relatório de almoxarifado",
  cut_pro: "Arquivo Cut Pro",
  cnc_nesting: "Arquivo CNC / Nesting",
  promob: "Arquivo Promob",
  outro: "Outro anexo",
};

export const TIPOS_OBRIGATORIOS = [
  "relatorio_fabricacao_modulo",
  "relatorio_almoxarifado",
] as const;
