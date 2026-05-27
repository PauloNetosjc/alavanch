// Gera uma assinatura simulada (caligráfica) + carimbo com dados da loja
// como Data URL (image/svg+xml) para registrar a pré-assinatura da loja.

export type LojaSignatureData = {
  nome: string;
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
  const nomeAssin = d.responsavel || d.nome;
  const W = 520, H = 220;
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
  <text x="20" y="80" class="sig" font-size="46" font-style="italic">${escapeXml(nomeAssin)}</text>
  <line x1="20" y1="100" x2="380" y2="100" stroke="#1e3a5f" stroke-width="1.2"/>
  <text x="20" y="118" class="stamp" font-size="11">Assinado pela loja · ${escapeXml(dataHora)}</text>

  <!-- carimbo -->
  <g transform="translate(${W - 200}, 30) rotate(-6)">
    <rect x="0" y="0" width="190" height="160" rx="8" ry="8"
      fill="none" stroke="#1e3a5f" stroke-width="3" stroke-dasharray="0"/>
    <rect x="6" y="6" width="178" height="148" rx="6" ry="6"
      fill="none" stroke="#1e3a5f" stroke-width="1"/>
    <text x="95" y="30" text-anchor="middle" class="stamp" font-size="11" font-weight="bold">CONTRATANTE</text>
    <text x="95" y="58" text-anchor="middle" class="stamp" font-size="13" font-weight="bold">${escapeXml(d.nome).slice(0, 28)}</text>
    ${d.cnpj ? `<text x="95" y="78" text-anchor="middle" class="stamp" font-size="10">CNPJ: ${escapeXml(d.cnpj)}</text>` : ""}
    ${cidadeUf ? `<text x="95" y="94" text-anchor="middle" class="stamp" font-size="10">${escapeXml(cidadeUf)}</text>` : ""}
    ${linha3 ? `<text x="95" y="110" text-anchor="middle" class="stamp" font-size="9">${escapeXml(linha3).slice(0, 36)}</text>` : ""}
    <line x1="20" y1="122" x2="170" y2="122" stroke="#1e3a5f" stroke-width="0.8"/>
    <text x="95" y="138" text-anchor="middle" class="stamp" font-size="10" font-weight="bold">ASSINADO DIGITALMENTE</text>
    <text x="95" y="152" text-anchor="middle" class="stamp" font-size="9">${escapeXml(dataHora)}</text>
  </g>

  <!-- rodapé -->
  <text x="20" y="${H - 40}" class="stamp" font-size="10" font-weight="bold">${escapeXml(d.nome)}</text>
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
