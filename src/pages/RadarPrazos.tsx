import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  BellRing,
  Clock,
  CalendarDays,
  Ruler,
  Factory,
  Package,
  Truck,
  CheckCircle2,
  CheckCircle,
  Star,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";

type Pedido = {
  id: string;
  codigo: string;
  status: string;
  valor_total: number;
  vip: boolean | null;
  critico: boolean | null;
  data_envio_fabrica: string | null;
  data_montagem: string | null;
  data_vistoria: string | null;
  data_medicao_tecnica: string | null;
  data_chegada_material: string | null;
  data_limite_finalizacao: string | null;
  workflow_estagio: string | null;
  cliente: { nome: string } | null;
};

type Etapa = "medicao" | "fabrica" | "material" | "montagem" | "finalizacao";

const ETAPA_META: Record<
  Etapa,
  { label: string; icon: any; field: keyof Pedido; color: string; bg: string }
> = {
  medicao: { label: "Medição", icon: Ruler, field: "data_medicao_tecnica", color: "#0891b2", bg: "#ecfeff" },
  fabrica: { label: "Fábrica", icon: Factory, field: "data_envio_fabrica", color: "#7c3aed", bg: "#f5f3ff" },
  material: { label: "Material", icon: Package, field: "data_chegada_material", color: "#d97706", bg: "#fffbeb" },
  montagem: { label: "Montagem", icon: Truck, field: "data_montagem", color: "#16a34a", bg: "#f0fdf4" },
  finalizacao: { label: "Finalização", icon: CheckCircle2, field: "data_limite_finalizacao", color: "#0ea5e9", bg: "#f0f9ff" },
};

const MES_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const diffDays = (dateStr: string | null) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
};

type Row = {
  pedido: Pedido;
  etapa: Etapa;
  date: string; // ISO yyyy-mm-dd
  days: number; // diff
};

