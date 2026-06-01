// nfeXmlBuilder — monta XML NF-e modelo 55 mínimo viável para HOMOLOGAÇÃO.
// Inclui: ide, emit, dest, det[], total, transp, pag, infAdic.
// Para produção, é necessário cobrir todos os grupos e regras do MOC NF-e.

import { tag, pad, onlyDigits, fmt, escapeXml } from "./xml.ts";
import { C_UF } from "./sefazEndpoints.ts";

export interface BuildNfeInput {
  nota: {
    id: string;
    numero_nf: number;
    serie: number;
    natureza_operacao: string;
    data_emissao: string;
    valor_total: number;
    valor_produtos: number;
  };
  emit: {
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string | null;
    ie?: string | null;
    crt: number; // 1=Simples, 3=Normal
    uf: string;
    municipio: string;
    codigo_municipio: string;
    cnae?: string | null;
    endereco?: { logradouro?: string; numero?: string; bairro?: string; cep?: string };
  };
  dest: {
    nome: string;
    documento: string; // CPF ou CNPJ
    ie?: string | null;
    indIEDest?: number; // 1, 2, 9
    email?: string | null;
    endereco?: { logradouro?: string; numero?: string; bairro?: string; cep?: string; municipio?: string; uf?: string; codigo_municipio?: string };
  };
  itens: Array<{
    nItem: number;
    cProd: string;
    cEAN?: string | null;
    xProd: string;
    NCM: string;
    CFOP: string;
    uCom: string;
    qCom: number;
    vUnCom: number;
    vProd: number;
    uTrib?: string;
    qTrib?: number;
    vUnTrib?: number;
    CST?: string;
    origem?: number;
  }>;
}

export interface NfeMontada {
  chaveAcesso: string;
  cNF: string;
  cDV: string;
  xml: string; // só <NFe>...<infNFe>...</infNFe></NFe> (SEM Signature ainda)
  infNFeId: string;
}

function modulo11(base: string): number {
  let peso = 2;
  let soma = 0;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  return dv >= 10 ? 0 : dv;
}

export function gerarChaveAcesso(p: {
  cUF: number;
  aamm: string; // ex 2606
  cnpj: string; // 14
  mod: number; // 55
  serie: number;
  nNF: number;
  tpEmis: number;
  cNF: string; // 8
}): { chave: string; cDV: string } {
  const base = `${pad(p.cUF, 2)}${p.aamm}${pad(p.cnpj, 14)}${pad(p.mod, 2)}${pad(p.serie, 3)}${pad(p.nNF, 9)}${pad(p.tpEmis, 1)}${pad(p.cNF, 8)}`;
  const dv = modulo11(base);
  return { chave: base + dv, cDV: String(dv) };
}

