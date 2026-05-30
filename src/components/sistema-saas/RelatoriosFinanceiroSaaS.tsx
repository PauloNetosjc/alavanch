import { useEffect, useMemo, useState, Fragment } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import {
  FileSpreadsheet, Printer, Search, Loader2, ChevronRight, ChevronDown, Filter, X,
} from "lucide-react";
import { brl } from "./saasFinTypes";

// ============================================================
// Tipos
// ============================================================
type Lanc = {
  id: string;
  tipo: "receita" | "despesa";
  origem: string;
  valor: number;
  status: "pendente" | "pago" | "vencido" | "cancelado";
  descricao: string | null;
  data_competencia: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  base_cliente_id: string | null;
  sistema_saas_id: string | null;
  categoria_id: string | null;
  centro_custo_id: string | null;
  conta_bancaria_id: string | null;
  cobranca_id: string | null;
  contrato_id: string | null;
  fornecedor_nome: string | null;
  forma_pagamento_prevista: string | null;
  forma_pagamento_real: string | null;
};
type Base = { id: string; nome: string; plano: string | null; sistema_saas_id: string | null };
type Nome = { id: string; nome: string };
type Cat = Nome & { parent_id: string | null };

type ReportId =
  | "receitas_base" | "receitas_sistema" | "receitas_categoria" | "receitas_plano"
  | "despesas_categoria" | "despesas_centro" | "despesas_fornecedor"
  | "resultado_mes" | "fluxo_previsto_realizado" | "inadimplencia_base";

const REPORTS: { id: ReportId; label: string; tipo: "receita" | "despesa" | "ambos" }[] = [
  { id: "receitas_base",            label: "Receitas por Base",            tipo: "receita" },
  { id: "receitas_sistema",         label: "Receitas por Sistema Vendido", tipo: "receita" },
  { id: "receitas_categoria",       label: "Receitas por Categoria",       tipo: "receita" },
  { id: "receitas_plano",           label: "Receitas por Plano",           tipo: "receita" },
  { id: "despesas_categoria",       label: "Despesas por Categoria",       tipo: "despesa" },
  { id: "despesas_centro",          label: "Despesas por Centro de Custo", tipo: "despesa" },
  { id: "despesas_fornecedor",      label: "Despesas por Fornecedor",      tipo: "despesa" },
  { id: "resultado_mes",            label: "Resultado mês a mês",          tipo: "ambos" },
  { id: "fluxo_previsto_realizado", label: "Fluxo previsto x realizado",   tipo: "ambos" },
  { id: "inadimplencia_base",       label: "Inadimplência por Base",       tipo: "receita" },
];

const COLORS = { receita: "#15803d", despesa: "#dc2626", previsto: "#ca8a04", resultado: "#0c4a6e" };
const PIE = ["#15803d", "#0c4a6e", "#ca8a04", "#7c3aed", "#dc2626", "#0891b2", "#db2777", "#65a30d", "#9333ea", "#ea580c"];

// ============================================================
// Helpers
// ============================================================
const today = () => new Date().toISOString().slice(0, 10);
const firstDayOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const lastDayOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
};
const fmtData = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const isVencido = (l: Lanc) =>
  l.status === "vencido" ||
  (l.status === "pendente" && !!l.data_vencimento && l.data_vencimento < today());

function exportXlsx(rows: any[], nome: string) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 30));
  XLSX.writeFile(wb, `${nome}_${today()}.xlsx`);
}