export default function RadarPrazos() {
  const nav = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [etapaFilter, setEtapaFilter] = useState<"todos" | Etapa>("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "vencido" | "atencao">("todos");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pedidos")
      .select(
        "id, codigo, status, valor_total, vip, critico, workflow_estagio, data_envio_fabrica, data_montagem, data_vistoria, data_medicao_tecnica, data_chegada_material, data_limite_finalizacao, cliente:clientes(nome)"
      )
      .order("created_at", { ascending: false });
    setPedidos((data || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Expande pedidos em "linhas" (uma por etapa com data)
  const allRows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    pedidos.forEach((p) => {
      (Object.keys(ETAPA_META) as Etapa[]).forEach((e) => {
        const v = p[ETAPA_META[e].field] as string | null;
        if (!v) return;
        const d = diffDays(v);
        if (d === null) return;
        out.push({ pedido: p, etapa: e, date: v, days: d });
      });
    });
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [pedidos]);

  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      const t = search.toLowerCase();
      const matchTxt =
        !t ||
        r.pedido.codigo.toLowerCase().includes(t) ||
        (r.pedido.cliente?.nome || "").toLowerCase().includes(t);
      if (!matchTxt) return false;
      if (etapaFilter !== "todos" && r.etapa !== etapaFilter) return false;
      if (statusFilter === "vencido" && r.days >= 0) return false;
      if (statusFilter === "atencao" && !(r.days >= 0 && r.days <= 5)) return false;
      return true;
    });
  }, [allRows, search, etapaFilter, statusFilter]);

  const stats = useMemo(() => {
    let atrasados = 0;
    let preAlerta = 0;
    let hoje = 0;
    allRows.forEach((r) => {
      if (r.days < 0) atrasados++;
      else if (r.days === 0) hoje++;
      else if (r.days <= 5) preAlerta++;
    });
    return { atrasados, preAlerta, hoje, total: allRows.length };
  }, [allRows]);

  const concluir = async (row: Row) => {
    // Marca a data como "concluída" avançando o workflow
    const next = (() => {
      const order: Etapa[] = ["medicao", "fabrica", "material", "montagem", "finalizacao"];
      const idx = order.indexOf(row.etapa);
      if (idx < order.length - 1) return order[idx + 1];
      return "concluido" as any;
    })();
    const stageMap: Record<string, string> = {
      medicao: "revisao",
      fabrica: "fabrica",
      material: "entrega",
      montagem: "montagem",
      finalizacao: "concluido",
      concluido: "concluido",
    };
    await supabase
      .from("pedidos")
      .update({ workflow_estagio: stageMap[next] || row.pedido.workflow_estagio })
      .eq("id", row.pedido.id);
    load();
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarDays}
        iconVariant="purple"
        title="Radar de Prazos"
        subtitle="Gestão Inteligente de Cronogramas"
      />

      {/* KPIs coloridos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiBig
          label="Atrasados"
          value={stats.atrasados}
          chip="Crítico"
          chipColor="#b91c1c"
          icon={AlertTriangle}
          bg="linear-gradient(135deg,#fee2e2 0%,#fecaca 100%)"
          border="#fca5a5"
          valueColor="#b91c1c"
          iconBg="#ef4444"
        />
        <KpiBig
          label="Pré-Alerta (5d)"
          value={stats.preAlerta}
          chip="Atenção"
          chipColor="#a16207"
          icon={BellRing}
          bg="linear-gradient(135deg,#fef9c3 0%,#fef08a 100%)"
          border="#fde047"
          valueColor="#a16207"
          iconBg="#eab308"
        />
        <KpiBig
          label="Para Hoje"
          value={stats.hoje}
          chip="Hoje"
          chipColor="#9a3412"
          icon={Clock}
          bg="linear-gradient(135deg,#ffedd5 0%,#fed7aa 100%)"
          border="#fdba74"
          valueColor="#9a3412"
          iconBg="#f97316"
        />
        <KpiBig
          label="Total de Prazos"
          value={stats.total}
          chip="Total"
          chipColor="#3730a3"
          icon={CalendarDays}
          bg="linear-gradient(135deg,#e0e7ff 0%,#c7d2fe 100%)"
          border="#a5b4fc"
          valueColor="#3730a3"
          iconBg="#6366f1"
        />
      </div>

      {/* Busca + filtros */}
      <div className="surface-card p-4 space-y-3">
        <Input
          placeholder="Buscar cliente ou contrato..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={etapaFilter === "todos"} onClick={() => setEtapaFilter("todos")} label="TODOS" />
            {(Object.keys(ETAPA_META) as Etapa[]).map((e) => {
              const Icon = ETAPA_META[e].icon;
              return (
                <FilterChip
                  key={e}
                  active={etapaFilter === e}
                  onClick={() => setEtapaFilter(e)}
                  label={ETAPA_META[e].label.toUpperCase()}
                  icon={<Icon className="w-3.5 h-3.5" />}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/30">
            {[
              { v: "todos", l: "Todos" },
              { v: "vencido", l: "Vencido" },
              { v: "atencao", l: "Atenção" },
            ].map((s) => (
              <button
                key={s.v}
                onClick={() => setStatusFilter(s.v as any)}
                className={`px-3 py-1 text-[11px] font-medium rounded-md transition ${
                  statusFilter === s.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="surface-card overflow-hidden">
        <div className="grid grid-cols-[120px_1fr_180px_180px_120px] gap-4 px-4 py-3 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          <div>Data/Status</div>
          <div>Cliente/Contrato</div>
          <div>Etapa</div>
          <div>Consultor/Prazo</div>
          <div className="text-right">Ação</div>
        </div>

        {loading ? (
          <div className="text-[12px] text-muted-foreground py-12 text-center">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-[12px] text-muted-foreground py-12 text-center">Nenhum prazo encontrado.</div>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((r, idx) => (
              <RowItem key={`${r.pedido.id}-${r.etapa}-${idx}`} row={r} onClick={() => nav(`/pedidos/${r.pedido.id}`)} onConcluir={() => concluir(r)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiBig({
  label, value, chip, chipColor, icon: Icon, bg, border, valueColor, iconBg,
}: {
  label: string; value: number; chip: string; chipColor: string; icon: any;
  bg: string; border: string; valueColor: string; iconBg: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 border"
      style={{ background: bg, borderColor: border }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
          style={{ background: iconBg }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/70"
          style={{ color: chipColor }}
        >
          {chip}
        </span>
      </div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-4">{label}</div>
      <div className="text-[40px] font-bold leading-none mt-2" style={{ color: valueColor }}>
        {value}
      </div>
    </div>
  );
}

function FilterChip({
  active, onClick, label, icon,
}: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition border ${
        active
          ? "bg-[#1e40af] text-white border-[#1e40af]"
          : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function RowItem({ row, onClick, onConcluir }: { row: Row; onClick: () => void; onConcluir: () => void }) {
  const meta = ETAPA_META[row.etapa];
  const d = new Date(row.date + "T00:00:00");
  const day = String(d.getDate()).padStart(2, "0");
  const mes = MES_ABBR[d.getMonth()];

  // Cor do quadrado de data baseado no SLA
  let cardBg = "#e0e7ff";
  let cardFg = "#3730a3";
  let badgeText = "Normal";
  let badgeColor = "text-muted-foreground";
  let prazoLabel = "";
  if (row.days < 0) {
    cardBg = "#ef4444"; cardFg = "#ffffff"; badgeText = "Vencido"; badgeColor = "text-red-600";
    prazoLabel = `${Math.abs(row.days)}d atraso`;
  } else if (row.days === 0) {
    cardBg = "#f97316"; cardFg = "#ffffff"; badgeText = "Hoje"; badgeColor = "text-orange-600";
    prazoLabel = "hoje";
  } else if (row.days <= 5) {
    cardBg = "#fde68a"; cardFg = "#92400e"; badgeText = "Alerta"; badgeColor = "text-amber-600";
    prazoLabel = `${row.days}d restantes`;
  } else {
    cardBg = "#e0e7ff"; cardFg = "#3730a3"; badgeText = "Normal"; badgeColor = "text-muted-foreground";
    prazoLabel = `${row.days}d restantes`;
  }

  const prazoColor =
    row.days < 0 ? "text-red-600" : row.days === 0 ? "text-orange-600" : row.days <= 5 ? "text-amber-600" : "text-emerald-600";

  return (
    <div
      onClick={onClick}
      className="grid grid-cols-[120px_1fr_180px_180px_120px] gap-4 px-4 py-3 hover:bg-muted/30 cursor-pointer items-center"
    >
      {/* Card de data */}
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-sm"
          style={{ background: cardBg, color: cardFg }}
        >
          <div className="text-[18px] font-bold leading-none">{day}</div>
          <div className="text-[10px] uppercase mt-0.5">{mes}</div>
        </div>
        <div>
          <div className="text-[12px] font-medium">{fmtDateBR(row.date)}</div>
          <div className={`text-[11px] inline-flex items-center gap-1 ${badgeColor}`}>
            {row.days < 0 ? <AlertTriangle className="w-3 h-3" /> : row.days <= 5 ? <BellRing className="w-3 h-3" /> : null}
            {badgeText}
          </div>
        </div>
      </div>

      {/* Cliente / contrato */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold truncate">{row.pedido.cliente?.nome || "—"}</div>
          <div className="text-[11px] text-muted-foreground font-mono">{row.pedido.codigo}</div>
        </div>
        {row.pedido.vip && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> VIP
          </span>
        )}
      </div>

      {/* Etapa */}
      <div>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium"
          style={{ background: meta.bg, color: meta.color }}
        >
          <meta.icon className="w-3.5 h-3.5" />
          {meta.label}
        </span>
      </div>

      {/* Consultor / prazo */}
      <div>
        <div className="text-[12px] font-medium">—</div>
        <div className={`text-[11px] font-semibold ${prazoColor}`}>{prazoLabel}</div>
      </div>

      {/* Ação */}
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onConcluir}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-[11px] font-medium"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Concluir
        </button>
      </div>
    </div>
  );
}

function fmtDateBR(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
