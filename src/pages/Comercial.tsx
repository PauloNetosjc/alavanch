import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Briefcase, Plus, Search, Clock, CheckCircle2, TrendingUp, ChevronLeft, ChevronRight, Calculator, FileSignature, Eye, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { LojasFilter } from "@/components/financeiro/LojasFilter";
import { useLoja } from "@/contexts/LojaContext";

type OrcRow = {
  id: string;
  codigo: string;
  nome_projeto: string | null;
  cliente_final: string | null;
  cliente_final_pedido?: string | null;
  status: string;
  total: number | null;
  created_at: string;
  confirmado_em?: string | null;
  cliente_id: string | null;
  loja_id?: string | null;
  cliente?: { nome: string } | null;
  pedido_id?: string | null;
  contrato_status?: string | null;
  revisado?: boolean;
  etiquetas?: { id: string; nome: string; cor: string }[];
};

const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  negociacao: { label: "Negociação", bg: "#FBF3DF", fg: "#6B5210", dot: "#A8842A" },
  aprovado:   { label: "Aprovado",   bg: "#E8F4ED", fg: "#1F5235", dot: "#3F8B5C" },
  convertido: { label: "Vendido",    bg: "#E8F4ED", fg: "#1F5235", dot: "#3F8B5C" },
  perdido:    { label: "Cancelado",  bg: "#FBE9E9", fg: "#7A2222", dot: "#C0392B" },
};

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const displayDate = (r: { status: string; created_at: string; confirmado_em?: string | null }) =>
  fmtDate((r.status === "convertido" || r.status === "aprovado") && r.confirmado_em ? r.confirmado_em : r.created_at);

/* ---------------- Big KPI tile ---------------- */

type BigVariant = "purple" | "green" | "violet";

const BIG_STYLES: Record<BigVariant, {
  bg: string; border: string; iconBg: string; iconFg: string; valueColor: string;
  badgeBg: string; badgeFg: string; badgeLabel: string;
}> = {
  purple: {
    bg: "#F4ECF7", border: "#E5D6EE", iconBg: "#7E4FA0", iconFg: "#FFFFFF",
    valueColor: "#1B2240", badgeBg: "#FFFFFF", badgeFg: "#7E4FA0", badgeLabel: "Em Aberto",
  },
  green: {
    bg: "#E8F4ED", border: "#D2E8DB", iconBg: "#3F8B5C", iconFg: "#FFFFFF",
    valueColor: "#1B2240", badgeBg: "#FFFFFF", badgeFg: "#3F8B5C", badgeLabel: "Ativo",
  },
  violet: {
    bg: "#F4ECF7", border: "#E5D6EE", iconBg: "#7E4FA0", iconFg: "#FFFFFF",
    valueColor: "#1B2240", badgeBg: "#FFFFFF", badgeFg: "#7E4FA0", badgeLabel: "Média",
  },
};

