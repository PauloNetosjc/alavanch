import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Briefcase, Plus, Search, FileText, CheckCircle2, Clock, DollarSign } from "lucide-react";
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

const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  negociacao: { label: "Negociação", bg: "hsl(var(--status-warning-bg))", fg: "hsl(var(--status-warning-fg))" },
  aprovado:   { label: "Aprovado",   bg: "hsl(var(--status-success-bg))", fg: "hsl(var(--status-success-fg))" },
  convertido: { label: "Convertido", bg: "hsl(var(--status-info-bg))",    fg: "hsl(var(--status-info-fg))" },
  perdido:    { label: "Perdido",    bg: "hsl(var(--status-danger-bg))",  fg: "hsl(var(--status-danger-fg))" },
};

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface KpiTileProps {
  label: string; value: string | number; icon: typeof FileText;
  variant: "blue" | "green" | "amber" | "purple";
}
const variantStyles: Record<KpiTileProps["variant"], { bg: string; border: string; icon: string; value: string }> = {
  blue:   { bg: "#EAF2FB", border: "#D6E4F5", icon: "#3B6FB0", value: "#1E3A6B" },
  green:  { bg: "#E8F4ED", border: "#D2E8DB", icon: "#3F8B5C", value: "#1F5235" },
  amber:  { bg: "#FBF3DF", border: "#F3E5BF", icon: "#A8842A", value: "#6B5210" },
  purple: { bg: "#F4ECF7", border: "#E5D6EE", icon: "#7E4FA0", value: "#4A2A66" },
};
function KpiTile({ label, value, icon: Icon, variant }: KpiTileProps) {
  const s = variantStyles[variant];
  return (
    <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      <div className="flex items-start justify-between">
        <span className="text-[12px] font-medium" style={{ color: s.value, opacity: 0.85 }}>{label}</span>
        <Icon className="w-4 h-4" style={{ color: s.icon }} />
      </div>
      <div className="text-[28px] font-semibold leading-none tracking-tight" style={{ color: s.value }}>{value}</div>
    </div>
  );
}

export default function Comercial() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OrcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("todos");

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

  const stats = useMemo(() => {
    const total = rows.length;
    const abertos = rows.filter((r) => r.status === "negociacao").length;
    const aprovados = rows.filter((r) => r.status === "aprovado" || r.status === "convertido").length;
    const valor = rows.filter((r) => r.status !== "perdido").reduce((s, r) => s + (Number(r.total) || 0), 0);
    return { total, abertos, aprovados, valor };
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (filter !== "todos" && r.status !== filter) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.codigo.toLowerCase().includes(q) ||
      (r.nome_projeto ?? "").toLowerCase().includes(q) ||
      (r.cliente?.nome ?? "").toLowerCase().includes(q)
    );
  });

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div>
      <PageHeader
        icon={Briefcase}
        iconVariant="purple"
        title="Comercial"
        subtitle="Gestão de orçamentos e propostas"
        actions={
          <Button onClick={() => navigate("/comercial/novo")} className="gap-1.5">
            <Plus className="w-4 h-4" /> Novo Orçamento
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiTile label="Total de Orçamentos"  value={stats.total}     icon={FileText}     variant="blue" />
        <KpiTile label="Em Negociação"        value={stats.abertos}   icon={Clock}        variant="amber" />
        <KpiTile label="Aprovados"            value={stats.aprovados} icon={CheckCircle2} variant="green" />
        <KpiTile label="Valor em Carteira"    value={fmtBrl(stats.valor)} icon={DollarSign} variant="purple" />
      </div>

      <div className="surface-card mb-4 flex items-center gap-3" style={{ padding: 12 }}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, projeto ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="negociacao">Negociação</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="convertido">Convertido</SelectItem>
            <SelectItem value="perdido">Perdido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="surface-card p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : filtered.length === 0 ? (
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
                <TableHead>Código</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.negociacao;
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/comercial/${r.id}`)}>
                    <TableCell className="text-mono">{r.codigo}</TableCell>
                    <TableCell className="font-medium">{r.nome_projeto ?? "—"}</TableCell>
                    <TableCell>{r.cliente?.nome ?? "—"}</TableCell>
                    <TableCell>
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded"
                        style={{ background: st.bg, color: st.fg }}
                      >
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-mono">{fmtBrl(Number(r.total) || 0)}</TableCell>
                    <TableCell className="text-[12px]">{fmtDate(r.created_at)}</TableCell>
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
