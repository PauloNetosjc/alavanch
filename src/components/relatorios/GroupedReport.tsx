import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BRL } from "@/lib/financeiro";
import type { Group, LancEnriched } from "@/lib/relatoriosFinanceiros";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useNavigate } from "react-router-dom";

const PIE_COLORS = ["hsl(var(--primary))", "#16a34a", "#f59e0b", "#dc2626", "#0891b2", "#7c3aed", "#db2777", "#65a30d"];

interface Props {
  titulo: string;
  grupos: Group<string>[];
  groupLabel: string;          // "Categoria", "Contato", "Centro de Custo"...
  natureza: "receita" | "despesa";
  onOpenLanc?: (l: LancEnriched) => void;
  onOpenPedido?: (pedidoId: string) => void;
}

export default function GroupedReport({ titulo, grupos, groupLabel, natureza, onOpenLanc, onOpenPedido }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const nav = useNavigate();
  const cor = natureza === "receita" ? "text-emerald-700" : "text-rose-700";

  const chartData = useMemo(
    () => grupos.slice(0, 10).map((g) => ({ name: g.label.slice(0, 16), valor: Math.round(g.totals.total), pct: g.pct })),
    [grupos],
  );

  if (!grupos.length) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Sem dados para os filtros aplicados.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-3">
          <div className="text-xs font-semibold mb-2">Top {groupLabel}s — Valor</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" fontSize={10} interval={0} angle={-25} textAnchor="end" height={50} />
              <YAxis fontSize={10} />
              <Tooltip formatter={(v: any) => BRL(Number(v))} />
              <Bar dataKey="valor" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <div className="text-xs font-semibold mb-2">% por {groupLabel}</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chartData} dataKey="valor" nameKey="name" innerRadius={45} outerRadius={80} label={(e: any) => `${e.pct.toFixed(0)}%`}>
                {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => BRL(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left p-2 w-8"></th>
              <th className="text-left p-2">{groupLabel}</th>
              <th className="text-right p-2">Total</th>
              <th className="text-right p-2">{natureza === "receita" ? "Recebido" : "Pago"}</th>
              <th className="text-right p-2">Pendente</th>
              <th className="text-right p-2">Vencido</th>
              <th className="text-right p-2">%</th>
              <th className="text-right p-2">Qtd</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <>
                <tr key={g.key} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setExpanded((s) => ({ ...s, [g.key]: !s[g.key] }))}>
                  <td className="p-2">{expanded[g.key] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</td>
                  <td className="p-2 font-medium">
                    {g.label}
                    {g.sub && <span className="text-muted-foreground text-[10px] ml-2">{g.sub}</span>}
                  </td>
                  <td className={`p-2 text-right font-semibold ${cor}`}>{BRL(g.totals.total)}</td>
                  <td className="p-2 text-right">{BRL(g.totals.pago)}</td>
                  <td className="p-2 text-right">{BRL(g.totals.pendente)}</td>
                  <td className="p-2 text-right text-rose-600">{BRL(g.totals.vencido)}</td>
                  <td className="p-2 text-right">{g.pct.toFixed(1)}%</td>
                  <td className="p-2 text-right">{g.totals.qtd}</td>
                </tr>
                {expanded[g.key] && (
                  <tr key={g.key + "-exp"}>
                    <td colSpan={8} className="bg-muted/10 p-0">
                      <table className="w-full text-[11px]">
                        <thead className="bg-muted/20">
                          <tr>
                            <th className="text-left p-1.5">Data</th>
                            <th className="text-left p-1.5">Contato</th>
                            <th className="text-left p-1.5">Descrição</th>
                            <th className="text-left p-1.5">Categoria</th>
                            <th className="text-left p-1.5">Centro</th>
                            <th className="text-left p-1.5">Conta</th>
                            <th className="text-left p-1.5">Forma</th>
                            <th className="text-right p-1.5">Valor</th>
                            <th className="text-left p-1.5">Status</th>
                            <th className="p-1.5"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.rows.map((l) => (
                            <tr key={l.id} className="border-t hover:bg-background/50">
                              <td className="p-1.5">{l.data_vencimento ? new Date(l.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                              <td className="p-1.5">
                                {l.entidade_nome || "—"}
                                {l.entidade_tipo && <Badge variant="outline" className="ml-1 text-[9px] py-0">{l.entidade_tipo}</Badge>}
                              </td>
                              <td className="p-1.5">{l.descricao || "—"}</td>
                              <td className="p-1.5">{l.categoriaNome}{l.subcategoriaNome && ` › ${l.subcategoriaNome}`}</td>
                              <td className="p-1.5">{l.centroCustoNome}</td>
                              <td className="p-1.5">{l.contaNome}</td>
                              <td className="p-1.5">{l.forma_pagamento_prevista || "—"}</td>
                              <td className="p-1.5 text-right font-medium">{BRL(Number(l.valor))}</td>
                              <td className="p-1.5">
                                <Badge variant="outline" className={
                                  l.statusDerivado === "pago" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  l.statusDerivado === "vencido" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                  "bg-amber-50 text-amber-700 border-amber-200"
                                }>{l.statusDerivado}</Badge>
                              </td>
                              <td className="p-1.5 text-right whitespace-nowrap">
                                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => onOpenLanc?.(l)}>
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                                {l.pedido_id && (
                                  <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => (onOpenPedido ? onOpenPedido(l.pedido_id!) : nav(`/pedido/${l.pedido_id}`))}>
                                    PV
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
