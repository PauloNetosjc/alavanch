import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  ChevronRight,
  User as UserIcon,
} from "lucide-react";

type Chamado = {
  id: string;
  codigo: string | null;
  status: string | null;
  prioridade: string | null;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  tecnico_id: string | null;
  arquivada: boolean | null;
  cliente: { nome: string } | null;
  pedido: { codigo: string } | null;
};

const STATUS_LABELS: Record<string, { label: string; bg: string; fg: string }> = {
  triagem: { label: "Triagem", bg: "#fef3c7", fg: "#92400e" },
  aguardando_material: { label: "Aguardando Material", bg: "#fef3c7", fg: "#92400e" },
  agendada: { label: "Agendado", bg: "#e0e7ff", fg: "#4338ca" },
  em_atendimento: { label: "Em Andamento", bg: "#fef9c3", fg: "#854d0e" },
  conferencia: { label: "Conferência", bg: "#f3e8ff", fg: "#6b21a8" },
  concluida: { label: "Concluído", bg: "#dcfce7", fg: "#166534" },
};

const PRIO_FG: Record<string, string> = {
  baixa: "#2563eb",
  media: "#16a34a",
  alta: "#ea580c",
  urgente: "#dc2626",
};

export default function MeusChamados() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "admin";
  const [list, setList] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ativos");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from("assistencias")
      .select(
        "id, codigo, status, prioridade, data_agendamento, hora_agendamento, tecnico_id, arquivada, cliente:clientes(nome), pedido:pedidos(codigo)"
      )
      .order("created_at", { ascending: false });
    if (!isAdmin) q = q.eq("tecnico_id", user.id);
    const { data } = await q;
    setList((data || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user, isAdmin]);

  const filtered = useMemo(() => {
    return list.filter((c) => {
      if (filterStatus === "ativos" && (c.status === "concluida" || c.arquivada)) return false;
      if (filterStatus === "arquivados" && !c.arquivada) return false;
      if (filterStatus === "concluidos" && c.status !== "concluida") return false;
      if (
        filterStatus !== "ativos" &&
        filterStatus !== "arquivados" &&
        filterStatus !== "concluidos" &&
        filterStatus !== "todos" &&
        c.status !== filterStatus
      )
        return false;
      if (!search) return true;
      const t = search.toLowerCase();
      return (
        (c.cliente?.nome || "").toLowerCase().includes(t) ||
        (c.pedido?.codigo || "").toLowerCase().includes(t) ||
        (c.codigo || "").toLowerCase().includes(t)
      );
    });
  }, [list, search, filterStatus]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        iconVariant="purple"
        title="Meus Chamados"
        subtitle={isAdmin ? "TODOS OS CHAMADOS DA EMPRESA" : "CHAMADOS ATRIBUÍDOS A VOCÊ"}
      />

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <button className="w-10 h-10 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:bg-muted">
          <Filter className="w-4 h-4" />
        </button>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos ({list.filter((c) => c.status !== "concluida" && !c.arquivada).length})</SelectItem>
            <SelectItem value="todos">Todos ({list.length})</SelectItem>
            <SelectItem value="triagem">Triagem</SelectItem>
            <SelectItem value="agendada">Agendados</SelectItem>
            <SelectItem value="em_atendimento">Em Andamento</SelectItem>
            <SelectItem value="conferencia">Conferência</SelectItem>
            <SelectItem value="concluidos">Concluídos</SelectItem>
            <SelectItem value="arquivados">Arquivados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="surface-card p-12 text-center text-[12px] text-muted-foreground">
          Carregando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <div className="text-[14px] font-medium">Nenhum chamado encontrado</div>
          <div className="text-[12px] text-muted-foreground mt-1">
            {isAdmin
              ? "Não há chamados cadastrados ainda."
              : "Você ainda não possui chamados atribuídos."}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const st = STATUS_LABELS[c.status || "triagem"] || STATUS_LABELS.triagem;
            const prioFg = PRIO_FG[(c.prioridade || "media").toLowerCase()] || "#16a34a";
            const dataStr = c.data_agendamento
              ? new Date(c.data_agendamento + "T00:00:00").toLocaleDateString("pt-BR")
              : null;
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/meus-chamados/${c.id}`)}
                className="w-full text-left surface-card p-5 hover:shadow-md transition flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[15px] font-bold">
                      Chamado #{(c.codigo || "").replace(/\D/g, "").slice(-4) || "—"}
                    </span>
                    <span
                      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ background: st.bg, color: st.fg }}
                    >
                      {st.label}
                    </span>
                    {c.arquivada && (
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                        Arquivado
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-muted-foreground uppercase mb-3">
                    {c.cliente?.nome || "—"}
                  </div>
                  <div className="grid grid-cols-2 gap-6 max-w-md">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-md bg-emerald-50 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                          Data & Hora
                        </div>
                        <div className="text-[12px] font-medium">
                          {dataStr ? `${dataStr}${c.hora_agendamento ? ` às ${c.hora_agendamento.slice(0, 5)}` : ""}` : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-md bg-emerald-50 flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                          Prioridade
                        </div>
                        <div className="text-[12px] font-medium capitalize" style={{ color: prioFg }}>
                          {c.prioridade || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