export function buildNfeXml(input: BuildNfeInput): NfeMontada {
  const { nota, emit, dest, itens } = input;
  const tpAmb = 2; // HOMOLOGAÇÃO sempre
  const cUF = C_UF[emit.uf?.toUpperCase()] ?? 35;
  const dh = new Date(nota.data_emissao || Date.now());
  const aamm = `${String(dh.getFullYear()).slice(2)}${pad(dh.getMonth() + 1, 2)}`;
  const cNF = pad(Math.floor(Math.random() * 99999999), 8);

  const cnpjEmit = onlyDigits(emit.cnpj);
  const { chave, cDV } = gerarChaveAcesso({
    cUF, aamm, cnpj: cnpjEmit, mod: 55, serie: nota.serie, nNF: nota.numero_nf, tpEmis: 1, cNF,
  });

  const infNFeId = `NFe${chave}`;
  const dhEmi = dh.toISOString().replace(/\.\d{3}Z$/, "-03:00");

  // Homologação exige xProd "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" no primeiro item
  const itensXml = itens.map((it, idx) => {
    const xProd = idx === 0 ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" : it.xProd;
    const uTrib = it.uTrib ?? it.uCom;
    const qTrib = it.qTrib ?? it.qCom;
    const vUnTrib = it.vUnTrib ?? it.vUnCom;
    const cst = it.CST ?? "00";
    const orig = it.origem ?? 0;
    return `<det nItem="${it.nItem}">
  <prod>
    ${tag("cProd", it.cProd)}
    ${tag("cEAN", it.cEAN || "SEM GTIN")}
    ${tag("xProd", xProd)}
    ${tag("NCM", onlyDigits(it.NCM))}
    ${tag("CFOP", it.CFOP)}
    ${tag("uCom", it.uCom)}
    ${tag("qCom", fmt(it.qCom, 4))}
    ${tag("vUnCom", fmt(it.vUnCom, 4))}
    ${tag("vProd", fmt(it.vProd, 2))}
    ${tag("cEANTrib", it.cEAN || "SEM GTIN")}
    ${tag("uTrib", uTrib)}
    ${tag("qTrib", fmt(qTrib, 4))}
    ${tag("vUnTrib", fmt(vUnTrib, 4))}
    ${tag("indTot", 1)}
  </prod>
  <imposto>
    <ICMS><ICMS00>
      ${tag("orig", orig)}
      ${tag("CST", cst)}
      ${tag("modBC", 3)}
      ${tag("vBC", "0.00")}
      ${tag("pICMS", "0.00")}
      ${tag("vICMS", "0.00")}
    </ICMS00></ICMS>
    <PIS><PISNT>${tag("CST", "07")}</PISNT></PIS>
    <COFINS><COFINSNT>${tag("CST", "07")}</COFINSNT></COFINS>
  </imposto>
</det>`;
  }).join("");

  const docDest = onlyDigits(dest.documento);
  const tagDocDest = docDest.length === 14 ? tag("CNPJ", docDest) : tag("CPF", docDest);

  const xml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
<infNFe Id="${infNFeId}" versao="4.00">
<ide>
  ${tag("cUF", cUF)}
  ${tag("cNF", cNF)}
  ${tag("natOp", nota.natureza_operacao || "Venda de mercadoria")}
  ${tag("mod", 55)}
  ${tag("serie", nota.serie)}
  ${tag("nNF", nota.numero_nf)}
  ${tag("dhEmi", dhEmi)}
  ${tag("tpNF", 1)}
  ${tag("idDest", 1)}
  ${tag("cMunFG", emit.codigo_municipio)}
  ${tag("tpImp", 1)}
  ${tag("tpEmis", 1)}
  ${tag("cDV", cDV)}
  ${tag("tpAmb", tpAmb)}
  ${tag("finNFe", 1)}
  ${tag("indFinal", 1)}
  ${tag("indPres", 1)}
  ${tag("procEmi", 0)}
  ${tag("verProc", "Alavanch-1.0")}
</ide>
<emit>
  ${tag("CNPJ", cnpjEmit)}
  ${tag("xNome", emit.razao_social)}
  ${emit.nome_fantasia ? tag("xFant", emit.nome_fantasia) : ""}
  <enderEmit>
    ${tag("xLgr", emit.endereco?.logradouro || "Nao informado")}
    ${tag("nro", emit.endereco?.numero || "S/N")}
    ${tag("xBairro", emit.endereco?.bairro || "Nao informado")}
    ${tag("cMun", emit.codigo_municipio)}
    ${tag("xMun", emit.municipio)}
    ${tag("UF", emit.uf)}
    ${tag("CEP", onlyDigits(emit.endereco?.cep || ""))}
    ${tag("cPais", 1058)}
    ${tag("xPais", "BRASIL")}
  </enderEmit>
  ${tag("IE", onlyDigits(emit.ie || ""))}
  ${tag("CRT", emit.crt || 3)}
</emit>
<dest>
  ${tagDocDest}
  ${tag("xNome", "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL")}
  ${dest.endereco ? `<enderDest>
    ${tag("xLgr", dest.endereco.logradouro || "Nao informado")}
    ${tag("nro", dest.endereco.numero || "S/N")}
    ${tag("xBairro", dest.endereco.bairro || "Nao informado")}
    ${tag("cMun", dest.endereco.codigo_municipio || emit.codigo_municipio)}
    ${tag("xMun", dest.endereco.municipio || emit.municipio)}
    ${tag("UF", dest.endereco.uf || emit.uf)}
    ${tag("CEP", onlyDigits(dest.endereco.cep || ""))}
    ${tag("cPais", 1058)}
    ${tag("xPais", "BRASIL")}
  </enderDest>` : ""}
  ${tag("indIEDest", dest.indIEDest ?? 9)}
  ${dest.email ? tag("email", dest.email) : ""}
</dest>
${itensXml}
<total>
  <ICMSTot>
    ${tag("vBC", "0.00")}
    ${tag("vICMS", "0.00")}
    ${tag("vICMSDeson", "0.00")}
    ${tag("vFCP", "0.00")}
    ${tag("vBCST", "0.00")}
    ${tag("vST", "0.00")}
    ${tag("vFCPST", "0.00")}
    ${tag("vFCPSTRet", "0.00")}
    ${tag("vProd", fmt(nota.valor_produtos))}
    ${tag("vFrete", "0.00")}
    ${tag("vSeg", "0.00")}
    ${tag("vDesc", "0.00")}
    ${tag("vII", "0.00")}
    ${tag("vIPI", "0.00")}
    ${tag("vIPIDevol", "0.00")}
    ${tag("vPIS", "0.00")}
    ${tag("vCOFINS", "0.00")}
    ${tag("vOutro", "0.00")}
    ${tag("vNF", fmt(nota.valor_total))}
  </ICMSTot>
</total>
<transp>${tag("modFrete", 9)}</transp>
<pag>
  <detPag>
    ${tag("tPag", "90")}
    ${tag("vPag", fmt(nota.valor_total))}
  </detPag>
</pag>
<infAdic>
  ${tag("infCpl", "Documento emitido em ambiente de homologacao - SEM VALOR FISCAL")}
</infAdic>
</infNFe>
</NFe>`;

  return { chaveAcesso: chave, cNF, cDV, xml, infNFeId };
}