function imprimirSecao(elementId: string, titulo: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111}
    h1{font-size:18px;margin:0 0 4px}
    h2{font-size:14px;margin:14px 0 6px}
    .meta{font-size:11px;color:#555;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
    th,td{border:1px solid #ddd;padding:5px 7px;text-align:left}
    th{background:#f4f4f4}
    .right{text-align:right}
    .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px}
    .kpi{border:1px solid #e5e5e5;padding:6px 8px;border-radius:4px}
    .kpi .l{font-size:9px;color:#666;text-transform:uppercase}
    .kpi .v{font-size:12px;font-weight:bold}
    svg, .recharts-wrapper, button { display:none !important; }
    .no-print{display:none !important}
  </style></head><body>
  <h1>${titulo}</h1>
  <div class="meta">Impresso em ${new Date().toLocaleString("pt-BR")}</div>
  ${el.innerHTML}
  <script>window.onload=()=>setTimeout(()=>window.print(),200);</script>
  </body></html>`);
  w.document.close();
}

// ============================================================
// Componente principal
// ============================================================
export function RelatoriosFinanceiroSaaS() {
  const [loading, setLoading] = useState(true);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [sistemas, setSistemas] = useState<Nome[]>([]);
  const [categorias, setCategorias] = useState<Cat[]>([]);
  const [centros, setCentros] = useState<Nome[]>([]);
  const [contas, setContas] = useState<Nome[]>([]);
  const [formas, setFormas] = useState<Nome[]>([]);

  // Filtros
  const [dataIni, setDataIni] = useState<string>(firstDayOfMonth());
  const [dataFim, setDataFim] = useState<string>(lastDayOfMonth());
  const [fTipo, setFTipo] = useState<string>("todos");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fBase, setFBase] = useState<string>("todos");
  const [fSistema, setFSistema] = useState<string>("todos");
  const [fPlano, setFPlano] = useState<string>("todos");
  const [fCategoria, setFCategoria] = useState<string>("todos");
  const [fCentro, setFCentro] = useState<string>("todos");
  const [fConta, setFConta] = useState<string>("todos");
  const [fForma, setFForma] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [showFiltros, setShowFiltros] = useState(true);

  const [reportSel, setReportSel] = useState<ReportId>("receitas_base");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [l, b, s, ca, cc, cb, fp] = await Promise.all([
        supabase.from("saas_lancamentos_financeiros" as any).select("id,tipo,origem,valor,status,descricao,data_competencia,data_vencimento,data_pagamento,base_cliente_id,sistema_saas_id,categoria_id,centro_custo_id,conta_bancaria_id,cobranca_id,contrato_id,fornecedor_nome,forma_pagamento_prevista,forma_pagamento_real"),
        supabase.from("bases_clientes" as any).select("id,nome,plano,sistema_saas_id"),
        supabase.from("sistemas_saas" as any).select("id,nome"),
        supabase.from("saas_categorias_financeiras" as any).select("id,nome,parent_id"),
        supabase.from("saas_centros_custo" as any).select("id,nome"),
        supabase.from("saas_contas_bancarias" as any).select("id,nome"),
        supabase.from("saas_formas_pagamento" as any).select("id,nome"),
      ]);
      setLancs(((l.data || []) as any[]).map((x) => ({ ...x, valor: Number(x.valor || 0) })));
      setBases((b.data || []) as any);
      setSistemas((s.data || []) as any);
      setCategorias((ca.data || []) as any);
      setCentros((cc.data || []) as any);
      setContas((cb.data || []) as any);
      setFormas((fp.data || []) as any);
      setLoading(false);
    })();
  }, []);

  // Mapas
  const baseMap = useMemo(() => Object.fromEntries(bases.map((x) => [x.id, x])), [bases]);
  const sistemaMap = useMemo(() => Object.fromEntries(sistemas.map((x) => [x.id, x.nome])), [sistemas]);
  const catMap = useMemo(() => Object.fromEntries(categorias.map((x) => [x.id, x])), [categorias]);
  const centroMap = useMemo(() => Object.fromEntries(centros.map((x) => [x.id, x.nome])), [centros]);
  const contaMap = useMemo(() => Object.fromEntries(contas.map((x) => [x.id, x.nome])), [contas]);

  const planos = useMemo(() => Array.from(new Set(bases.map((b) => b.plano || "—"))), [bases]);

  // Filtragem
  const lancsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lancs.filter((l) => {
      const refData = l.data_vencimento || l.data_competencia || l.data_pagamento || "";
      if (dataIni && refData && refData < dataIni) return false;
      if (dataFim && refData && refData > dataFim) return false;
      if (fTipo !== "todos" && l.tipo !== fTipo) return false;
      if (fStatus !== "todos") {
        if (fStatus === "vencido") {
          if (!isVencido(l)) return false;
        } else if (l.status !== fStatus) return false;
      }
      if (fBase !== "todos" && l.base_cliente_id !== fBase) return false;
      if (fSistema !== "todos") {
        const sid = l.sistema_saas_id || (l.base_cliente_id && baseMap[l.base_cliente_id]?.sistema_saas_id);
        if (sid !== fSistema) return false;
      }
      if (fPlano !== "todos") {
        const p = l.base_cliente_id ? baseMap[l.base_cliente_id]?.plano : null;
        if ((p || "—") !== fPlano) return false;
      }
      if (fCategoria !== "todos" && l.categoria_id !== fCategoria) return false;
      if (fCentro !== "todos" && l.centro_custo_id !== fCentro) return false;
      if (fConta !== "todos" && l.conta_bancaria_id !== fConta) return false;
      if (fForma !== "todos") {
        const f = l.forma_pagamento_real || l.forma_pagamento_prevista || "";
        if (f !== fForma) return false;
      }
      if (q) {
        const blob = `${l.descricao || ""} ${l.fornecedor_nome || ""} ${baseMap[l.base_cliente_id || ""]?.nome || ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [lancs, dataIni, dataFim, fTipo, fStatus, fBase, fSistema, fPlano, fCategoria, fCentro, fConta, fForma, busca, baseMap]);

  // KPIs
  const kpis = useMemo(() => {
    const receitas = lancsFiltrados.filter((l) => l.tipo === "receita" && l.status !== "cancelado");
    const despesas = lancsFiltrados.filter((l) => l.tipo === "despesa" && l.status !== "cancelado");
    const sum = (a: Lanc[]) => a.reduce((s, l) => s + l.valor, 0);
    const totalReceitas = sum(receitas);
    const totalRecebido = sum(receitas.filter((l) => l.status === "pago"));
    const totalAReceber = sum(receitas.filter((l) => l.status !== "pago"));
    const totalDespesas = sum(despesas);
    const totalPago = sum(despesas.filter((l) => l.status === "pago"));
    const totalAPagar = sum(despesas.filter((l) => l.status !== "pago"));
    const vencidoReceber = sum(receitas.filter(isVencido));
    const vencidoPagar = sum(despesas.filter(isVencido));
    return {
      totalReceitas, totalRecebido, totalAReceber,
      totalDespesas, totalPago, totalAPagar,
      resultadoPrevisto: totalReceitas - totalDespesas,
      resultadoRealizado: totalRecebido - totalPago,
      vencidoReceber, vencidoPagar,
    };
  }, [lancsFiltrados]);

  function limparFiltros() {
    setDataIni(firstDayOfMonth()); setDataFim(lastDayOfMonth());
    setFTipo("todos"); setFStatus("todos"); setFBase("todos"); setFSistema("todos");
    setFPlano("todos"); setFCategoria("todos"); setFCentro("todos"); setFConta("todos");
    setFForma("todos"); setBusca("");
  }

  function toggle(k: string) {
    const s = new Set(expanded);
    s.has(k) ? s.delete(k) : s.add(k);
    setExpanded(s);
  }

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* ============ Filtros ============ */}
      <Card className="p-3 no-print">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setShowFiltros((v) => !v)} className="flex items-center gap-2 text-sm font-medium">
            <Filter className="w-4 h-4" /> Filtros
            {showFiltros ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={limparFiltros} className="gap-1">
              <X className="w-3.5 h-3.5" /> Limpar
            </Button>
          </div>
        </div>
        {showFiltros && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
            <div><Label className="text-[10px]">Data inicial</Label><Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-[10px]">Data final</Label><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-8 text-xs" /></div>
            <div>
              <Label className="text-[10px]">Tipo</Label>
              <Select value={fTipo} onValueChange={setFTipo}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Status</Label>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Base</Label>
              <Select value={fBase} onValueChange={setFBase}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Sistema</Label>
              <Select value={fSistema} onValueChange={setFSistema}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {sistemas.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Plano</Label>
              <Select value={fPlano} onValueChange={setFPlano}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {planos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Categoria</Label>
              <Select value={fCategoria} onValueChange={setFCategoria}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Centro de custo</Label>
              <Select value={fCentro} onValueChange={setFCentro}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Conta bancária</Label>
              <Select value={fConta} onValueChange={setFConta}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Forma de pagamento</Label>
              <Select value={fForma} onValueChange={setFForma}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {formas.map((f) => <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 md:col-span-2 lg:col-span-2">
              <Label className="text-[10px]">Busca</Label>
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-2.5 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Descrição, base, fornecedor..." className="h-8 text-xs pl-7" />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ============ Cards Resumo ============ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <KpiMini label="Total de Receitas" value={kpis.totalReceitas} tone="receita" />
        <KpiMini label="Total Recebido" value={kpis.totalRecebido} tone="receita" />
        <KpiMini label="Total a Receber" value={kpis.totalAReceber} tone="previsto" />
        <KpiMini label="Vencidos a Receber" value={kpis.vencidoReceber} tone="despesa" />
        <KpiMini label="Resultado Previsto" value={kpis.resultadoPrevisto} tone={kpis.resultadoPrevisto >= 0 ? "receita" : "despesa"} />
        <KpiMini label="Total de Despesas" value={kpis.totalDespesas} tone="despesa" />
        <KpiMini label="Total Pago" value={kpis.totalPago} tone="despesa" />
        <KpiMini label="Total a Pagar" value={kpis.totalAPagar} tone="previsto" />
        <KpiMini label="Vencidos a Pagar" value={kpis.vencidoPagar} tone="despesa" />
        <KpiMini label="Resultado Realizado" value={kpis.resultadoRealizado} tone={kpis.resultadoRealizado >= 0 ? "receita" : "despesa"} />
      </div>

      {/* ============ Seletor de relatório ============ */}
      <Card className="p-2 no-print">
        <div className="flex flex-wrap gap-1">
          {REPORTS.map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant={reportSel === r.id ? "default" : "outline"}
              onClick={() => { setReportSel(r.id); setExpanded(new Set()); }}
              className="text-xs h-7"
            >
              {r.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* ============ Relatório selecionado ============ */}
      <div id="saas-print-area">
        <RelatorioContent
          reportId={reportSel}
          lancs={lancsFiltrados}
          baseMap={baseMap}
          bases={bases}
          sistemaMap={sistemaMap}
          catMap={catMap}
          centroMap={centroMap}
          contaMap={contaMap}
          expanded={expanded}
          onToggle={toggle}
        />
      </div>
    </div>
  );
}

// ============================================================
// KPI compacto
// ============================================================
function KpiMini({ label, value, tone }: { label: string; value: number; tone: "receita" | "despesa" | "previsto" }) {
  const color =
    tone === "receita" ? "text-green-700" :
    tone === "despesa" ? "text-red-700" : "text-amber-700";
  return (
    <Card className="p-2">
      <div className="text-[9px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{brl(value)}</div>
    </Card>
  );
}

// ============================================================
// Conteúdo do relatório selecionado
// ============================================================
type RCProps = {
  reportId: ReportId;
  lancs: Lanc[];
  baseMap: Record<string, Base>;
  bases: Base[];
  sistemaMap: Record<string, string>;
  catMap: Record<string, Cat>;
  centroMap: Record<string, string>;
  contaMap: Record<string, string>;
  expanded: Set<string>;
  onToggle: (k: string) => void;
};

function RelatorioContent(p: RCProps) {
  const meta = REPORTS.find((r) => r.id === p.reportId)!;

  // Agrupamentos
  const grupos = useMemo(() => {
    const baseFiltro = (l: Lanc) =>
      meta.tipo === "ambos" ? l.status !== "cancelado" :
      l.tipo === meta.tipo && l.status !== "cancelado";

    const fonte = p.lancs.filter(baseFiltro);

    const keyFn = (l: Lanc): { key: string; label: string; sub?: string } => {
      switch (p.reportId) {
        case "receitas_base": {
          const b = l.base_cliente_id ? p.baseMap[l.base_cliente_id] : null;
          return {
            key: l.base_cliente_id || "sem",
            label: b?.nome || "Sem base",
            sub: b?.sistema_saas_id ? `${p.sistemaMap[b.sistema_saas_id] || "—"} • ${b.plano || "—"}` : (b?.plano || ""),
          };
        }
        case "receitas_sistema": {
          const sid = l.sistema_saas_id || (l.base_cliente_id && p.baseMap[l.base_cliente_id]?.sistema_saas_id) || "";
          return { key: sid || "sem", label: p.sistemaMap[sid] || "Sem sistema" };
        }
        case "receitas_categoria":
        case "despesas_categoria": {
          const c = l.categoria_id ? p.catMap[l.categoria_id] : null;
          const parent = c?.parent_id ? p.catMap[c.parent_id]?.nome : null;
          return { key: l.categoria_id || "sem", label: c?.nome || "Sem categoria", sub: parent || undefined };
        }
        case "receitas_plano": {
          const plano = l.base_cliente_id ? (p.baseMap[l.base_cliente_id]?.plano || "—") : "—";
          return { key: plano, label: plano };
        }
        case "despesas_centro": {
          return { key: l.centro_custo_id || "sem", label: l.centro_custo_id ? (p.centroMap[l.centro_custo_id] || "—") : "Sem centro" };
        }
        case "despesas_fornecedor": {
          const f = (l.fornecedor_nome || "").trim();
          return { key: f || "sem", label: f || "Sem fornecedor" };
        }
        default:
          return { key: "all", label: "—" };
      }
    };

    const map = new Map<string, { label: string; sub?: string; rows: Lanc[]; total: number; pago: number; pendente: number; vencido: number }>();
    fonte.forEach((l) => {
      const { key, label, sub } = keyFn(l);
      const g = map.get(key) || { label, sub, rows: [], total: 0, pago: 0, pendente: 0, vencido: 0 };
      g.rows.push(l);
      g.total += l.valor;
      if (l.status === "pago") g.pago += l.valor;
      else if (isVencido(l)) g.vencido += l.valor;
      else g.pendente += l.valor;
      map.set(key, g);
    });
    const arr = Array.from(map.entries()).map(([k, v]) => ({ key: k, ...v }));
    arr.sort((a, b) => b.total - a.total);
    const totalGeral = arr.reduce((s, g) => s + g.total, 0);
    return arr.map((g) => ({ ...g, pct: totalGeral > 0 ? (g.total / totalGeral) * 100 : 0 }));
  }, [p.lancs, p.reportId, p.baseMap, p.sistemaMap, p.catMap, p.centroMap, meta.tipo]);

  // Séries temporais (resultado_mes / fluxo)
  const series = useMemo(() => {
    const m: Record<string, { mes: string; recPrev: number; recReal: number; despPrev: number; despReal: number }> = {};
    const touch = (k: string) => {
      if (!m[k]) m[k] = { mes: k, recPrev: 0, recReal: 0, despPrev: 0, despReal: 0 };
      return m[k];
    };
    p.lancs.forEach((l) => {
      if (l.status === "cancelado") return;
      const refPrev = (l.data_competencia || l.data_vencimento || "").slice(0, 7);
      if (refPrev) {
        const row = touch(refPrev);
        if (l.tipo === "receita") row.recPrev += l.valor;
        else row.despPrev += l.valor;
      }
      if (l.status === "pago" && l.data_pagamento) {
        const k = l.data_pagamento.slice(0, 7);
        const row = touch(k);
        if (l.tipo === "receita") row.recReal += l.valor;
        else row.despReal += l.valor;
      }
    });
    return Object.values(m).sort((a, b) => a.mes.localeCompare(b.mes)).map((r) => ({
      ...r,
      resultadoPrev: r.recPrev - r.despPrev,
      resultadoReal: r.recReal - r.despReal,
      saldoPrev: r.recPrev - r.despPrev,
      saldoReal: r.recReal - r.despReal,
    }));
  }, [p.lancs]);

  // Inadimplência por base
  const inadimplencia = useMemo(() => {
    if (p.reportId !== "inadimplencia_base") return [];
    const vencidos = p.lancs.filter((l) => l.tipo === "receita" && isVencido(l));
    const map = new Map<string, { baseId: string; nome: string; sistema: string; plano: string; total: number; qtd: number; mais_antigo: string | null; ultima: string | null }>();
    vencidos.forEach((l) => {
      const bid = l.base_cliente_id || "sem";
      const b = l.base_cliente_id ? p.baseMap[l.base_cliente_id] : null;
      const g = map.get(bid) || {
        baseId: bid,
        nome: b?.nome || "Sem base",
        sistema: b?.sistema_saas_id ? (p.sistemaMap[b.sistema_saas_id] || "—") : "—",
        plano: b?.plano || "—",
        total: 0, qtd: 0, mais_antigo: null, ultima: null,
      };
      g.total += l.valor; g.qtd += 1;
      if (l.data_vencimento) {
        if (!g.mais_antigo || l.data_vencimento < g.mais_antigo) g.mais_antigo = l.data_vencimento;
        if (!g.ultima || l.data_vencimento > g.ultima) g.ultima = l.data_vencimento;
      }
      map.set(bid, g);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).map((r) => ({
      ...r,
      dias_atraso: r.mais_antigo ? Math.max(0, Math.floor((Date.now() - new Date(r.mais_antigo + "T00:00:00").getTime()) / 86400000)) : 0,
    }));
  }, [p.lancs, p.reportId, p.baseMap, p.sistemaMap]);

  // Export
  function handleExport() {
    if (p.reportId === "resultado_mes") {
      exportXlsx(series.map((r) => ({
        Mes: r.mes, ReceitasPrevistas: r.recPrev, ReceitasRecebidas: r.recReal,
        DespesasPrevistas: r.despPrev, DespesasPagas: r.despReal,
        ResultadoPrevisto: r.resultadoPrev, ResultadoRealizado: r.resultadoReal,
      })), `relatorio_saas_resultado_mes_a_mes`);
      return;
    }
    if (p.reportId === "fluxo_previsto_realizado") {
      exportXlsx(series.map((r) => ({
        Mes: r.mes, PrevistoReceber: r.recPrev, Recebido: r.recReal,
        PrevistoPagar: r.despPrev, Pago: r.despReal,
        SaldoPrevisto: r.saldoPrev, SaldoRealizado: r.saldoReal,
      })), `relatorio_saas_fluxo_previsto_realizado`);
      return;
    }
    if (p.reportId === "inadimplencia_base") {
      exportXlsx(inadimplencia.map((r) => ({
        Base: r.nome, Sistema: r.sistema, Plano: r.plano,
        TotalVencido: r.total, Qtd: r.qtd,
        VencimentoMaisAntigo: r.mais_antigo || "", DiasAtraso: r.dias_atraso,
        UltimaCobrancaVencida: r.ultima || "",
      })), `relatorio_saas_inadimplencia_por_base`);
      return;
    }
    const rows: any[] = [];
    grupos.forEach((g) => {
      rows.push({
        Grupo: g.label, Subgrupo: g.sub || "",
        Total: g.total, Pago: g.pago, Pendente: g.pendente, Vencido: g.vencido,
        Percentual: g.pct.toFixed(2), Qtd: g.rows.length,
      });
      g.rows.forEach((l) => rows.push({
        Grupo: "  ↳", Descrição: l.descricao || "", Vencimento: fmtData(l.data_vencimento),
        Pagamento: fmtData(l.data_pagamento), Valor: l.valor, Status: l.status,
      }));
    });
    exportXlsx(rows, `relatorio_saas_${p.reportId}`);
  }

  function handlePrint() {
    imprimirSecao("saas-print-area", meta.label);
  }

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">{meta.label}</div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1">
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Series-based reports */}
      {p.reportId === "resultado_mes" && (
        <SerieResultadoMes series={series} />
      )}
      {p.reportId === "fluxo_previsto_realizado" && (
        <SerieFluxo series={series} />
      )}
      {p.reportId === "inadimplencia_base" && (
        <Inadimplencia rows={inadimplencia} />
      )}

      {/* Grouped reports */}
      {p.reportId !== "resultado_mes" && p.reportId !== "fluxo_previsto_realizado" && p.reportId !== "inadimplencia_base" && (
        <GrupoTabela
          reportId={p.reportId}
          grupos={grupos}
          expanded={p.expanded}
          onToggle={p.onToggle}
          catMap={p.catMap}
          centroMap={p.centroMap}
          contaMap={p.contaMap}
        />
      )}
    </Card>
  );
}

// ============================================================
// Tabela agrupada (com expansão e gráfico)
// ============================================================
function GrupoTabela({
  reportId, grupos, expanded, onToggle, catMap, centroMap, contaMap,
}: {
  reportId: ReportId;
  grupos: { key: string; label: string; sub?: string; rows: Lanc[]; total: number; pago: number; pendente: number; vencido: number; pct: number }[];
  expanded: Set<string>;
  onToggle: (k: string) => void;
  catMap: Record<string, Cat>;
  centroMap: Record<string, string>;
  contaMap: Record<string, string>;
}) {
  const chartData = grupos.slice(0, 15).map((g) => ({ name: g.label.slice(0, 22), value: g.total }));
  const isDespesa = reportId.startsWith("despesas");
  const color = isDespesa ? COLORS.despesa : COLORS.receita;
  const pieData = grupos.slice(0, 10).map((g) => ({ name: g.label.slice(0, 18), value: g.total }));

  return (
    <div className="space-y-3">
      {grupos.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted-foreground">Sem dados para os filtros aplicados.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="h-[240px]">
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => `${(e.percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase">
                <tr>
                  <th className="text-left p-2 w-6"></th>
                  <th className="text-left p-2">Grupo</th>
                  <th className="text-right p-2">Valor total</th>
                  <th className="text-right p-2">{isDespesa ? "Pago" : "Recebido"}</th>
                  <th className="text-right p-2">Pendente</th>
                  <th className="text-right p-2">Vencido</th>
                  <th className="text-right p-2">%</th>
                  <th className="text-right p-2">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <Fragment key={g.key}>
                    <tr className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => onToggle(g.key)}>
                      <td className="p-2">{expanded.has(g.key) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</td>
                      <td className="p-2">
                        <div className="font-medium">{g.label}</div>
                        {g.sub && <div className="text-[10px] text-muted-foreground">{g.sub}</div>}
                      </td>
                      <td className="p-2 text-right font-medium">{brl(g.total)}</td>
                      <td className="p-2 text-right text-green-700">{brl(g.pago)}</td>
                      <td className="p-2 text-right text-amber-700">{brl(g.pendente)}</td>
                      <td className="p-2 text-right text-red-700">{brl(g.vencido)}</td>
                      <td className="p-2 text-right">{g.pct.toFixed(1)}%</td>
                      <td className="p-2 text-right">{g.rows.length}</td>
                    </tr>
                    {expanded.has(g.key) && (
                      <tr className="bg-muted/10">
                        <td colSpan={8} className="p-0">
                          <table className="w-full text-[11px]">
                            <thead className="bg-muted/30 text-[9px] uppercase">
                              <tr>
                                <th className="text-left p-1.5">Descrição</th>
                                <th className="text-left p-1.5">Categoria</th>
                                <th className="text-left p-1.5">Centro</th>
                                <th className="text-left p-1.5">Conta</th>
                                <th className="text-left p-1.5">Competência</th>
                                <th className="text-left p-1.5">Vencimento</th>
                                <th className="text-left p-1.5">Pagamento</th>
                                <th className="text-right p-1.5">Valor</th>
                                <th className="text-left p-1.5">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.rows.map((l) => (
                                <tr key={l.id} className="border-t">
                                  <td className="p-1.5">{l.descricao || "—"}</td>
                                  <td className="p-1.5">{l.categoria_id ? (catMap[l.categoria_id]?.nome || "—") : "—"}</td>
                                  <td className="p-1.5">{l.centro_custo_id ? (centroMap[l.centro_custo_id] || "—") : "—"}</td>
                                  <td className="p-1.5">{l.conta_bancaria_id ? (contaMap[l.conta_bancaria_id] || "—") : "—"}</td>
                                  <td className="p-1.5">{fmtData(l.data_competencia)}</td>
                                  <td className="p-1.5">{fmtData(l.data_vencimento)}</td>
                                  <td className="p-1.5">{fmtData(l.data_pagamento)}</td>
                                  <td className="p-1.5 text-right">{brl(l.valor)}</td>
                                  <td className="p-1.5"><StatusBadge l={l} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ l }: { l: Lanc }) {
  const venc = isVencido(l);
  const tone =
    l.status === "pago" ? "bg-green-100 text-green-800" :
    l.status === "cancelado" ? "bg-gray-100 text-gray-700" :
    venc ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
  return <Badge variant="outline" className={`${tone} border-0 text-[9px]`}>{venc && l.status !== "pago" ? "vencido" : l.status}</Badge>;
}

// ============================================================
// Relatórios temporais
// ============================================================
function SerieResultadoMes({ series }: { series: any[] }) {
  if (!series.length) return <div className="py-10 text-center text-xs text-muted-foreground">Sem dados.</div>;
  return (
    <div className="space-y-3">
      <div className="h-[280px]">
        <ResponsiveContainer>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => brl(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="recReal" fill={COLORS.receita} name="Receitas Recebidas" />
            <Bar dataKey="despReal" fill={COLORS.despesa} name="Despesas Pagas" />
            <Line type="monotone" dataKey="resultadoReal" stroke={COLORS.resultado} name="Resultado" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase">
            <tr>
              <th className="text-left p-2">Mês</th>
              <th className="text-right p-2">Rec. Previstas</th>
              <th className="text-right p-2">Rec. Recebidas</th>
              <th className="text-right p-2">Desp. Previstas</th>
              <th className="text-right p-2">Desp. Pagas</th>
              <th className="text-right p-2">Result. Previsto</th>
              <th className="text-right p-2">Result. Realizado</th>
            </tr>
          </thead>
          <tbody>
            {series.map((r) => (
              <tr key={r.mes} className="border-t">
                <td className="p-2">{r.mes}</td>
                <td className="p-2 text-right">{brl(r.recPrev)}</td>
                <td className="p-2 text-right text-green-700">{brl(r.recReal)}</td>
                <td className="p-2 text-right">{brl(r.despPrev)}</td>
                <td className="p-2 text-right text-red-700">{brl(r.despReal)}</td>
                <td className={`p-2 text-right ${r.resultadoPrev >= 0 ? "text-green-700" : "text-red-700"}`}>{brl(r.resultadoPrev)}</td>
                <td className={`p-2 text-right font-medium ${r.resultadoReal >= 0 ? "text-green-700" : "text-red-700"}`}>{brl(r.resultadoReal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SerieFluxo({ series }: { series: any[] }) {
  if (!series.length) return <div className="py-10 text-center text-xs text-muted-foreground">Sem dados.</div>;
  return (
    <div className="space-y-3">
      <div className="h-[280px]">
        <ResponsiveContainer>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => brl(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="recPrev" stroke={COLORS.previsto} name="Previsto a Receber" />
            <Line type="monotone" dataKey="recReal" stroke={COLORS.receita} name="Recebido" />
            <Line type="monotone" dataKey="despPrev" stroke="#9ca3af" name="Previsto a Pagar" />
            <Line type="monotone" dataKey="despReal" stroke={COLORS.despesa} name="Pago" />
            <Line type="monotone" dataKey="saldoReal" stroke={COLORS.resultado} name="Saldo Realizado" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase">
            <tr>
              <th className="text-left p-2">Mês</th>
              <th className="text-right p-2">Previsto a Receber</th>
              <th className="text-right p-2">Recebido</th>
              <th className="text-right p-2">Previsto a Pagar</th>
              <th className="text-right p-2">Pago</th>
              <th className="text-right p-2">Saldo Previsto</th>
              <th className="text-right p-2">Saldo Realizado</th>
            </tr>
          </thead>
          <tbody>
            {series.map((r) => (
              <tr key={r.mes} className="border-t">
                <td className="p-2">{r.mes}</td>
                <td className="p-2 text-right">{brl(r.recPrev)}</td>
                <td className="p-2 text-right text-green-700">{brl(r.recReal)}</td>
                <td className="p-2 text-right">{brl(r.despPrev)}</td>
                <td className="p-2 text-right text-red-700">{brl(r.despReal)}</td>
                <td className={`p-2 text-right ${r.saldoPrev >= 0 ? "text-green-700" : "text-red-700"}`}>{brl(r.saldoPrev)}</td>
                <td className={`p-2 text-right font-medium ${r.saldoReal >= 0 ? "text-green-700" : "text-red-700"}`}>{brl(r.saldoReal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Inadimplencia({ rows }: { rows: any[] }) {
  if (!rows.length) return <div className="py-10 text-center text-xs text-muted-foreground">Sem inadimplência no período.</div>;
  const chart = rows.slice(0, 15).map((r) => ({ name: r.nome.slice(0, 22), value: r.total }));
  return (
    <div className="space-y-3">
      <div className="h-[240px]">
        <ResponsiveContainer>
          <BarChart data={chart} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
            <Tooltip formatter={(v: number) => brl(v)} />
            <Bar dataKey="value" fill={COLORS.despesa} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase">
            <tr>
              <th className="text-left p-2">Base</th>
              <th className="text-left p-2">Sistema</th>
              <th className="text-left p-2">Plano</th>
              <th className="text-right p-2">Total Vencido</th>
              <th className="text-right p-2">Qtd</th>
              <th className="text-left p-2">Mais antigo</th>
              <th className="text-right p-2">Dias atraso</th>
              <th className="text-left p-2">Última</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.baseId} className="border-t">
                <td className="p-2 font-medium">{r.nome}</td>
                <td className="p-2">{r.sistema}</td>
                <td className="p-2">{r.plano}</td>
                <td className="p-2 text-right text-red-700 font-medium">{brl(r.total)}</td>
                <td className="p-2 text-right">{r.qtd}</td>
                <td className="p-2">{fmtData(r.mais_antigo)}</td>
                <td className="p-2 text-right">{r.dias_atraso}</td>
                <td className="p-2">{fmtData(r.ultima)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
