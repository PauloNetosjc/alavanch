export type NfeStatus =
  | "rascunho"
  | "pronta_para_emitir"
  | "assinada"
  | "enviada"
  | "aguardando_consulta"
  | "autorizada"
  | "rejeitada"
  | "erro_transmissao"
  | "cancelada"
  | string;

export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  pronta_para_emitir: "Pronta para emitir",
  assinada: "Assinada",
  enviada: "Enviada",
  aguardando_consulta: "Aguardando consulta",
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  erro_transmissao: "Erro de transmissão",
  cancelada: "Cancelada",
};

export const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  rascunho: "secondary",
  pronta_para_emitir: "outline",
  assinada: "outline",
  enviada: "default",
  aguardando_consulta: "default",
  autorizada: "default",
  rejeitada: "destructive",
  erro_transmissao: "destructive",
  cancelada: "secondary",
};

export function podeEmitirNfe(nota: { tipo?: string; ambiente?: string; status?: string }): boolean {
  if (!nota) return false;
  if ((nota.tipo ?? "").toLowerCase() !== "nfe") return false;
  if ((nota.ambiente ?? "homologacao") !== "homologacao") return false;
  return ["rascunho", "pronta_para_emitir"].includes(nota.status ?? "");
}
