// danfeService — DANFE simplificado para HOMOLOGAÇÃO (com marca d'água).
// Usa pdf-lib para gerar um PDF mínimo com dados essenciais.

// @ts-ignore npm specifier
import { PDFDocument, StandardFonts, rgb, degrees } from "npm:pdf-lib@1.17.1";

export interface DanfeData {
  chaveAcesso: string;
  numero: number;
  serie: number;
  protocolo?: string | null;
  emit: { razao: string; cnpj: string; uf: string; municipio: string };
  dest: { nome: string; documento: string };
  itens: Array<{ cProd: string; xProd: string; qCom: number; vUnCom: number; vProd: number }>;
  valorTotal: number;
  dataEmissao: string;
}

export async function gerarDanfeHomologacao(d: DanfeData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const draw = (text: string, x: number, y: number, size = 9, bold = false) => {
    page.drawText(text, { x, y, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
  };

  // Marca d'água HOMOLOGAÇÃO - SEM VALOR FISCAL
  page.drawText("HOMOLOGACAO - SEM VALOR FISCAL", {
    x: 50, y: 420, size: 38, font: fontBold,
    color: rgb(0.85, 0.85, 0.85),
    rotate: degrees(35),
  });

  let y = 800;
  draw("DANFE - Documento Auxiliar da Nota Fiscal Eletronica (Homologacao)", 40, y, 12, true); y -= 18;
  draw(`NF-e n. ${d.numero}  -  Serie ${d.serie}`, 40, y, 10, true); y -= 14;
  draw(`Chave de acesso: ${d.chaveAcesso}`, 40, y, 8); y -= 12;
  draw(`Protocolo: ${d.protocolo ?? "(pendente)"}`, 40, y, 8); y -= 12;
  draw(`Emissao: ${d.dataEmissao}`, 40, y, 8); y -= 20;

  draw("EMITENTE", 40, y, 10, true); y -= 14;
  draw(d.emit.razao, 40, y); y -= 12;
  draw(`CNPJ: ${d.emit.cnpj}   ${d.emit.municipio}/${d.emit.uf}`, 40, y); y -= 20;

  draw("DESTINATARIO", 40, y, 10, true); y -= 14;
  draw(d.dest.nome, 40, y); y -= 12;
  draw(`Doc: ${d.dest.documento}`, 40, y); y -= 20;

  draw("ITENS", 40, y, 10, true); y -= 14;
  draw("Cod", 40, y, 8, true);
  draw("Descricao", 90, y, 8, true);
  draw("Qtd", 360, y, 8, true);
  draw("V.Unit", 410, y, 8, true);
  draw("V.Total", 470, y, 8, true);
  y -= 12;

  for (const it of d.itens) {
    if (y < 80) break;
    draw(String(it.cProd).slice(0, 12), 40, y, 8);
    draw(String(it.xProd).slice(0, 50), 90, y, 8);
    draw(Number(it.qCom).toFixed(2), 360, y, 8);
    draw(Number(it.vUnCom).toFixed(2), 410, y, 8);
    draw(Number(it.vProd).toFixed(2), 470, y, 8);
    y -= 11;
  }

  y -= 6;
  draw(`VALOR TOTAL DA NOTA: R$ ${Number(d.valorTotal).toFixed(2)}`, 40, y, 11, true);

  return await pdf.save();
}
