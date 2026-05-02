import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BRL } from "./financeiro";

export type LancRow = {
  data: string;          // ISO
  descricao: string;
  categoria: string;
  conta: string;
  tipo: "entrada" | "saida" | string;
  status: string;
  valor: number;
};

export interface ExportFilters {
  competencia?: string;
  conta?: string;
  categoria?: string;
  tipo?: string;
}

function fmtData(d: string) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

export function exportarCSV(rows: LancRow[], filename = "extrato.csv") {
  const header = ["Data", "Descrição", "Categoria", "Conta", "Tipo", "Status", "Valor"];
  const lines = [header.join(";")];
  for (const r of rows) {
    lines.push([
      fmtData(r.data),
      `"${(r.descricao || "").replace(/"/g, '""')}"`,
      `"${(r.categoria || "").replace(/"/g, '""')}"`,
      `"${(r.conta || "").replace(/"/g, '""')}"`,
      r.tipo,
      r.status,
      String(Number(r.valor || 0).toFixed(2)).replace(".", ","),
    ].join(";"));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportarPDF(rows: LancRow[], titulo: string, filtros: ExportFilters, filename = "extrato.pdf") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(titulo, 40, 40);
  doc.setFontSize(9);
  const filtrosTxt = [
    filtros.competencia && `Competência: ${filtros.competencia}`,
    filtros.conta && `Conta: ${filtros.conta}`,
    filtros.categoria && `Categoria: ${filtros.categoria}`,
    filtros.tipo && `Tipo: ${filtros.tipo}`,
  ].filter(Boolean).join("  •  ");
  if (filtrosTxt) doc.text(filtrosTxt, 40, 56);

  const totalEnt = rows.filter((r) => r.tipo === "entrada").reduce((s, r) => s + Number(r.valor || 0), 0);
  const totalSai = rows.filter((r) => r.tipo === "saida").reduce((s, r) => s + Number(r.valor || 0), 0);

  autoTable(doc, {
    startY: 76,
    head: [["Data", "Descrição", "Categoria", "Conta", "Tipo", "Valor"]],
    body: rows.map((r) => [
      fmtData(r.data),
      r.descricao || "—",
      r.categoria || "—",
      r.conta || "—",
      r.tipo,
      BRL(Number(r.valor || 0)),
    ]),
    foot: [["", "", "", "Entradas", BRL(totalEnt), ""], ["", "", "", "Saídas", BRL(totalSai), ""]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 30, 30] },
  });
  doc.save(filename);
}
