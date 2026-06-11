import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  ChevronRight,
  Download,
  CheckCircle2,
  CalendarPlus,
  CalendarDays,
  List,
} from "lucide-react";
import { exportChamadosCSV, exportChamadosPDF, type ChamadoExport } from "@/lib/exportChamados";
import { TarefasPanel } from "@/components/tarefas/TarefasPanel";
import { MinhasTarefasNativasPanel } from "@/components/tarefas/MinhasTarefasNativasPanel";
import { PlanejamentoSemanalChamados } from "@/components/tarefas/PlanejamentoSemanalChamados";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Chamado = {
  id: string;
  codigo: string | null;
  status: string | null;
  prioridade: string | null;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  tecnico_id: string | null;
  pedido_id: string | null;
  cliente_id: string | null;
  loja_id: string | null;
  arquivada: boolean | null;
  data_limite: string | null;
  cliente: { nome: string } | null;
  pedido: { codigo: string } | null;
  tecnico_nome?: string | null;
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
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [agendarTarget, setAgendarTarget] = useState<Chamado | null>(null);
  const [agendarData, setAgendarData] = useState<string>(new Date().toISOString().slice(0, 10));
  const [agendarHora, setAgendarHora] = useState<string>("09:00");
  const [agendarTecnico, setAgendarTecnico] = useState<string>("");
  const [tecnicos, setTecnicos] = useState<{ user_id: string; nome_completo: string | null }[]>([]);
  const [salvandoAg, setSalvandoAg] = useState(false);
  const [concluindoId, setConcluindoId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"lista" | "semana">("lista");

  const openAgendar = async (c: Chamado) => {
    setAgendarTarget(c);
    setAgendarData(c.data_agendamento || new Date().toISOString().slice(0, 10));
    setAgendarHora(c.hora_agendamento?.slice(0, 5) || "09:00");
    setAgendarTecnico(c.tecnico_id || user?.id || "");
    if (tecnicos.length === 0) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, nome_completo")
        .order("nome_completo");
      setTecnicos((data as any) || []);
    }
    setAgendarOpen(true);
  };

  const salvarAgendamento = async () => {
    if (!agendarTarget) return;
    if (!agendarData || !agendarHora || !agendarTecnico) {
      toast.error("Preencha data, hora e responsável");
      return;
    }
    setSalvandoAg(true);
    try {
      const { error: e1 } = await supabase
        .from("assistencias")
        .update({
          status: "agendada",
          data_agendamento: agendarData,
          hora_agendamento: agendarHora,
          tecnico_id: agendarTecnico,
        })
        .eq("id", agendarTarget.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("agenda_eventos").insert({
        tipo: "assistencia_tecnica",
        titulo: `Assistência ${agendarTarget.codigo || ""}`.trim(),
        descricao: `Chamado ${agendarTarget.codigo || ""} — ${agendarTarget.cliente?.nome || ""}`,
        data: agendarData,
        hora_inicio: agendarHora,
        responsavel_id: agendarTecnico,
        pedido_id: agendarTarget.pedido_id,
        cliente_id: agendarTarget.cliente_id,
        loja_id: agendarTarget.loja_id,
        created_by: user?.id || null,
      });
      if (e2) throw e2;
      toast.success("Tarefa agendada");
      setAgendarOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Erro ao agendar");
    } finally {
      setSalvandoAg(false);
    }
  };

  const concluirChamado = async (c: Chamado) => {
    if (!confirm(`Concluir chamado ${c.codigo || ""}?`)) return;
    setConcluindoId(c.id);
    try {
      const { error } = await supabase
        .from("assistencias")
        .update({ status: "concluida", concluida_em: new Date().toISOString() })
        .eq("id", c.id);
      if (error) throw error;
      toast.success("Chamado concluído");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Erro ao concluir");
    } finally {
      setConcluindoId(null);
    }
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from("assistencias")
      .select(
        "id, codigo, status, prioridade, data_agendamento, hora_agendamento, tecnico_id, pedido_id, cliente_id, loja_id, arquivada, data_limite, cliente:clientes(nome), pedido:pedidos(codigo)"
      )
      .order("created_at", { ascending: false });
    if (!isAdmin) q = q.eq("tecnico_id", user.id);
    const { data } = await q;
    const rows = (data || []) as any[];
    // Buscar nomes dos técnicos para enriquecer (export)
    const techIds = Array.from(new Set(rows.map((r) => r.tecnico_id).filter(Boolean)));
    let techMap: Record<string, string> = {};
    if (techIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome_completo")
        .in("user_id", techIds);
      (profs || []).forEach((p: any) => (techMap[p.user_id] = p.nome_completo));
    }
    rows.forEach((r) => (r.tecnico_nome = r.tecnico_id ? techMap[r.tecnico_id] || null : null));
    setList(rows as any);
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

  const buildExport = (): ChamadoExport[] =>
    filtered.map((c) => ({
      codigo: c.codigo || "",
      cliente: c.cliente?.nome || "",
      pedido: c.pedido?.codigo || "",
      status: STATUS_LABELS[c.status || "triagem"]?.label || c.status || "",
      prioridade: c.prioridade || "",
      data_agendamento: c.data_agendamento
        ? new Date(c.data_agendamento + "T00:00:00").toLocaleDateString("pt-BR")
        : "",
      hora_agendamento: c.hora_agendamento?.slice(0, 5) || "",
      tecnico: c.tecnico_nome || "",
    }));

  const exportLabel = `Filtro: ${filterStatus}${search ? ` • Busca: "${search}"` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        iconVariant="purple"
        title="Meus Chamados"
        subtitle={isAdmin ? "TODOS OS CHAMADOS DA EMPRESA" : "CHAMADOS ATRIBUÍDOS A VOCÊ"}
      />

      {/* Toggle Lista/Semana */}
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === "lista" ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setViewMode("lista")}
        >
          <List className="w-4 h-4" />
          Lista
        </Button>
        <Button
          variant={viewMode === "semana" ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setViewMode("semana")}
        >
          <CalendarDays className="w-4 h-4" />
          Planejamento semanal
        </Button>
      </div>

      {viewMode === "semana" ? (
        <PlanejamentoSemanalChamados />
      ) : (
      <>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" disabled={filtered.length === 0}>
              <Download className="w-4 h-4" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportChamadosCSV(buildExport())}>
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                exportChamadosPDF(buildExport(), {
                  titulo: isAdmin ? "Chamados — Empresa" : "Meus Chamados",
                  filtros: exportLabel,
                })
              }
            >
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
      ) : (() => {
        // Renderiza cards (com agrupamento por técnico quando admin)
        const renderCard = (c: Chamado) => {
            const st = STATUS_LABELS[c.status || "triagem"] || STATUS_LABELS.triagem;
            const prioFg = PRIO_FG[(c.prioridade || "media").toLowerCase()] || "#16a34a";
            const dataStr = c.data_agendamento
              ? new Date(c.data_agendamento + "T00:00:00").toLocaleDateString("pt-BR")
              : null;
            const prazoStr = c.data_limite
              ? new Date(c.data_limite + "T00:00:00").toLocaleDateString("pt-BR")
              : null;
            const hojeStr = new Date().toISOString().slice(0,10);
            const atrasado = c.data_limite && c.data_limite < hojeStr && c.status !== "concluida";
            const isConcluida = c.status === "concluida";
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/meus-chamados/${c.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter") navigate(`/meus-chamados/${c.id}`); }}
                className="w-full text-left surface-card p-5 hover:shadow-md transition flex items-center gap-4 cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[15px] font-bold">
                      Chamado #{(c.codigo || "").replace(/\D/g, "").slice(-4) || "—"}
                    </span>
                    <span
                      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ background: st.bg, color: st.fg }}
                    >
                      {st.label}
                    </span>
                    {prazoStr && (
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${atrasado ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                        Prazo: {prazoStr}{atrasado ? " (vencido)" : ""}
                      </span>
                    )}
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
                <div className="flex flex-col gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {!isConcluida && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={(e) => { e.stopPropagation(); openAgendar(c); }}
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        Agendar
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1.5"
                        disabled={concluindoId === c.id}
                        onClick={(e) => { e.stopPropagation(); concluirChamado(c); }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Concluir
                      </Button>
                    </>
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground self-end" />
                </div>
              </div>
            );
        };

        if (isAdmin) {
          const grupos: Record<string, Chamado[]> = {};
          filtered.forEach((c) => {
            const k = c.tecnico_nome || "Sem técnico atribuído";
            (grupos[k] = grupos[k] || []).push(c);
          });
          return (
            <div className="space-y-6">
              {Object.entries(grupos).map(([nome, lista]) => (
                <div key={nome}>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                    {nome} <span className="opacity-60">({lista.length})</span>
                  </div>
                  <div className="space-y-3">{lista.map(renderCard)}</div>
                </div>
              ))}
            </div>
          );
        }
        return <div className="space-y-3">{filtered.map(renderCard)}</div>;
      })()}

      {/* TAREFAS NATIVAS DO PEDIDO */}
      <MinhasTarefasNativasPanel />

      {/* TAREFAS DO USUÁRIO (manuais/internas) */}
      <TarefasPanel
        scope={isAdmin ? "todas" : "minhas"}
        groupByUser={isAdmin}
        title={isAdmin ? "Tarefas (todas)" : "Minhas Tarefas"}
      />

      <Dialog open={agendarOpen} onOpenChange={setAgendarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar Chamado {agendarTarget?.codigo || ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente</Label>
              <div className="text-sm text-muted-foreground">{agendarTarget?.cliente?.nome || "—"}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ag-data">Data</Label>
                <Input id="ag-data" type="date" value={agendarData} onChange={(e) => setAgendarData(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ag-hora">Hora</Label>
                <Input id="ag-hora" type="time" value={agendarHora} onChange={(e) => setAgendarHora(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Técnico Responsável</Label>
              <Select value={agendarTecnico} onValueChange={setAgendarTecnico}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {tecnicos.map((t) => (
                    <SelectItem key={t.user_id} value={t.user_id}>{t.nome_completo || t.user_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgendarOpen(false)} disabled={salvandoAg}>Cancelar</Button>
            <Button onClick={salvarAgendamento} disabled={salvandoAg}>{salvandoAg ? "Salvando…" : "Agendar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
