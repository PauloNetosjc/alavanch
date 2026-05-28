import * as XLSX from "xlsx";
import { BRL } from "./financeiro";
import type { Group, LancEnriched } from "./relatoriosFinanceiros";

function fmtData(d: string | null) {
  if (!d) return "—";
  try { return new Date(d + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}

function rowsToSheet(rows: any[], sheetName: string, filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 30));
  XLSX.writeFile(wb, filename);
}

export function exportGrupos(grupos: Group<string>[], titulo: string, filename: string) {
  const linhas: any[] = [];
  for (const g of grupos) {
    linhas.push({
      Grupo: g.label,
      Subgrupo: g.sub || "",
      "Valor Total": g.totals.total,
      "Pago/Recebido": g.totals.pago,
      Pendente: g.totals.pendente,
      Vencido: g.totals.vencido,
      "%": g.pct.toFixed(2),
      Qtd: g.totals.qtd,
    });
    for (const l of g.rows) {
      linhas.push({
        Grupo: "  ↳",
        Subgrupo: "",
        Data: fmtData(l.data_vencimento),
        Pagamento: fmtData(l.data_pagamento),
        Contato: l.entidade_nome || "",
        "Tipo Contato": l.entidade_tipo || "",
        Descrição: l.descricao || "",
        Categoria: l.categoriaNome,
        Subcategoria: l.subcategoriaNome || "",
        "Centro de Custo": l.centroCustoNome,
        Conta: l.contaNome,
        "Forma Pgto.": l.forma_pagamento_prevista || "",
        Valor: Number(l.valor),
        Status: l.statusDerivado,
      });
    }
  }
  rowsToSheet(linhas, titulo, filename);
}

export function exportLancs(rows: LancEnriched[], titulo: string, filename: string) {
  const linhas = rows.map((l) => ({
    Data: fmtData(l.data_vencimento),
    Pagamento: fmtData(l.data_pagamento),
    Contato: l.entidade_nome || "",
    "Tipo Contato": l.entidade_tipo || "",
    Descrição: l.descricao || "",
    Categoria: l.categoriaNome,
    Subcategoria: l.subcategoriaNome || "",
    "Centro de Custo": l.centroCustoNome,
    Conta: l.contaNome,
    "Forma Pgto.": l.forma_pagamento_prevista || "",
    Valor: Number(l.valor),
    Status: l.statusDerivado,
  }));
  rowsToSheet(linhas, titulo, filename);
}

export function exportReceitaPorPedido(linhas: any[], filename: string) {
  rowsToSheet(linhas, "Receita por Pedido", filename);
}

export function imprimirRelatorio(html: string, titulo: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111}
    h1{font-size:18px;margin:0 0 4px}
    .meta{font-size:11px;color:#555;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px}
    th,td{border:1px solid #ddd;padding:5px 7px;text-align:left}
    th{background:#f4f4f4}
    .right{text-align:right}
    .group{background:#fafafa;font-weight:bold}
    @media print { .noprint{display:none} }
  </style></head><body>
  <h1>${titulo}</h1>
  <div class="meta">Impresso em ${new Date().toLocaleString("pt-BR")}</div>
  ${html}
  <script>window.onload=()=>window.print();</script>
  </body></html>`);
  w.document.close();
}

export { BRL };
