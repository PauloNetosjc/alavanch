// Cliente HTTPS com mTLS para SEFAZ (homologação).
// Usa undici.Agent com cert/key/ca em memória. Descarta após a requisição.

import { Agent, request } from "undici";
import { config } from "../config.js";
import { extrairCertificadoPfx } from "./certificadoA1.js";

export interface MtlsSoapParams {
  endpoint: string;
  soapAction: string;
  envelope: string;
  pfxBase64: string;
  senha: string;
}

export interface MtlsSoapResultado {
  status: number;
  xmlRetornoBruto: string;
}

export async function enviarSoapMtls(params: MtlsSoapParams): Promise<MtlsSoapResultado> {
  const { certPem, keyPem, caPems } = extrairCertificadoPfx(params.pfxBase64, params.senha);

  const agent = new Agent({
    connect: {
      cert: certPem,
      key: keyPem,
      ca: caPems.length ? caPems : undefined,
      // Em homologação, a cadeia pode estar incompleta para algumas UFs.
      // Mantemos rejectUnauthorized=true em produção; aqui permitimos override controlado.
      rejectUnauthorized: process.env.SEFAZ_INSECURE_TLS === "1" ? false : true,
    },
    headersTimeout: config.sefazTimeoutMs,
    bodyTimeout: config.sefazTimeoutMs,
    connectTimeout: 15000,
  });

  try {
    const res = await request(params.endpoint, {
      method: "POST",
      dispatcher: agent,
      headers: {
        "Content-Type": "application/soap+xml; charset=utf-8",
        "SOAPAction": params.soapAction,
        "Accept": "application/soap+xml, text/xml, */*",
      },
      body: params.envelope,
    });
    const xml = await res.body.text();
    return { status: res.statusCode, xmlRetornoBruto: xml };
  } finally {
    // libera o agente e o material sensível
    await agent.close().catch(() => undefined);
  }
}
