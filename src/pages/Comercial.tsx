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
  Briefcase, Plus, Search, Clock, CheckCircle2, TrendingUp, ChevronLeft, ChevronRight, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

type OrcRow = {
  id: string;
  codigo: string;
  nome_projeto: string | null;
  status: string;
  total: number | null;
  created_at: string;
  cliente_id: string | null;
  cliente?: { nome: string } | null;
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
  const [showCancelled, setShowCancelled] = useState(false);

  const today = new Date();
  const [refDate, setRefDate] = useState(today);
  const [monthFilter, setMonthFilter] = useState<string>("todos"); // "todos" or `${year}-${month}`

  const months = useMemo(() => buildMonths(refDate, 6), [refDate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orcamentos")
      .select("id, codigo, nome_projeto, status, total, created_at, cliente_id, cliente:clientes(nome)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as OrcRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      if (!showCancelled && r.status === "perdido") return false;
      if (statusFilter !== "todos" && r.status !== statusFilter) return false;

      if (monthFilter !== "todos") {
        const [y, m] = monthFilter.split("-").map(Number);
        const d = new Date(r.created_at);
        if (d.getFullYear() !== y || d.getMonth() !== m) return false;
      }

      const q = search.toLowerCase().trim();
      if (q) {
        const hay = `${r.codigo} ${r.nome_projeto ?? ""} ${r.cliente?.nome ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, showCancelled, statusFilter, monthFilter, search]);

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
      <div className="grid grid-cols-3 gap-4 mb-6">
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] tracking-wider">CONTRATO / DATA</TableHead>
                <TableHead className="text-[11px] tracking-wider">CLIENTE</TableHead>
                <TableHead className="text-[11px] tracking-wider">STATUS &amp; WORKFLOW</TableHead>
                <TableHead className="text-[11px] tracking-wider text-right">VALOR</TableHead>
                <TableHead className="text-[11px] tracking-wider text-right">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((r) => {
                const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.negociacao;
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/comercial/${r.id}`)}>
                    <TableCell>
                      <div className="font-medium text-mono">{r.codigo}</div>
                      <div className="text-[12px] text-muted-foreground">{fmtDate(r.created_at)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.cliente?.nome ?? "—"}</div>
                      {r.nome_projeto && (
                        <div className="text-[12px] text-muted-foreground">{r.nome_projeto}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                        style={{ background: st.bg, color: st.fg }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-mono font-medium">
                      {fmtBrl(Number(r.total) || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/comercial/${r.id}`); }}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-muted"
                        aria-label="Ações"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
