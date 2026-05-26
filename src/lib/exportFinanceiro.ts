import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
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

export function exportarExcel(rows: LancRow[], filename = "extrato.xlsx") {
  const data = rows.map((r) => ({
    Data: fmtData(r.data),
    Descrição: r.descricao || "",
    Categoria: r.categoria || "",
    Conta: r.conta || "",
    Tipo: r.tipo,
    Status: r.status,
    Valor: Number(r.valor || 0),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");
  XLSX.writeFile(wb, filename);
}

export function imprimirLista(rows: LancRow[], titulo: string) {
  const totalEnt = rows.filter((r) => r.tipo === "entrada").reduce((s, r) => s + Number(r.valor || 0), 0);
  const totalSai = rows.filter((r) => r.tipo === "saida").reduce((s, r) => s + Number(r.valor || 0), 0);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111}
    h1{font-size:18px;margin:0 0 12px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
    th{background:#f4f4f4}
    tfoot td{font-weight:bold;background:#fafafa}
    .right{text-align:right}
  </style></head><body>
  <h1>${titulo}</h1>
  <table>
    <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Tipo</th><th>Status</th><th class="right">Valor</th></tr></thead>
    <tbody>
      ${rows.map((r) => `<tr>
        <td>${fmtData(r.data)}</td>
        <td>${(r.descricao || "—").replace(/</g, "&lt;")}</td>
        <td>${(r.categoria || "—").replace(/</g, "&lt;")}</td>
        <td>${(r.conta || "—").replace(/</g, "&lt;")}</td>
        <td>${r.tipo}</td>
        <td>${r.status}</td>
        <td class="right">${BRL(Number(r.valor || 0))}</td>
      </tr>`).join("")}
    </tbody>
    <tfoot>
      <tr><td colspan="6" class="right">Total Entradas</td><td class="right">${BRL(totalEnt)}</td></tr>
      <tr><td colspan="6" class="right">Total Saídas</td><td class="right">${BRL(totalSai)}</td></tr>
    </tfoot>
  </table>
  <script>window.onload=()=>{window.print();}</script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
