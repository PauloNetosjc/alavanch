import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronLeft, ChevronRight, FileDown, FileText } from "lucide-react";
import { BRL, somarMovimento, saldoFinal, ultimasCompetencias } from "@/lib/financeiro";
import { exportarCSV, exportarPDF, type LancRow } from "@/lib/exportFinanceiro";

type Lanc = { id: string; tipo: string; valor: number; descricao: string | null;
  data_pagamento: string | null; data_vencimento: string | null; status: string | null;
  categoria_id: string | null; conta_id: string | null };
type Cat = { id: string; nome: string; tipo: string | null; parent_id: string | null };

export default function ExtratoConta() {
  const { id } = useParams();
  const nav = useNavigate();
  const [conta, setConta] = useState<any>(null);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<"" | "entrada" | "saida">("");
  const [filtroCat, setFiltroCat] = useState<string>("");
  const [compIdx, setCompIdx] = useState(5);

  const competencias = useMemo(() => ultimasCompetencias(new Date(), 6), []);
  const compAtual = competencias[compIdx];

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: c }, { data: l }, { data: cat }] = await Promise.all([
        supabase.from("contas_bancarias").select("*").eq("id", id).maybeSingle(),
        supabase.from("lancamentos_financeiros").select("*").eq("conta_id", id).order("data_pagamento", { ascending: false }).limit(2000),
        supabase.from("categorias_financeiras").select("id,nome,tipo,parent_id"),
      ]);
      setConta(c); setLancs((l as Lanc[]) || []); setCats((cat as Cat[]) || []);
    })();
  }, [id]);

  const lancsCompetencia = useMemo(() => {
    return lancs.filter((l) => {
      const d = l.data_pagamento || l.data_vencimento;
      if (!d) return false;
      const [y, m] = d.split("-");
      return Number(y) === compAtual.year && Number(m) === compAtual.month;
    });
  }, [lancs, compAtual]);

  const lancsFiltrados = useMemo(() => {
    return lancsCompetencia.filter((l) => {
      if (filtroTipo && l.tipo !== filtroTipo) return false;
      if (filtroCat && l.categoria_id !== filtroCat) return false;
      return true;
    });
  }, [lancsCompetencia, filtroTipo, filtroCat]);

  const totais = somarMovimento(lancsCompetencia.map((l) => ({ tipo: l.tipo as any, valor: Number(l.valor) || 0 })));
  const saldoInicial = Number(conta?.saldo_inicial || 0);

  return (
    <div className="p-8 space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <button onClick={() => nav("/contas")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="text-3xl font-bold mt-2">Extrato da Conta</h1>
        <p className="text-muted-foreground">{conta?.nome || "—"}</p>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Competência</div>
          <div className="text-sm font-medium">
            {new Date(compAtual.year, compAtual.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => setCompIdx(Math.max(0, compIdx - 1))}><ChevronLeft className="w-4 h-4" /></Button>
          {competencias.map((c, i) => (
            <button key={c.key}
              onClick={() => setCompIdx(i)}
              className={`px-4 py-1.5 rounded-md text-sm capitalize ${i === compIdx ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70"}`}>
              {c.label}
            </button>
          ))}
          <Button size="icon" variant="ghost" onClick={() => setCompIdx(Math.min(competencias.length - 1, compIdx + 1))}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-5">
          <div className="text-xs uppercase tracking-wider text-blue-700">Saldo Inicial</div>
          <div className="text-2xl font-bold mt-2">{BRL(saldoInicial)}</div>
        </div>
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-5">
          <div className="text-xs uppercase tracking-wider text-emerald-700">Total Entradas</div>
          <div className="text-2xl font-bold mt-2 text-emerald-700">{BRL(totais.entradas)}</div>
        </div>
        <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/40 p-5">
          <div className="text-xs uppercase tracking-wider text-rose-700">Total Saídas</div>
          <div className="text-2xl font-bold mt-2 text-rose-700">{BRL(totais.saidas)}</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-medium mb-2">Filtrar por Tipo</div>
            <div className="flex gap-2">
              <button onClick={() => setFiltroTipo(filtroTipo === "entrada" ? "" : "entrada")}
                className={`px-4 py-1.5 rounded-md text-sm ${filtroTipo === "entrada" ? "bg-emerald-600 text-white" : "bg-muted"}`}>Entradas (a receber)</button>
              <button onClick={() => setFiltroTipo(filtroTipo === "saida" ? "" : "saida")}
                className={`px-4 py-1.5 rounded-md text-sm ${filtroTipo === "saida" ? "bg-rose-600 text-white" : "bg-muted"}`}>Saídas (a pagar)</button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const rows: LancRow[] = lancsFiltrados.map((l) => ({
                data: l.data_pagamento || l.data_vencimento || "",
                descricao: l.descricao || "",
                categoria: cats.find((c) => c.id === l.categoria_id)?.nome || "",
                conta: conta?.nome || "",
                tipo: l.tipo,
                status: l.status || "",
                valor: Number(l.valor || 0),
              }));
              exportarCSV(rows, `extrato-${conta?.nome || "conta"}-${compAtual.key}.csv`);
            }}><FileDown className="w-4 h-4 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => {
              const rows: LancRow[] = lancsFiltrados.map((l) => ({
                data: l.data_pagamento || l.data_vencimento || "",
                descricao: l.descricao || "",
                categoria: cats.find((c) => c.id === l.categoria_id)?.nome || "",
                conta: conta?.nome || "",
                tipo: l.tipo,
                status: l.status || "",
                valor: Number(l.valor || 0),
              }));
              const compLabel = new Date(compAtual.year, compAtual.month - 1, 1)
                .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
              exportarPDF(rows, `Extrato — ${conta?.nome || "Conta"}`, {
                competencia: compLabel,
                conta: conta?.nome,
                categoria: cats.find((c) => c.id === filtroCat)?.nome,
                tipo: filtroTipo || "todos",
              }, `extrato-${conta?.nome || "conta"}-${compAtual.key}.pdf`);
            }}><FileText className="w-4 h-4 mr-1" /> PDF</Button>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Filtrar por Categoria</div>
          <Select value={filtroCat || "all"} onValueChange={(v) => setFiltroCat(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {cats.filter((c) => !c.parent_id).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="text-left py-3 font-medium">Data</th>
                <th className="text-left py-3 font-medium">Descrição</th>
                <th className="text-left py-3 font-medium">Categoria</th>
                <th className="text-right py-3 font-medium">Valor</th>
                <th className="text-center py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {lancsFiltrados.map((l) => (
                <tr key={l.id} className="border-b hover:bg-muted/30">
                  <td className="py-3">{l.data_pagamento ? new Date(l.data_pagamento).toLocaleDateString("pt-BR") : "—"}</td>
                  <td>{l.descricao || "—"}</td>
                  <td className="text-muted-foreground">{cats.find((c) => c.id === l.categoria_id)?.nome || "—"}</td>
                  <td className={`text-right font-medium ${l.tipo === "entrada" ? "text-emerald-600" : "text-rose-600"}`}>
                    {l.tipo === "entrada" ? "+" : "−"} {BRL(Number(l.valor))}
                  </td>
                  <td className="text-center"><Badge variant="secondary">{l.status || "—"}</Badge></td>
                </tr>
              ))}
              {!lancsFiltrados.length && (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nenhuma movimentação no período</td></tr>
              )}
            </tbody>
            {lancsFiltrados.length > 0 && (
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td colSpan={3} className="py-3 text-right">Saldo Final</td>
                  <td className="text-right">{BRL(saldoFinal(saldoInicial, totais.entradas, totais.saidas))}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
