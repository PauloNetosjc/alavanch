// nfeSigner — assinatura XMLDSig sobre o nó infNFe usando certificado A1 (PFX).
// Implementação usa node-forge via npm: especifier (Deno).
// Para PRODUÇÃO é mandatório uma implementação C14N completa e auditada.
// Esta versão cobre o essencial para homologação inicial.

// @ts-ignore  npm specifier
import forge from "npm:node-forge@1.3.1";
import { c14nSimples } from "./xml.ts";

export interface SignResult {
  xmlAssinado: string; // <NFe>...<infNFe.../>+<Signature/></NFe>
  digestValue: string;
  signatureValue: string;
  x509Cert: string;
}

export interface AssinarNfeParams {
  xmlNFe: string;     // contém <NFe><infNFe Id="...">...</infNFe></NFe>
  infNFeId: string;   // ex NFe + chave (sem o '#')
  pfx: Uint8Array;
  senha: string;
}

function extractInfNFe(xml: string, id: string): string {
  // pega exatamente <infNFe ...>...</infNFe>
  const re = new RegExp(`<infNFe[^>]*Id="${id}"[\\s\\S]*?</infNFe>`);
  const m = xml.match(re);
  if (!m) throw new Error("Não foi possível localizar infNFe para assinatura");
  return m[0];
}

function pfxToCredentials(pfx: Uint8Array, senha: string) {
  // forge espera binary string
  let bin = "";
  for (let i = 0; i < pfx.length; i++) bin += String.fromCharCode(pfx[i]);
  const p12Asn1 = forge.asn1.fromDer(bin);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);

  // localizar chave privada
  let key: any = null;
  let cert: any = null;
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const kArr = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (kArr && kArr.length) key = kArr[0].key;
  if (!key) {
    const kb2 = p12.getBags({ bagType: forge.pki.oids.keyBag });
    const k2 = kb2[forge.pki.oids.keyBag];
    if (k2 && k2.length) key = k2[0].key;
  }
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const cArr = certBags[forge.pki.oids.certBag];
  if (cArr && cArr.length) cert = cArr[0].cert;
  if (!key || !cert) throw new Error("Certificado A1 inválido (chave/cert não encontrados)");
  return { key, cert };
}

function certToBase64(cert: any): string {
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  return forge.util.encode64(der);
}

function sha1Base64(data: string): string {
  const md = forge.md.sha1.create();
  md.update(data, "utf8");
  return forge.util.encode64(md.digest().getBytes());
}

export function assinarNfe(params: AssinarNfeParams): SignResult {
  const { xmlNFe, infNFeId, pfx, senha } = params;
  const { key, cert } = pfxToCredentials(pfx, senha);

  // 1) Extrair e canonicalizar infNFe
  const infNFe = extractInfNFe(xmlNFe, infNFeId);
  const infCanon = c14nSimples(infNFe);
  const digestValue = sha1Base64(infCanon);

  // 2) Montar SignedInfo
  const signedInfo =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${infNFeId}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  const signedInfoCanon = c14nSimples(signedInfo);

  // 3) Assinar SignedInfo
  const md = forge.md.sha1.create();
  md.update(signedInfoCanon, "utf8");
  const sigBytes = key.sign(md);
  const signatureValue = forge.util.encode64(sigBytes);

  const x509Cert = certToBase64(cert);

  const signature =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${x509Cert}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`;

  // 4) Inserir Signature dentro de <NFe> (após </infNFe>)
  const xmlAssinado = xmlNFe.replace(/<\/NFe>\s*$/, `${signature}</NFe>`);

  return { xmlAssinado, digestValue, signatureValue, x509Cert };
}
