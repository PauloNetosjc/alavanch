// Extrai certificado e chave privada de um PFX (A1) em memória.
// NUNCA grava em disco. NUNCA loga conteúdo. Descarte após uso.

import forge from "node-forge";

export interface CertificadoExtraido {
  certPem: string;
  keyPem: string;
  caPems: string[];
}

export function extrairCertificadoPfx(pfxBase64: string, senha: string): CertificadoExtraido {
  if (!pfxBase64) throw new Error("pfxBase64 ausente");
  if (!senha) throw new Error("senha ausente");

  const der = forge.util.decode64(pfxBase64);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);

  // Chave privada
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) throw new Error("Chave privada não encontrada no PFX");
  const keyPem = forge.pki.privateKeyToPem(keyBag.key);

  // Certificado do titular + cadeia
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certs = (certBags[forge.pki.oids.certBag] ?? [])
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => !!c);
  if (!certs.length) throw new Error("Certificado não encontrado no PFX");

  // O primeiro cert é geralmente o titular; o restante é cadeia/CA.
  const titular = certs[0];
  const cadeia = certs.slice(1);
  const certPem = forge.pki.certificateToPem(titular);
  const caPems = cadeia.map((c) => forge.pki.certificateToPem(c));

  return { certPem, keyPem, caPems };
}
