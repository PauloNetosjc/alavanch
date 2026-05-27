// Gera uma assinatura simulada (caligráfica) + carimbo com dados da loja
// como Data URL (image/svg+xml) para registrar a pré-assinatura da loja.

export type LojaSignatureData = {
  nome: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  responsavel?: string | null;
};

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}

export function buildLojaSignatureSvg(d: LojaSignatureData): string {
  const dataHora = new Date().toLocaleString("pt-BR");
  const razaoSocial = d.razao_social || d.nome;
  const nomeFantasia = d.nome_fantasia && d.nome_fantasia !== razaoSocial ? d.nome_fantasia : null;
  const nomeAssin = d.responsavel || razaoSocial;
  const W = 620, H = 240;
  const cidadeUf = [d.cidade, d.uf].filter(Boolean).join("/");
  const linha2 = [d.cnpj ? `CNPJ: ${d.cnpj}` : null, cidadeUf].filter(Boolean).join(" · ");
  const linha3 = d.endereco || "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      .sig { font-family: 'Brush Script MT','Lucida Handwriting','Segoe Script',cursive; fill:#1e3a5f; }
      .stamp { font-family: 'Arial',sans-serif; fill:#1e3a5f; }
    </style>
  </defs>
  <!-- assinatura caligráfica -->
  <text x="22" y="78" class="sig" font-size="46" font-style="italic">${escapeXml(nomeAssin).slice(0, 38)}</text>
  <line x1="22" y1="101" x2="405" y2="101" stroke="#1e3a5f" stroke-width="1.4"/>
  <text x="22" y="120" class="stamp" font-size="12" font-weight="bold">ASSINATURA DIGITAL DA LOJA</text>
  <text x="22" y="138" class="stamp" font-size="11">${escapeXml(dataHora)}</text>

  <!-- carimbo -->
  <g transform="translate(${W - 245}, 24) rotate(-5)">
    <rect x="0" y="0" width="230" height="178" rx="8" ry="8"
      fill="none" stroke="#1e3a5f" stroke-width="3" stroke-dasharray="0"/>
    <rect x="7" y="7" width="216" height="164" rx="6" ry="6"
      fill="none" stroke="#1e3a5f" stroke-width="1"/>
    <text x="115" y="28" text-anchor="middle" class="stamp" font-size="11" font-weight="bold">CARIMBO DA LOJA</text>
    <text x="115" y="52" text-anchor="middle" class="stamp" font-size="9" font-weight="bold">RAZÃO SOCIAL</text>
    <text x="115" y="68" text-anchor="middle" class="stamp" font-size="12" font-weight="bold">${escapeXml(razaoSocial).slice(0, 32)}</text>
    ${nomeFantasia ? `<text x="115" y="84" text-anchor="middle" class="stamp" font-size="9">Fantasia: ${escapeXml(nomeFantasia).slice(0, 28)}</text>` : ""}
    ${d.cnpj ? `<text x="115" y="102" text-anchor="middle" class="stamp" font-size="11" font-weight="bold">CNPJ: ${escapeXml(d.cnpj)}</text>` : ""}
    ${cidadeUf ? `<text x="115" y="119" text-anchor="middle" class="stamp" font-size="10">${escapeXml(cidadeUf)}</text>` : ""}
    ${linha3 ? `<text x="115" y="135" text-anchor="middle" class="stamp" font-size="9">${escapeXml(linha3).slice(0, 42)}</text>` : ""}
    <line x1="24" y1="147" x2="206" y2="147" stroke="#1e3a5f" stroke-width="0.8"/>
    <text x="115" y="163" text-anchor="middle" class="stamp" font-size="10" font-weight="bold">ASSINADO DIGITALMENTE</text>
  </g>

  <!-- rodapé -->
  <text x="22" y="${H - 44}" class="stamp" font-size="10" font-weight="bold">RAZÃO SOCIAL: ${escapeXml(razaoSocial)}</text>
  ${linha2 ? `<text x="20" y="${H - 26}" class="stamp" font-size="9">${escapeXml(linha2)}</text>` : ""}
  ${linha3 ? `<text x="20" y="${H - 12}" class="stamp" font-size="9">${escapeXml(linha3)}</text>` : ""}
</svg>`;
  return svg;
}

export function buildLojaSignatureDataUrl(d: LojaSignatureData): string {
  const svg = buildLojaSignatureSvg(d);
  // utf-8 safe data URL
  const b64 = typeof window !== "undefined" && window.btoa
    ? window.btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg, "utf-8").toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
}

export async function buildLojaSignatureBlob(d: LojaSignatureData): Promise<Blob> {
  const svg = buildLojaSignatureSvg(d);
  return new Blob([svg], { type: "image/svg+xml" });
}
