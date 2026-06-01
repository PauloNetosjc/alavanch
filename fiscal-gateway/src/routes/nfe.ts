// Rotas NF-e do gateway mTLS.
// POST /nfe/enviar-lote
// POST /nfe/consultar-recibo  (estrutura preparada — não implementa polling final)

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { enviarSoapMtls } from "../services/mtlsSefazClient.js";
import { logger } from "../utils/logger.js";

interface EnviarLoteBody {
  uf: string;
  ambiente: "homologacao" | "producao";
  endpoint: string;
  soapAction: string;
  envelope: string;
  xmlNFeAssinada: string;
  idLote: string;
  pfxBase64: string;
  senha: string;
}

interface ConsultarReciboBody {
  uf: string;
  ambiente: "homologacao" | "producao";
  endpoint: string;
  soapAction: string;
  envelope: string;
  pfxBase64: string;
  senha: string;
}

function bloqueiaProducao(reply: FastifyReply, ambiente: string): boolean {
  if (ambiente !== "homologacao") {
    reply.code(403).send({ erro: "Gateway aceita apenas ambiente=homologacao nesta fase" });
    return true;
  }
  return false;
}

export async function registerNfeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/nfe/enviar-lote", async (req: FastifyRequest<{ Body: EnviarLoteBody }>, reply) => {
    const b = req.body ?? ({} as EnviarLoteBody);
    if (!b.endpoint || !b.envelope || !b.pfxBase64 || !b.senha || !b.idLote) {
      return reply.code(400).send({ erro: "Campos obrigatórios ausentes" });
    }
    if (bloqueiaProducao(reply, b.ambiente)) return;

    const inicio = Date.now();
    try {
      const r = await enviarSoapMtls({
        endpoint: b.endpoint, soapAction: b.soapAction, envelope: b.envelope,
        pfxBase64: b.pfxBase64, senha: b.senha,
      });
      logger.info("nfe.enviar-lote ok", { uf: b.uf, idLote: b.idLote, status: r.status, ms: Date.now() - inicio });
      return reply.send({ ok: true, httpStatus: r.status, xmlRetornoBruto: r.xmlRetornoBruto });
    } catch (e) {
      const msg = (e as Error).message;
      logger.error("nfe.enviar-lote erro", { uf: b.uf, idLote: b.idLote, erro: msg });
      return reply.code(502).send({ ok: false, erro: msg });
    }
  });

  app.post("/nfe/consultar-recibo", async (req: FastifyRequest<{ Body: ConsultarReciboBody }>, reply) => {
    const b = req.body ?? ({} as ConsultarReciboBody);
    if (!b.endpoint || !b.envelope || !b.pfxBase64 || !b.senha) {
      return reply.code(400).send({ erro: "Campos obrigatórios ausentes" });
    }
    if (bloqueiaProducao(reply, b.ambiente)) return;

    try {
      const r = await enviarSoapMtls({
        endpoint: b.endpoint, soapAction: b.soapAction, envelope: b.envelope,
        pfxBase64: b.pfxBase64, senha: b.senha,
      });
      return reply.send({ ok: true, httpStatus: r.status, xmlRetornoBruto: r.xmlRetornoBruto });
    } catch (e) {
      return reply.code(502).send({ ok: false, erro: (e as Error).message });
    }
  });
}
