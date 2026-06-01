// sefazClient — comunicação SOAP com SEFAZ em HOMOLOGAÇÃO.
// Implementação focada em SP. Outras UFs devem ser adicionadas em sefazEndpoints.ts.
//
// IMPORTANTE (Fase Fiscal 2.1):
// O fetch padrão das Supabase Edge Functions NÃO suporta mTLS (client certificate)
// exigido pela SEFAZ. Por isso, a transmissão real é delegada a um GATEWAY
// FISCAL EXTERNO (Node.js) configurado via:
//   - FISCAL_GATEWAY_URL    (ex.: https://fiscal-gateway.alavanch.app)
//   - FISCAL_GATEWAY_SECRET (header x-fiscal-api-secret)
//
// Se o gateway NÃO estiver configurado, retornamos erro_transmissao controlado:
//   "Gateway fiscal mTLS não configurado"
//
// O envelope SOAP continua sendo montado aqui para manter compatibilidade futura.

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
  // Telemetria do gateway (quando usado)
  gatewayChamado?: boolean;
  gatewayRespondeu?: boolean;
  gatewayErro?: string;
}

function buildEnvelope(xmlNFe: string, idLote: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
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
}

function pickTag(xml: string, name: string): string | undefined {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : undefined;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function parseSefazRetorno(text: string, xmlNFeAssinada: string): EnviarLoteResultado {
  const cStat = pickTag(text, "cStat");
  const xMotivo = pickTag(text, "xMotivo");
  const nRec = pickTag(text, "nRec");
  const dhRecbto = pickTag(text, "dhRecbto");
  const nProt = pickTag(text, "nProt");

  const protNFe = text.match(/<protNFe[\s\S]*?<\/protNFe>/)?.[0];
  const cStatProt = protNFe ? pickTag(protNFe, "cStat") : undefined;
  const xMotivoProt = protNFe ? pickTag(protNFe, "xMotivo") : undefined;
  const protocolo = protNFe ? pickTag(protNFe, "nProt") : nProt;

  if (cStatProt === "100") {
    const xmlAutorizado = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
${xmlNFeAssinada}
${protNFe}
</nfeProc>`;
    return {
      ok: true, status: "autorizada", cStat: cStatProt, xMotivo: xMotivoProt,
      protocolo, dhRecbto, numeroRecibo: nRec, xmlAutorizado, xmlRetornoBruto: text,
    };
  }
  if (cStatProt && cStatProt !== "100") {
    return {
      ok: false, status: "rejeitada", cStat: cStatProt, xMotivo: xMotivoProt,
      protocolo, numeroRecibo: nRec, xmlRetornoBruto: text,
    };
  }
  if (cStat === "103" || cStat === "105") {
    return { ok: true, status: "aguardando_consulta", cStat, xMotivo, numeroRecibo: nRec, xmlRetornoBruto: text };
  }
  return {
    ok: false, status: "rejeitada", cStat, xMotivo, numeroRecibo: nRec,
    xmlRetornoBruto: text, erro: xMotivo ?? "Retorno SEFAZ não interpretado",
  };
}

export async function enviarLoteNfe(params: EnviarLoteParams): Promise<EnviarLoteResultado> {
  const endpoint = getEndpoint(params.uf, "NfeAutorizacao");
  if (!endpoint) {
    return {
      ok: false, status: "erro_transmissao", xmlRetornoBruto: "",
      erro: `UF ${params.uf} não mapeada para SEFAZ (homologação)`,
    };
  }

  const envelope = buildEnvelope(params.xmlNFeAssinada, params.idLote);

  const gatewayUrl = Deno.env.get("FISCAL_GATEWAY_URL");
  const gatewaySecret = Deno.env.get("FISCAL_GATEWAY_SECRET");

  // Sem gateway configurado → erro controlado
  if (!gatewayUrl || !gatewaySecret) {
    return {
      ok: false,
      status: "erro_transmissao",
      xmlRetornoBruto: "",
      erro: "Gateway fiscal mTLS não configurado",
      gatewayChamado: false,
    };
  }

  // Com gateway → envia tudo via HTTPS interno autenticado
  try {
    const resp = await fetch(`${gatewayUrl.replace(/\/$/, "")}/nfe/enviar-lote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-fiscal-api-secret": gatewaySecret,
      },
      body: JSON.stringify({
        uf: params.uf,
        ambiente: "homologacao",
        endpoint,
        soapAction: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote",
        envelope,
        xmlNFeAssinada: params.xmlNFeAssinada,
        idLote: params.idLote,
        pfxBase64: bytesToBase64(params.pfx),
        senha: params.senha,
      }),
    });

    const json = await resp.json().catch(() => ({} as any));
    if (!resp.ok) {
      return {
        ok: false, status: "erro_transmissao", xmlRetornoBruto: json?.xmlRetornoBruto ?? "",
        erro: json?.erro ?? `Gateway HTTP ${resp.status}`,
        gatewayChamado: true, gatewayRespondeu: true, gatewayErro: json?.erro,
      };
    }

    const text: string = json?.xmlRetornoBruto ?? "";
    if (!text) {
      return {
        ok: false, status: "erro_transmissao", xmlRetornoBruto: "",
        erro: "Gateway retornou sem XML",
        gatewayChamado: true, gatewayRespondeu: true,
      };
    }
    const parsed = parseSefazRetorno(text, params.xmlNFeAssinada);
    return { ...parsed, gatewayChamado: true, gatewayRespondeu: true };
  } catch (e) {
    return {
      ok: false, status: "erro_transmissao", xmlRetornoBruto: "",
      erro: `Gateway mTLS indisponível: ${(e as Error).message}`,
      gatewayChamado: true, gatewayRespondeu: false, gatewayErro: (e as Error).message,
    };
  }
}
