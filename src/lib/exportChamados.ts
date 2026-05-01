import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ChamadoExport = {
  codigo: string;
  cliente: string;
  pedido: string;
  status: string;
  prioridade: string;
  data_agendamento: string;
  hora_agendamento: string;
  tecnico: string;
};

const HEADERS: { key: keyof ChamadoExport; label: string }[] = [
  { key: "codigo", label: "Código" },
  { key: "cliente", label: "Cliente" },
  { key: "pedido", label: "Pedido" },
  { key: "status", label: "Status" },
  { key: "prioridade", label: "Prioridade" },
  { key: "data_agendamento", label: "Data" },
  { key: "hora_agendamento", label: "Hora" },
  { key: "tecnico", label: "Técnico" },
];

export function exportChamadosCSV(rows: ChamadoExport[], filename = "meus-chamados.csv") {
  const csv = Papa.unparse({
    fields: HEADERS.map((h) => h.label),
    data: rows.map((r) => HEADERS.map((h) => r[h.key] ?? "")),
  });
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportChamadosPDF(
  rows: ChamadoExport[],
  meta: { titulo?: string; filtros?: string } = {},
  filename = "meus-chamados.pdf"
) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(meta.titulo || "Meus Chamados", 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(100);
  const sub = `Gerado em ${new Date().toLocaleString("pt-BR")}${meta.filtros ? "  •  " + meta.filtros : ""}  •  Total: ${rows.length}`;
  doc.text(sub, 14, 20);

  autoTable(doc, {
    startY: 26,
    head: [HEADERS.map((h) => h.label)],
    body: rows.map((r) => HEADERS.map((h) => r[h.key] ?? "")),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [22, 101, 52] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.save(filename);
}
