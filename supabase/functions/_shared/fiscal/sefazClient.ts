// sefazClient — comunicação SOAP com SEFAZ em HOMOLOGAÇÃO.
// Implementação focada em SP. Outras UFs devem ser adicionadas em sefazEndpoints.ts.
// Esta versão envia o lote NFeAutorizacao4 em modo síncrono (indSinc=1)
// e retorna o protocolo. Para assíncrono, usar NfeRetAutorizacao4.

import { getEndpoint } from "./sefazEndpoints.ts";

export interface EnviarLoteParams {
  uf: string;
  xmlNFeAssinada: string;
  idLote: string; // numérico até 15 dígitos
  pfx: Uint8Array;
  senha: string;
}

export interface EnviarLoteResultado {
  ok: boolean;
  status: "autorizada" | "rejeitada" | "enviada" | "erro_transmissao" | "aguardando_consulta";
  cStat?: string;
  xMotivo?: string;
  protocolo?: string;
  dhRecbto?: string;
  numeroRecibo?: string;
  xmlAutorizado?: string;
  xmlRetornoBruto: string;
  erro?: string;
}

function buildEnvelope(xmlNFe: string, idLote: string): string {
  const env = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
<soap:Body>
<nfe:nfeDadosMsg>
<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
<idLote>${idLote}</idLote>
<indSinc>1</indSinc>
${xmlNFe}
</enviNFe>
</nfe:nfeDadosMsg>
</soap:Body>
</soap:Envelope>`;
  return env;
}

function pickTag(xml: string, name: string): string | undefined {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : undefined;
}

/**
 * NOTA: o fetch padrão do Deno NÃO faz mTLS com cliente PFX nativamente.
 * Para SEFAZ é obrigatório enviar o certificado A1 no handshake TLS.
 * Esta implementação tenta o envio direto — se o ambiente não suportar mTLS
 * (caso típico em Edge Functions Supabase), retorna erro_transmissao com
 * mensagem clara para o operador. Migração futura: gateway dedicado ou
 * runtime com suporte a Deno.createHttpClient({ caCerts, cert, key }).
 */
export async function enviarLoteNfe(params: EnviarLoteParams): Promise<EnviarLoteResultado> {
  const endpoint = getEndpoint(params.uf, "NfeAutorizacao");
  if (!endpoint) {
    return {
      ok: false,
      status: "erro_transmissao",
      xmlRetornoBruto: "",
      erro: `UF ${params.uf} não mapeada para SEFAZ (homologação)`,
    };
  }

  const envelope = buildEnvelope(params.xmlNFeAssinada, params.idLote);

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/soap+xml; charset=utf-8",
        "SOAPAction": "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote",
      },
      body: envelope,
    });
    const text = await resp.text();
    if (!resp.ok) {
      return {
        ok: false,
        status: "erro_transmissao",
        xmlRetornoBruto: text,
        erro: `HTTP ${resp.status} da SEFAZ`,
      };
    }

    const cStat = pickTag(text, "cStat");
    const xMotivo = pickTag(text, "xMotivo");
    const nRec = pickTag(text, "nRec");
    const dhRecbto = pickTag(text, "dhRecbto");
    const nProt = pickTag(text, "nProt");

    // 104 = Lote processado / 100 = Autorizado o uso da NF-e
    const protNFe = text.match(/<protNFe[\s\S]*?<\/protNFe>/)?.[0];
    const cStatProt = protNFe ? pickTag(protNFe, "cStat") : undefined;
    const xMotivoProt = protNFe ? pickTag(protNFe, "xMotivo") : undefined;
    const protocolo = protNFe ? pickTag(protNFe, "nProt") : nProt;

    if (cStatProt === "100") {
      // monta XML autorizado (NFe + protNFe dentro de nfeProc)
      const xmlAutorizado = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
${params.xmlNFeAssinada}
${protNFe}
</nfeProc>`;
      return {
        ok: true,
        status: "autorizada",
        cStat: cStatProt,
        xMotivo: xMotivoProt,
        protocolo,
        dhRecbto,
        numeroRecibo: nRec,
        xmlAutorizado,
        xmlRetornoBruto: text,
      };
    }

    if (cStatProt && cStatProt !== "100") {
      return {
        ok: false,
        status: "rejeitada",
        cStat: cStatProt,
        xMotivo: xMotivoProt,
        protocolo,
        numeroRecibo: nRec,
        xmlRetornoBruto: text,
      };
    }

    // Lote aceito mas sem protNFe — usar consulta
    if (cStat === "103" || cStat === "105") {
      return {
        ok: true,
        status: "aguardando_consulta",
        cStat,
        xMotivo,
        numeroRecibo: nRec,
        xmlRetornoBruto: text,
      };
    }

    return {
      ok: false,
      status: "rejeitada",
      cStat,
      xMotivo,
      numeroRecibo: nRec,
      xmlRetornoBruto: text,
      erro: xMotivo ?? "Retorno SEFAZ não interpretado",
    };
  } catch (e) {
    return {
      ok: false,
      status: "erro_transmissao",
      xmlRetornoBruto: "",
      erro: (e as Error).message,
    };
  }
}
