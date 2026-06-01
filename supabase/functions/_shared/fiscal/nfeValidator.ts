// nfeValidator — validação mínima de campos obrigatórios.
// TODO produção: validar contra XSD oficial NF-e v4.00.

import type { BuildNfeInput } from "./nfeXmlBuilder.ts";

export interface ValidacaoResultado {
  ok: boolean;
  erros: string[];
}

export function validarCamposMinimos(input: BuildNfeInput): ValidacaoResultado {
  const erros: string[] = [];
  const { nota, emit, dest, itens } = input;

  if (!nota?.numero_nf || nota.numero_nf <= 0) erros.push("Número da NF obrigatório (numero_nf)");
  if (!nota?.serie && nota?.serie !== 0) erros.push("Série da NF obrigatória");
  if (!nota?.natureza_operacao) erros.push("Natureza da operação obrigatória");
  if (!nota?.valor_total || nota.valor_total <= 0) erros.push("Valor total deve ser maior que zero");

  if (!emit?.cnpj || emit.cnpj.replace(/\D/g, "").length !== 14) erros.push("CNPJ do emitente inválido");
  if (!emit?.razao_social) erros.push("Razão social do emitente obrigatória");
  if (!emit?.uf) erros.push("UF do emitente obrigatória");
  if (!emit?.municipio) erros.push("Município do emitente obrigatório");
  if (!emit?.codigo_municipio) erros.push("Código IBGE do município do emitente obrigatório");
  if (!emit?.ie) erros.push("Inscrição estadual do emitente obrigatória");

  if (!dest?.nome) erros.push("Nome/razão do destinatário obrigatório");
  if (!dest?.documento) erros.push("Documento (CPF/CNPJ) do destinatário obrigatório");

  if (!itens?.length) erros.push("Nota deve conter ao menos um item");
  itens?.forEach((it, idx) => {
    const i = idx + 1;
    if (!it.cProd) erros.push(`Item ${i}: cProd ausente`);
    if (!it.xProd) erros.push(`Item ${i}: descrição ausente`);
    if (!it.NCM || it.NCM.replace(/\D/g, "").length < 8) erros.push(`Item ${i}: NCM inválido`);
    if (!it.CFOP) erros.push(`Item ${i}: CFOP ausente`);
    if (!it.uCom) erros.push(`Item ${i}: unidade comercial ausente`);
    if (!it.qCom || it.qCom <= 0) erros.push(`Item ${i}: quantidade inválida`);
    if (it.vUnCom == null || it.vUnCom < 0) erros.push(`Item ${i}: valor unitário inválido`);
    if (!it.vProd || it.vProd <= 0) erros.push(`Item ${i}: valor total do produto inválido`);
  });

  return { ok: erros.length === 0, erros };
}

/**
 * TODO produção: validar XML final contra XSDs oficiais (NfeAutorizacao4 + tipos).
 * Esta versão apenas checa que a string contém os marcadores essenciais.
 */
export function validarXmlAssinado(xml: string): ValidacaoResultado {
  const erros: string[] = [];
  if (!xml.includes("<NFe ")) erros.push("XML não contém <NFe>");
  if (!xml.includes("<infNFe ")) erros.push("XML não contém <infNFe>");
  if (!xml.includes("<Signature")) erros.push("XML não contém <Signature>");
  if (!xml.includes("<DigestValue>")) erros.push("DigestValue ausente");
  if (!xml.includes("<SignatureValue>")) erros.push("SignatureValue ausente");
  if (!xml.includes("<X509Certificate>")) erros.push("X509Certificate ausente");
  return { ok: erros.length === 0, erros };
}
