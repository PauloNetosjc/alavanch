// Mapa de endpoints SEFAZ — APENAS HOMOLOGAÇÃO nesta fase.
// Apenas SP testado. Demais UFs ficam preparadas para extensão.
// Produção propositalmente NÃO incluída (bloqueio explícito).

export type SefazServico =
  | "NfeAutorizacao"
  | "NfeRetAutorizacao"
  | "NfeConsultaProtocolo"
  | "RecepcaoEvento";

interface UFEndpoints {
  uf: string;
  homologacao: Partial<Record<SefazServico, string>>;
}

// URLs oficiais SEFAZ (homologação). Apenas SP populado para validação inicial.
export const SEFAZ_ENDPOINTS: Record<string, UFEndpoints> = {
  SP: {
    uf: "SP",
    homologacao: {
      NfeAutorizacao: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
      NfeRetAutorizacao: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx",
      NfeConsultaProtocolo: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx",
      RecepcaoEvento: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx",
    },
  },
};

// Códigos IBGE dos estados para cUF do XML.
export const C_UF: Record<string, number> = {
  RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17,
  MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29,
  MG: 31, ES: 32, RJ: 33, SP: 35,
  PR: 41, SC: 42, RS: 43,
  MS: 50, MT: 51, GO: 52, DF: 53,
};

export function getEndpoint(uf: string, servico: SefazServico): string | null {
  const cfg = SEFAZ_ENDPOINTS[uf?.toUpperCase()];
  if (!cfg) return null;
  return cfg.homologacao[servico] ?? null;
}
