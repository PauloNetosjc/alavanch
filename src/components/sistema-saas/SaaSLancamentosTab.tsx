import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileSpreadsheet, Printer, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { BaixaLancamentoSaaSDialog } from "./BaixaLancamentoSaaSDialog";
import { LancamentoSaaSDialog } from "./LancamentoSaaSDialog";
import type { SaasLancamento, SaasCategoria, SaasCentro, SaasConta, SaasForma, brl as _brl } from "./saasFinTypes";
import { brl } from "./saasFinTypes";

type Base = { id: string; nome: string; sistema_saas_id: string | null; plano?: string };
type Sistema = { id: string; nome: string };

function statusBadge(s: string) {
  const m: Record<string, string> = {
    pendente: "bg-amber-100 text-amber-800",
    pago: "bg-emerald-100 text-emerald-800",
    vencido: "bg-red-100 text-red-800",
    cancelado: "bg-zinc-200 text-zinc-700",
  };
  return <Badge className={`${m[s] || "bg-zinc-200 text-zinc-700"} border-0 capitalize`}>{s}</Badge>;
}

export function SaaSLancamentosTab({ tipo }: { tipo: "receita" | "despesa" }) {
  const [loading, setLoading] = useState(true);
  const [lancs, setLancs] = useState<SaasLancamento[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [categorias, setCategorias] = useState<SaasCategoria[]>([]);
  const [centros, setCentros] = useState<SaasCentro[]>([]);
  const [contas, setContas] = useState<SaasConta[]>([]);
  const [formas, setFormas] = useState<SaasForma[]>([]);

  // filtros
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroBase, setFiltroBase] = useState("todas");
  const [filtroSistema, setFiltroSistema] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroCentro, setFiltroCentro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [periodoIni, setPeriodoIni] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");

  const [baixando, setBaixando] = useState<SaasLancamento | null>(null);
  const [editando, setEditando] = useState<SaasLancamento | null>(null);
  const [criando, setCriando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const [l, b, s, cat, cc, ct, fp] = await Promise.all([
      supabase.from("saas_lancamentos_financeiros" as any).select("*").eq("tipo", tipo).order("data_vencimento", { ascending: false }),
      supabase.from("bases_clientes" as any).select("id,nome,plano,sistema_saas_id").order("nome"),
      supabase.from("sistemas_saas" as any).select("id,nome").order("nome"),
      supabase.from("saas_categorias_financeiras" as any).select("*").order("ordem"),
      supabase.from("saas_centros_custo" as any).select("*").order("ordem"),
      supabase.from("saas_contas_bancarias" as any).select("id,nome,ativo").order("nome"),
      supabase.from("saas_formas_pagamento" as any).select("*").order("ordem"),
    ]);
    setLancs((l.data || []) as any);
    setBases((b.data || []) as any);
    setSistemas((s.data || []) as any);
    setCategorias((cat.data || []) as any);
    setCentros((cc.data || []) as any);
    setContas((ct.data || []) as any);
    setFormas((fp.data || []) as any);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, [tipo]);

  const baseById = useMemo(() => Object.fromEntries(bases.map((b) => [b.id, b])), [bases]);
  const sistemaById = useMemo(() => Object.fromEntries(sistemas.map((s) => [s.id, s])), [sistemas]);
  const catById = useMemo(() => Object.fromEntries(categorias.map((c) => [c.id, c])), [categorias]);
  const centroById = useMemo(() => Object.fromEntries(centros.map((c) => [c.id, c])), [centros]);
  const contaById = useMemo(() => Object.fromEntries(contas.map((c) => [c.id, c])), [contas]);

  const filtrados = useMemo(() => {
    return lancs.filter((l) => {
      if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
      if (filtroBase !== "todas" && l.base_cliente_id !== filtroBase) return false;
      if (filtroSistema !== "todos") {
        const sid = l.sistema_saas_id || (l.base_cliente_id ? baseById[l.base_cliente_id]?.sistema_saas_id : null);
        if (sid !== filtroSistema) return false;
      }
      if (filtroCategoria !== "todas" && l.categoria_id !== filtroCategoria) return false;
      if (filtroCentro !== "todos" && l.centro_custo_id !== filtroCentro) return false;
      if (periodoIni && (!l.data_vencimento || l.data_vencimento < periodoIni)) return false;
      if (periodoFim && (!l.data_vencimento || l.data_vencimento > periodoFim)) return false;
      if (busca) {
        const q = busca.toLowerCase();
        const hay = `${l.descricao || ""} ${l.fornecedor_nome || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [lancs, filtroStatus, filtroBase, filtroSistema, filtroCategoria, filtroCentro, busca, periodoIni, periodoFim, baseById]);

  const totais = useMemo(() => {
    const pend = filtrados.filter((l) => l.status === "pendente").reduce((s, l) => s + Number(l.valor || 0), 0);
    const pago = filtrados.filter((l) => l.status === "pago").reduce((s, l) => s + Number(l.valor || 0), 0);
    const venc = filtrados.filter((l) => l.status === "vencido" || (l.status === "pendente" && l.data_vencimento && l.data_vencimento < new Date().toISOString().slice(0, 10))).reduce((s, l) => s + Number(l.valor || 0), 0);
    return { pend, pago, venc, total: pend + pago };
  }, [filtrados]);

  const alterarVencimento = async (l: SaasLancamento) => {
    const v = prompt("Novo vencimento (AAAA-MM-DD)", l.data_vencimento || "");
    if (!v) return;
    const { error } = await supabase.from("saas_lancamentos_financeiros" as any).update({ data_vencimento: v }).eq("id", l.id);
    if (error) toast.error(error.message); else { toast.success("Vencimento alterado"); carregar(); }
  };
  const cancelar = async (l: SaasLancamento) => {
    if (l.status === "pago") { toast.error("Lançamento pago não pode ser cancelado, apenas estornado"); return; }
    if (!confirm("Cancelar este lançamento?")) return;
    const { error } = await supabase.from("saas_lancamentos_financeiros" as any).update({ status: "cancelado" }).eq("id", l.id);
    if (error) toast.error(error.message);
    else {
      if (l.cobranca_id) await supabase.from("base_cobrancas" as any).update({ status: "cancelado" }).eq("id", l.cobranca_id);
      toast.success("Cancelado"); carregar();
    }
  };

  const exportExcel = () => {
    const rows = filtrados.map((l) => ({
      Tipo: l.tipo,
      Origem: l.origem,
      Base: l.base_cliente_id ? baseById[l.base_cliente_id]?.nome : "",
      Sistema: l.sistema_saas_id ? sistemaById[l.sistema_saas_id]?.nome : "",
      Fornecedor: l.fornecedor_nome || "",
      Descricao: l.descricao || "",
      Categoria: l.categoria_id ? catById[l.categoria_id]?.nome : "",
      CentroCusto: l.centro_custo_id ? centroById[l.centro_custo_id]?.nome : "",
      Conta: l.conta_bancaria_id ? contaById[l.conta_bancaria_id]?.nome : "",
      FormaPrevista: l.forma_pagamento_prevista || "",
      FormaReal: l.forma_pagamento_real || "",
      Competencia: l.data_competencia || "",
      Vencimento: l.data_vencimento || "",
      Pagamento: l.data_pagamento || "",
      Valor: Number(l.valor || 0),
      Status: l.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tipo === "receita" ? "A Receber SaaS" : "A Pagar SaaS");
    XLSX.writeFile(wb, `saas_${tipo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Em aberto</div><div className="text-base font-display text-amber-700">{brl(totais.pend)}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground">{tipo === "receita" ? "Recebido" : "Pago"}</div><div className="text-base font-display text-emerald-700">{brl(totais.pago)}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Vencido</div><div className="text-base font-display text-red-700">{brl(totais.venc)}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Total filtrado</div><div className="text-base font-display">{brl(totais.total)}</div></Card>
      </div>

      {/* Filtros + ações */}
      <Card className="p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
          <div><Label className="text-[10px]">Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{["todos","pendente","pago","vencido","cancelado"].map(s=> <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {tipo === "receita" && (
            <div><Label className="text-[10px]">Base</Label>
              <Select value={filtroBase} onValueChange={setFiltroBase}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todas">Todas</SelectItem>{bases.map(b=> <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {tipo === "receita" && (
            <div><Label className="text-[10px]">Sistema</Label>
              <Select value={filtroSistema} onValueChange={setFiltroSistema}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="todos">Todos</SelectItem>{sistemas.map(s=> <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label className="text-[10px]">Categoria</Label>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todas">Todas</SelectItem>{categorias.filter(c=>c.tipo===tipo).map(c=> <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-[10px]">Centro de Custo</Label>
            <Select value={filtroCentro} onValueChange={setFiltroCentro}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos</SelectItem>{centros.map(c=> <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-[10px]">Vencimento de</Label><Input type="date" className="h-8" value={periodoIni} onChange={(e)=>setPeriodoIni(e.target.value)} /></div>
          <div><Label className="text-[10px]">até</Label><Input type="date" className="h-8" value={periodoFim} onChange={(e)=>setPeriodoFim(e.target.value)} /></div>
          <div className="col-span-2 lg:col-span-2"><Label className="text-[10px]">Buscar</Label><Input className="h-8" value={busca} onChange={(e)=>setBusca(e.target.value)} placeholder="Descrição, fornecedor..." /></div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1"><Printer className="w-3.5 h-3.5" /> Imprimir</Button>
          <Button size="sm" variant="outline" onClick={exportExcel} className="gap-1"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</Button>
          <Button size="sm" onClick={() => setCriando(true)} className="gap-1"><Plus className="w-3.5 h-3.5" /> Novo lançamento</Button>
        </div>
      </Card>

      {/* Tabela */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase">
              <tr>
                {tipo === "receita" ? <th className="text-left p-2">Base / Sistema</th> : <th className="text-left p-2">Fornecedor</th>}
                <th className="text-left p-2">Descrição</th>
                <th className="text-left p-2">Categoria</th>
                <th className="text-left p-2">Centro</th>
                <th className="text-left p-2">Conta</th>
                <th className="text-left p-2">Vencimento</th>
                <th className="text-right p-2">Valor</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">{tipo === "receita" ? "Recebimento" : "Pagamento"}</th>
                <th className="text-right p-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhum lançamento</td></tr>}
              {filtrados.map((l) => {
                const b = l.base_cliente_id ? baseById[l.base_cliente_id] : null;
                const sis = l.sistema_saas_id ? sistemaById[l.sistema_saas_id]?.nome : (b?.sistema_saas_id ? sistemaById[b.sistema_saas_id]?.nome : null);
                return (
                  <tr key={l.id} className="border-t hover:bg-muted/20">
                    <td className="p-2">
                      {tipo === "receita" ? (
                        <div><div className="font-medium">{b?.nome || "—"}</div><div className="text-[10px] text-muted-foreground">{sis || "—"}</div></div>
                      ) : (l.fornecedor_nome || "—")}
                    </td>
                    <td className="p-2">{l.descricao || "—"}</td>
                    <td className="p-2">{l.categoria_id ? catById[l.categoria_id]?.nome : "—"}</td>
                    <td className="p-2">{l.centro_custo_id ? centroById[l.centro_custo_id]?.nome : "—"}</td>
                    <td className="p-2">{l.conta_bancaria_id ? contaById[l.conta_bancaria_id]?.nome : "—"}</td>
                    <td className="p-2">{l.data_vencimento ? new Date(l.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-2 text-right">{brl(Number(l.valor))}</td>
                    <td className="p-2">{statusBadge(l.status)}</td>
                    <td className="p-2">{l.data_pagamento ? new Date(l.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}{l.forma_pagamento_real ? <div className="text-[10px] text-muted-foreground">{l.forma_pagamento_real}</div> : null}</td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button size="sm" variant="ghost" onClick={() => setEditando(l)}>Editar</Button>
                        {l.status === "pendente" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setBaixando(l)}>{tipo === "receita" ? "Receber" : "Pagar"}</Button>
                            <Button size="sm" variant="ghost" onClick={() => alterarVencimento(l)}>Vencimento</Button>
                            <Button size="sm" variant="ghost" onClick={() => cancelar(l)}>Cancelar</Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {baixando && (
        <BaixaLancamentoSaaSDialog lanc={baixando} contas={contas} formas={formas} onClose={() => setBaixando(null)} onSaved={carregar} />
      )}
      {(criando || editando) && (
        <LancamentoSaaSDialog
          tipo={tipo}
          lanc={editando}
          bases={bases}
          categorias={categorias}
          centros={centros}
          contas={contas}
          formas={formas}
          onClose={() => { setCriando(false); setEditando(null); }}
          onSaved={carregar}
        />
      )}
    </div>
  );
}