function BigKpi({
  label, value, icon: Icon, variant,
}: {
  label: string; value: string; icon: typeof Clock; variant: BigVariant;
}) {
  const s = BIG_STYLES[variant];
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-6"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: s.iconBg }}
        >
          <Icon className="w-5 h-5" style={{ color: s.iconFg }} />
        </div>
        <span
          className="text-[11px] font-medium px-2.5 py-1 rounded-full border"
          style={{ background: s.badgeBg, color: s.badgeFg, borderColor: s.border }}
        >
          {s.badgeLabel}
        </span>
      </div>
      <div>
        <div className="text-[11px] font-semibold tracking-wider mb-1" style={{ color: s.valueColor, opacity: 0.6 }}>
          {label}
        </div>
        <div className="text-[28px] font-semibold leading-none tracking-tight" style={{ color: s.valueColor }}>
          {value}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Status pill filter ---------------- */

type StatusFilter = "todos" | "negociacao" | "convertido";

const STATUS_PILLS: { id: StatusFilter; label: string; activeBg: string; activeFg: string }[] = [
  { id: "todos",      label: "TODOS",      activeBg: "#1B2240", activeFg: "#FFFFFF" },
  { id: "negociacao", label: "NEGOCIAÇÃO", activeBg: "#7E4FA0", activeFg: "#FFFFFF" },
  { id: "convertido", label: "VENDIDO",    activeBg: "#3F8B5C", activeFg: "#FFFFFF" },
];

type TipoFilter = "todos" | "pedido" | "adendo" | "complemento";

const TIPO_PILLS: { id: TipoFilter; label: string; activeBg: string; activeFg: string }[] = [
  { id: "todos",       label: "TODOS TIPOS", activeBg: "#1B2240", activeFg: "#FFFFFF" },
  { id: "pedido",      label: "PEDIDOS",     activeBg: "#2D6BE5", activeFg: "#FFFFFF" },
  { id: "adendo",      label: "ADENDOS",     activeBg: "#A8842A", activeFg: "#FFFFFF" },
  { id: "complemento", label: "COMPLEMENTOS",activeBg: "#7E4FA0", activeFg: "#FFFFFF" },
];

type RevisaoFilter = "todos" | "revisado" | "nao_revisado";

const REVISAO_PILLS: { id: RevisaoFilter; label: string; activeBg: string; activeFg: string }[] = [
  { id: "todos",        label: "TODAS REVISÕES", activeBg: "#1B2240", activeFg: "#FFFFFF" },
  { id: "revisado",     label: "REVISADOS",      activeBg: "#3F8B5C", activeFg: "#FFFFFF" },
  { id: "nao_revisado", label: "NÃO REVISADOS",  activeBg: "#A8842A", activeFg: "#FFFFFF" },
];

function tipoFromCodigo(codigo: string): "pedido" | "adendo" | "complemento" {
  const c = (codigo || "").toUpperCase();
  if (c.includes("-ADD") || c.includes("-AD-") || c.startsWith("AD-")) return "adendo";
  if (c.includes("-CP") || c.includes("-COMP") || c.startsWith("CP-") || c.startsWith("COMP-")) return "complemento";
  return "pedido";
}

/* ---------------- Month selector ---------------- */

function buildMonths(reference: Date, count = 6) {
  const arr: { key: string; label: string; year: number; month: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
      .replace(".", "")
      .replace(" de ", "/")
      .replace(" ", "/");
    arr.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label,
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return arr;
}

/* ---------------- Page ---------------- */

export default function Comercial() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OrcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");
  const [revisaoFilter, setRevisaoFilter] = useState<RevisaoFilter>("todos");
  const [showCancelled, setShowCancelled] = useState(false);
  const { selectedLojaId } = useLoja();
  const [lojasFilter, setLojasFilter] = useState<string[]>(selectedLojaId ? [selectedLojaId] : []);
  useEffect(() => {
    if (selectedLojaId && lojasFilter.length === 0) setLojasFilter([selectedLojaId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLojaId]);

  const today = new Date();
  const [refDate, setRefDate] = useState(today);
  const [monthFilter, setMonthFilter] = useState<string>("todos"); // "todos" or `${year}-${month}`
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const months = useMemo(() => buildMonths(refDate, 6), [refDate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orcamentos")
      .select("id, codigo, nome_projeto, cliente_final, status, total, created_at, confirmado_em, cliente_id, loja_id, cliente:clientes(nome)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const orcs = (data ?? []) as any[];
    // Buscar pedidos e contratos vinculados
    const ids = orcs.map((o) => o.id);
    if (ids.length > 0) {
      const [{ data: peds }, { data: cts }] = await Promise.all([
        supabase.from("pedidos").select("id, orcamento_id, cliente_final").in("orcamento_id", ids),
        supabase.from("contratos").select("status, orcamento_id").in("orcamento_id", ids),
      ]);
      const pedMap = new Map((peds || []).map((p: any) => [p.orcamento_id, p.id]));
      const pedClienteFinalMap = new Map((peds || []).map((p: any) => [p.orcamento_id, p.cliente_final]));
      const pedIds = (peds || []).map((p: any) => p.id);
      const ctMap = new Map((cts || []).map((c: any) => [c.orcamento_id, c.status]));

      // Carrega assinaturas de revisão (PDF final / vistoria assinados ⇒ revisado)
      let revisadoSet = new Set<string>();
      let etiquetasPorPedido = new Map<string, { id: string; nome: string; cor: string }[]>();
      if (pedIds.length > 0) {
        const [{ data: sols }, { data: vincs }] = await Promise.all([
          supabase.from("solicitacoes_assinatura")
            .select("pedido_id, status, tipos_documento(slug)")
            .in("pedido_id", pedIds),
          supabase.from("pedido_etiquetas" as any)
            .select("pedido_id, etiquetas(id, nome, cor)")
            .in("pedido_id", pedIds),
        ]);
        for (const s of (sols as any[]) || []) {
          const slug = s.tipos_documento?.slug;
          if (slug !== "pdf_final" && slug !== "vistoria") continue;
          if (["assinado_cliente", "assinado_loja", "concluido"].includes(s.status)) {
            revisadoSet.add(s.pedido_id);
          }
        }
        for (const v of (vincs as any[]) || []) {
          const arr = etiquetasPorPedido.get(v.pedido_id) || [];
          if (v.etiquetas) arr.push(v.etiquetas);
          etiquetasPorPedido.set(v.pedido_id, arr);
        }
      }

      for (const o of orcs) {
        o.pedido_id = pedMap.get(o.id) || null;
        o.cliente_final_pedido = pedClienteFinalMap.get(o.id) || null;
        o.contrato_status = ctMap.get(o.id) || null;
        o.revisado = o.pedido_id ? revisadoSet.has(o.pedido_id) : false;
        o.etiquetas = o.pedido_id ? (etiquetasPorPedido.get(o.pedido_id) || []) : [];
      }
    }
    setRows(orcs as unknown as OrcRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDeclinar = async (orcId: string) => {
    if (!confirm("Deseja realmente declinar (perder) este orçamento?")) return;
    const { error } = await supabase.from("orcamentos").update({ status: "perdido" }).eq("id", orcId);
    if (error) {
      toast.error("Erro ao declinar orçamento: " + error.message);
    } else {
      toast.success("Orçamento declinado com sucesso");
      load();
    }
  };

  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      if (!showCancelled && r.status === "perdido") return false;
      if (lojasFilter.length > 0 && (!r.loja_id || !lojasFilter.includes(r.loja_id))) return false;
      if (statusFilter !== "todos" && r.status !== statusFilter) return false;
      if (tipoFilter !== "todos" && tipoFromCodigo(r.codigo) !== tipoFilter) return false;
      if (revisaoFilter === "revisado" && !r.revisado) return false;
      if (revisaoFilter === "nao_revisado" && r.revisado) return false;

      if (monthFilter !== "todos") {
        const [y, m] = monthFilter.split("-").map(Number);
        const d = new Date(r.created_at);
        if (d.getFullYear() !== y || d.getMonth() !== m) return false;
      }

      if (dateFrom) {
        const d = new Date(r.created_at);
        const from = new Date(dateFrom + "T00:00:00");
        if (d < from) return false;
      }
      if (dateTo) {
        const d = new Date(r.created_at);
        const to = new Date(dateTo + "T23:59:59");
        if (d > to) return false;
      }

      const q = search.toLowerCase().trim();
      if (q) {
        const hay = `${r.codigo} ${r.nome_projeto ?? ""} ${r.cliente?.nome ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, showCancelled, statusFilter, tipoFilter, revisaoFilter, monthFilter, search, lojasFilter]);

  const stats = useMemo(() => {
    const negociacao = rows
      .filter((r) => r.status === "negociacao")
      .reduce((s, r) => s + (Number(r.total) || 0), 0);
    const vendidos = rows.filter((r) => r.status === "aprovado" || r.status === "convertido");
    const vendasFechadas = vendidos.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const ticket = vendidos.length ? vendasFechadas / vendidos.length : 0;
    return { negociacao, vendasFechadas, ticket };
  }, [rows]);

  return (
    <div>
      <PageHeader
        icon={CheckCircle2}
        iconVariant="purple"
        title="Comercial"
        subtitle="Gestão de orçamentos e vendas"
        actions={
          <Button onClick={() => navigate("/comercial/novo")} variant="outline" className="gap-1.5 rounded-xl">
            <Plus className="w-4 h-4" /> Novo Orçamento
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <BigKpi label="EM NEGOCIAÇÃO"   value={fmtBrl(stats.negociacao)}     icon={Clock}        variant="purple" />
        <BigKpi label="VENDAS FECHADAS" value={fmtBrl(stats.vendasFechadas)} icon={CheckCircle2} variant="green" />
        <BigKpi label="TICKET MÉDIO"    value={fmtBrl(stats.ticket)}         icon={TrendingUp}   variant="violet" />
      </div>

      {/* Filters card */}
      <div className="surface-card mb-4 p-4 flex flex-col gap-4">
        {/* Search + cancelled */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <LojasFilter value={lojasFilter} onChange={setLojasFilter} />
          <label
            className="flex items-center gap-2 text-[12px] font-medium px-3 py-2 rounded-xl border cursor-pointer"
            style={{
              background: showCancelled ? "#FBE9E9" : "#FFFFFF",
              borderColor: "#F0D5D5",
              color: "#7A2222",
            }}
          >
            <Checkbox
              checked={showCancelled}
              onCheckedChange={(c) => setShowCancelled(!!c)}
              className="border-[#7A2222] data-[state=checked]:bg-[#7A2222] data-[state=checked]:text-white"
            />
            Mostrar cancelados
          </label>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-2">
          {STATUS_PILLS.map((p) => {
            const active = statusFilter === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setStatusFilter(p.id)}
                className="text-[11px] font-semibold tracking-wider px-3.5 py-1.5 rounded-full border transition-colors"
                style={{
                  background: active ? p.activeBg : "#FFFFFF",
                  color: active ? p.activeFg : p.activeBg,
                  borderColor: active ? p.activeBg : "#E5E7EB",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Tipo pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {TIPO_PILLS.map((p) => {
            const active = tipoFilter === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setTipoFilter(p.id)}
                className="text-[11px] font-semibold tracking-wider px-3.5 py-1.5 rounded-full border transition-colors"
                style={{
                  background: active ? p.activeBg : "#FFFFFF",
                  color: active ? p.activeFg : p.activeBg,
                  borderColor: active ? p.activeBg : "#E5E7EB",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Revisão pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {REVISAO_PILLS.map((p) => {
            const active = revisaoFilter === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setRevisaoFilter(p.id)}
                className="text-[11px] font-semibold tracking-wider px-3.5 py-1.5 rounded-full border transition-colors"
                style={{
                  background: active ? p.activeBg : "#FFFFFF",
                  color: active ? p.activeFg : p.activeBg,
                  borderColor: active ? p.activeBg : "#E5E7EB",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>




        {/* Month selector */}
        <div className="flex items-center gap-1 rounded-xl border px-1 py-1" style={{ borderColor: "#E5E7EB" }}>
          <button
            onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 flex items-center justify-around">
            {months.map((m) => {
              const active = monthFilter === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setMonthFilter(m.key)}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: active ? "#1B2240" : "transparent",
                    color: active ? "#FFFFFF" : "#1B2240",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMonthFilter("todos")}
            className="text-[12px] font-medium px-3 py-1.5 rounded-lg ml-1"
            style={{
              background: monthFilter === "todos" ? "#1B2240" : "transparent",
              color: monthFilter === "todos" ? "#FFFFFF" : "#1B2240",
            }}
          >
            Todos
          </button>
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-medium text-muted-foreground">Período:</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); if (e.target.value) setMonthFilter("todos"); }}
            className="h-9 w-[160px]"
          />
          <span className="text-[12px] text-muted-foreground">até</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); if (e.target.value) setMonthFilter("todos"); }}
            className="h-9 w-[160px]"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg border hover:bg-muted"
              style={{ borderColor: "#E5E7EB", color: "#1B2240" }}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="surface-card p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : visibleRows.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={rows.length === 0 ? "Nenhum orçamento criado" : "Nenhum resultado"}
            description={rows.length === 0 ? "Crie seu primeiro orçamento para começar." : "Tente outro termo ou filtro."}
            action={rows.length === 0 ? (
              <Button size="sm" onClick={() => navigate("/comercial/novo")}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo orçamento
              </Button>
            ) : undefined}
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="md:hidden divide-y">
              {visibleRows.map((r) => {
                const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.negociacao;
                const isVenda = !!r.pedido_id;
                const assinaturaPendente = r.contrato_status === "aguardando_assinatura";
                const onOpen = () => navigate(isVenda ? `/pedidos/${r.pedido_id}` : `/comercial/${r.id}`);
                return (
                  <li key={r.id} className="p-4 active:bg-muted/40" onClick={onOpen}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-mono text-[11px]">
                          {r.codigo}
                          {assinaturaPendente && <Clock className="w-3 h-3 text-amber-600" />}
                          <span className="text-muted-foreground">· {displayDate(r)}</span>
                        </div>
                        <div className="font-medium text-[14px] mt-1 truncate">{r.cliente?.nome ?? "—"}</div>
                        {r.nome_projeto && (
                          <div className="text-[12px] text-muted-foreground truncate">{r.nome_projeto}</div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-mono font-semibold text-[13px]">{fmtBrl(Number(r.total) || 0)}</div>
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full mt-1"
                          style={{ background: st.bg, color: st.fg }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                          {isVenda ? "VENDA" : st.label}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      {isVenda ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/pedidos/${r.pedido_id}`); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-[12px] font-medium text-[#2D6BE5]"
                        >
                          <Eye className="w-3.5 h-3.5" /> Visualizar
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeclinar(r.id); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-[12px] font-medium text-[#C0392B]"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Declinar
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/comercial/${r.id}/negociacao`); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-[12px] font-medium text-amber-600"
                          >
                            <Calculator className="w-3.5 h-3.5" /> Negociar
                          </button>
                        </>

                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] tracking-wider">CONTRATO / DATA</TableHead>
                    <TableHead className="text-[11px] tracking-wider">CLIENTE</TableHead>
                    <TableHead className="text-[11px] tracking-wider">CLIENTE FINAL</TableHead>
                    <TableHead className="text-[11px] tracking-wider">ETIQUETAS</TableHead>
                    <TableHead className="text-[11px] tracking-wider">STATUS</TableHead>
                    <TableHead className="text-[11px] tracking-wider text-right">VALOR</TableHead>
                    <TableHead className="text-[11px] tracking-wider text-right">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((r) => {
                    const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.negociacao;
                    const isVenda = !!r.pedido_id;
                    const assinaturaPendente = r.contrato_status === "aguardando_assinatura";
                    const onOpen = () => navigate(isVenda ? `/pedidos/${r.pedido_id}` : `/comercial/${r.id}`);
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={onOpen}>
                        <TableCell>
                          <div className="font-medium text-mono flex items-center gap-1.5">
                            {r.codigo}
                            {assinaturaPendente && (
                              <span title="Assinatura pendente" className="inline-flex items-center text-amber-600">
                                <Clock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] text-muted-foreground">{displayDate(r)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{r.cliente?.nome ?? "—"}</div>
                          {r.nome_projeto && (
                            <div className="text-[12px] text-muted-foreground">{r.nome_projeto}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(r.etiquetas || []).map((e) => (
                              <span key={e.id} className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                                style={{ background: e.cor }}>
                                {e.nome}
                              </span>
                            ))}
                            {(!r.etiquetas || r.etiquetas.length === 0) && (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                            style={{ background: st.bg, color: st.fg }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                            {isVenda ? "VENDA" : st.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-mono font-medium">
                          {fmtBrl(Number(r.total) || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isVenda ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/pedidos/${r.pedido_id}`); }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-muted text-[12px] font-medium text-[#2D6BE5]"
                                aria-label="Visualizar pedido"
                                title="Visualizar pedido"
                              >
                                <Eye className="w-3.5 h-3.5" /> Visualizar
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeclinar(r.id); }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-muted text-[12px] font-medium text-[#C0392B]"
                                  aria-label="Declinar orçamento"
                                  title="Declinar orçamento"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Declinar
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/comercial/${r.id}/negociacao`); }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-muted text-[12px] font-medium text-amber-600"
                                  aria-label="Negociação"
                                  title="Abrir negociação"
                                >
                                  <Calculator className="w-3.5 h-3.5" /> Negociar
                                </button>
                              </>

                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
