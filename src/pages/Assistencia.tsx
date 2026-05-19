import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Wrench,
  ChevronDown,
  ChevronUp,
  Camera,
  Upload,
  AlertCircle,
  Package,
  CalendarCheck,
  Zap,
  CheckSquare,
  CheckCircle2,
  ListChecks,
  Eye,
  UserCircle2,
  Clock,
  X,
  FileText,
  User,
  Calendar,
  History,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { logAssistenciaEvent, notifyAssistencia, getAdminUserIds } from "@/lib/assistenciaEvents";

type Assistencia = {
  id: string;
  codigo: string | null;
  tipo: string;
  prioridade: string | null;
  status: string | null;
  descricao: string | null;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  observacoes: string | null;
  material_necessario: boolean | null;
  tecnico_id: string | null;
  created_at: string;
  data_limite: string | null;
  cliente: { nome: string } | null;
  pedido: { codigo: string } | null;
  tecnico?: { nome_completo: string } | null;
};

const PRAZO_DIAS: Record<string, number> = { baixa: 45, media: 35, alta: 25, urgente: 7 };

type Profile = { user_id: string; nome_completo: string | null };

const TIPOS = ["Ajuste", "Reparo", "Substituição", "Garantia", "Outro"];

const STATUS_GROUPS = [
  { key: "triagem", label: "Pendentes de Triagem", icon: AlertCircle, color: "#dc2626", bg: "#fef2f2", border: "#fecaca", subtitle: "chamados aguardando análise" },
  { key: "aguardando_material", label: "Aguardando Material", icon: Package, color: "#d97706", bg: "#fffbeb", border: "#fde68a", subtitle: "chamados sem material" },
  { key: "agendada", label: "Agendados", icon: CalendarCheck, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", subtitle: "chamados com técnico atribuído" },
  { key: "em_atendimento", label: "Em Andamento", icon: Zap, color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", subtitle: "chamados sendo executados" },
  { key: "conferencia", label: "Conferência", icon: CheckSquare, color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", subtitle: "chamados em validação" },
  { key: "concluida", label: "Concluídos", icon: CheckCircle2, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", subtitle: "chamados finalizados" },
];

const PRIO_COLORS: Record<string, { bg: string; fg: string; ring: string; label: string }> = {
  baixa: { bg: "#dbeafe", fg: "#1e40af", ring: "#bfdbfe", label: "Baixa" },
  media: { bg: "#fde68a", fg: "#92400e", ring: "#fcd34d", label: "Média" },
  alta: { bg: "#fed7aa", fg: "#9a3412", ring: "#fdba74", label: "Alta" },
  urgente: { bg: "#fecaca", fg: "#b91c1c", ring: "#fca5a5", label: "Urgente" },
};

export default function Assistencia() {
  const [list, setList] = useState<Assistencia[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [prioFilter, setPrioFilter] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    triagem: true,
    em_atendimento: true,
  });
  const [openNova, setOpenNova] = useState(false);
  const [openAtribuir, setOpenAtribuir] = useState<Assistencia | null>(null);
  const [openHistorico, setOpenHistorico] = useState<Assistencia | null>(null);
  const [openConferencia, setOpenConferencia] = useState<Assistencia | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("assistencias")
      .select(
        "id, codigo, tipo, prioridade, status, descricao, data_agendamento, hora_agendamento, observacoes, material_necessario, tecnico_id, data_limite, created_at, cliente:clientes(nome), pedido:pedidos(codigo)"
      )
      .eq("arquivada", false)
      .order("created_at", { ascending: false });
    const items = (data || []) as any[];

    // Resolve técnico
    const techIds = Array.from(new Set(items.map((i) => i.tecnico_id).filter(Boolean)));
    let techMap: Record<string, string> = {};
    if (techIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome_completo")
        .in("user_id", techIds);
      (profs || []).forEach((p) => {
        techMap[p.user_id] = p.nome_completo || "";
      });
    }
    items.forEach((i) => {
      if (i.tecnico_id && techMap[i.tecnico_id]) {
        i.tecnico = { nome_completo: techMap[i.tecnico_id] };
      }
    });
    setList(items as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase
      .from("profiles")
      .select("user_id, nome_completo")
      .order("nome_completo")
      .then(({ data }) => setProfiles((data || []) as Profile[]));
  }, []);

  const filtered = useMemo(() => {
    return list.filter((a) => {
      if (prioFilter && (a.prioridade || "").toLowerCase() !== prioFilter) return false;
      if (!search) return true;
      const t = search.toLowerCase();
      return (
        (a.cliente?.nome || "").toLowerCase().includes(t) ||
        (a.pedido?.codigo || "").toLowerCase().includes(t) ||
        (a.descricao || "").toLowerCase().includes(t) ||
        (a.codigo || "").toLowerCase().includes(t)
      );
    });
  }, [list, prioFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: list.length };
    STATUS_GROUPS.forEach((g) => (c[g.key] = 0));
    list.forEach((a) => {
      const s = (a.status || "triagem").toLowerCase();
      if (c[s] !== undefined) c[s]++;
    });
    return c;
  }, [list]);

  const toggleGroup = (k: string) =>
    setOpenGroups((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wrench}
        iconVariant="purple"
        title="Assistência Técnica"
        subtitle="GESTÃO CENTRALIZADA DE CHAMADOS E ATENDIMENTOS"
        actions={
          <Button onClick={() => setOpenNova(true)} className="bg-[#5b5bf5] hover:bg-[#4a4ae0]">
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Assistência
          </Button>
        }
      />

      {/* KPIs coloridos */}
      <div>
        <div className="text-[12px] text-muted-foreground mb-2">Resumo de Assistências</div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KpiTile label="TODOS" value={counts.todos} icon={ListChecks} bg="#1e293b" fg="#ffffff" />
          <KpiTile label="TRIAGEM" value={counts.triagem || 0} icon={AlertCircle} bg="#dc2626" fg="#ffffff" />
          <KpiTile label="MATERIAL" value={counts.aguardando_material || 0} icon={Package} bg="#f59e0b" fg="#ffffff" />
          <KpiTile label="AGENDADO" value={counts.agendada || 0} icon={CalendarCheck} bg="#2563eb" fg="#ffffff" />
          <KpiTile label="EM ANDAMENTO" value={counts.em_atendimento || 0} icon={Zap} bg="#0891b2" fg="#ffffff" />
          <KpiTile label="CONFERÊNCIA" value={counts.conferencia || 0} icon={CheckSquare} bg="#7c3aed" fg="#ffffff" />
          <KpiTile label="CONCLUÍDO" value={counts.concluida || 0} icon={CheckCircle2} bg="#16a34a" fg="#ffffff" />
        </div>
      </div>

      {/* Filtros */}
      <div className="surface-card p-4 space-y-3">
        <div className="text-[12px] text-muted-foreground">Filtrar Assistências</div>
        <Input
          placeholder="Buscar por cliente, contrato ou descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {Object.entries(PRIO_COLORS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setPrioFilter(prioFilter === k ? null : k)}
              className={`px-3 py-1 text-[11px] font-medium rounded-full transition border-2`}
              style={{
                background: prioFilter === k ? v.bg : "transparent",
                color: prioFilter === k ? v.fg : "hsl(var(--muted-foreground))",
                borderColor: prioFilter === k ? v.ring : "hsl(var(--border))",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grupos por status */}
      {loading ? (
        <div className="surface-card p-12 text-center text-[12px] text-muted-foreground">Carregando…</div>
      ) : (
        <div className="space-y-3">
          {STATUS_GROUPS.map((g) => {
            const items = filtered.filter((a) => (a.status || "triagem") === g.key);
            if (items.length === 0 && !openGroups[g.key]) return null;
            const isOpen = !!openGroups[g.key];
            return (
              <div
                key={g.key}
                className="rounded-xl overflow-hidden border-l-4"
                style={{ borderLeftColor: g.color, background: g.bg }}
              >
                <button
                  onClick={() => toggleGroup(g.key)}
                  className="w-full flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                      style={{ background: g.color }}
                    >
                      <g.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-[16px] font-semibold" style={{ color: g.color }}>
                        {g.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {items.length} {g.subtitle}
                      </div>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {isOpen && (
                  <div className="bg-card/60 border-t border-border/50 p-4 space-y-3">
                    {items.length === 0 ? (
                      <div className="text-center py-6 text-[12px] text-muted-foreground">Nenhum chamado neste status.</div>
                    ) : (
                      items.map((a) => (
                        <ChamadoCard
                          key={a.id}
                          a={a}
                          onAtribuir={() => setOpenAtribuir(a)}
                          onHistorico={() => setOpenHistorico(a)}
                          onConferencia={() => setOpenConferencia(a)}
                          onVerDetalhes={() => navigate(`/meus-chamados/${a.id}`)}
                          onChange={load}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <NovaAssistenciaDialog open={openNova} onClose={() => setOpenNova(false)} onCreated={load} profiles={profiles} />
      {openAtribuir && (
        <AtribuirDialog
          assist={openAtribuir}
          profiles={profiles}
          onClose={() => setOpenAtribuir(null)}
          onSaved={load}
        />
      )}
      {openHistorico && (
        <HistoricoDialog assist={openHistorico} onClose={() => setOpenHistorico(null)} />
      )}
      {openConferencia && (
        <ConferenciaDialog
          assist={openConferencia}
          onClose={() => setOpenConferencia(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

/* ---------------- Kpi tile ---------------- */
function KpiTile({
  label, value, icon: Icon, bg, fg,
}: { label: string; value: number; icon: any; bg: string; fg: string }) {
  return (
    <div className="rounded-xl p-4 relative" style={{ background: bg, color: fg }}>
      <div className="text-[10px] font-semibold tracking-wider opacity-90">{label}</div>
      <div className="text-[28px] font-bold mt-1 leading-none">{value}</div>
      <div className="absolute right-3 bottom-3 w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
    </div>
  );
}

/* ---------------- Chamado card ---------------- */
function ChamadoCard({
  a, onAtribuir, onHistorico, onConferencia, onVerDetalhes, onChange,
}: {
  a: Assistencia;
  onAtribuir: () => void;
  onHistorico: () => void;
  onConferencia: () => void;
  onVerDetalhes: () => void;
  onChange: () => void;
}) {
  const prio = PRIO_COLORS[(a.prioridade || "media").toLowerCase()] || PRIO_COLORS.media;
  const created = new Date(a.created_at);
  const createdStr = `${String(created.getDate()).padStart(2, "0")}/${String(created.getMonth() + 1).padStart(2, "0")}/${created.getFullYear()}, ${String(created.getHours()).padStart(2, "0")}:${String(created.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="rounded-xl bg-card border border-border p-4">
      {/* Top: Tipo / Prioridade */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "#fee2e2", color: "#b91c1c" }}>
          Novo Chamado
        </span>
        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: prio.bg, color: prio.fg }}>
          {prio.label}
        </span>
        {a.data_limite && (() => {
          const hoje = new Date().toISOString().slice(0,10);
          const vencido = a.data_limite < hoje && a.status !== "concluida";
          return (
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${vencido ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
              Prazo: {new Date(a.data_limite + "T00:00:00").toLocaleDateString("pt-BR")}{vencido ? " (vencido)" : ""}
            </span>
          );
        })()}
      </div>

      {/* Conteúdo */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-[11px] font-mono text-muted-foreground shrink-0">
          {(a.codigo || "").replace(/\D/g, "").slice(-4) || "—"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold uppercase">{a.cliente?.nome || "—"}</div>
          <div className="text-[12px] text-muted-foreground">
            {a.pedido?.codigo ? `Contrato #${a.pedido.codigo}` : "—"}
          </div>
          {a.descricao && (
            <div className="text-[12px] text-muted-foreground mt-1 line-clamp-2">{a.descricao}</div>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3 text-[11px] text-muted-foreground mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider">Criado em</div>
          <div className="text-foreground">{createdStr}</div>
        </div>
        {a.tecnico?.nome_completo && (
          <div>
            <div className="text-[10px] uppercase tracking-wider">Técnico Responsável</div>
            <div className="text-foreground inline-flex items-center gap-1.5">
              <UserCircle2 className="w-3.5 h-3.5" />
              {a.tecnico.nome_completo}
            </div>
          </div>
        )}
        {a.data_agendamento && (
          <div>
            <div className="text-[10px] uppercase tracking-wider">Agendamento</div>
            <div className="text-foreground inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {new Date(a.data_agendamento + "T00:00:00").toLocaleDateString("pt-BR")}
              {a.hora_agendamento ? ` às ${a.hora_agendamento.slice(0, 5)}` : ""}
            </div>
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60 flex-wrap">
        <button
          onClick={onHistorico}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-muted"
          title="Ver histórico auditável"
        >
          <History className="w-3.5 h-3.5" />
          Histórico
        </button>
        <button
          onClick={onVerDetalhes}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-muted"
        >
          <Eye className="w-3.5 h-3.5" />
          Ver Detalhes
        </button>
        {a.status === "triagem" && (
          <button
            onClick={onAtribuir}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-[#dc2626] text-white hover:bg-[#b91c1c]"
          >
            Atribuir
          </button>
        )}
        {a.status === "conferencia" && (
          <button
            onClick={onConferencia}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-[#7c3aed] text-white hover:bg-[#6d28d9]"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Conferir
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Dialog: Nova Assistência ---------------- */
function NovaAssistenciaDialog({
  open, onClose, onCreated, profiles,
}: { open: boolean; onClose: () => void; onCreated: () => void; profiles: Profile[] }) {
  const [pedidos, setPedidos] = useState<{ id: string; codigo: string; cliente_id: string; cliente: { nome: string } | null }[]>([]);
  const [pedidoId, setPedidoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [tecnicoId, setTecnicoId] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("pedidos")
      .select("id, codigo, cliente_id, cliente:clientes(nome)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPedidos((data || []) as any));
    setPedidoId("");
    setDescricao("");
    setPrioridade("media");
    setTecnicoId("");
    setFiles([]);
  }, [open]);

  const submit = async () => {
    if (!pedidoId) return toast.error("Selecione o contrato");
    if (!descricao.trim()) return toast.error("Descreva o problema");
    setLoading(true);
    const ped = pedidos.find((p) => p.id === pedidoId);
    const codigo = `AT-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { data: ins, error } = await supabase
      .from("assistencias")
      .insert({
        codigo,
        cliente_id: ped?.cliente_id || null,
        pedido_id: pedidoId,
        tipo: "Garantia",
        prioridade,
        descricao,
        status: "triagem",
      })
      .select()
      .maybeSingle();
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    // Upload de fotos
    if (ins && files.length > 0) {
      for (const f of files) {
        const path = `assistencias/${ins.id}/${Date.now()}_${f.name}`;
        const { error: upErr } = await supabase.storage.from("order-attachments").upload(path, f);
        if (!upErr) {
          const { data: pub } = supabase.storage.from("order-attachments").getPublicUrl(path);
          await supabase.from("fotos_assistencia").insert({
            assistencia_id: ins.id,
            url: pub.publicUrl,
            tipo: "abertura",
          });
        }
      }
    }
    if (ins) {
      await logAssistenciaEvent(ins.id, "criacao", `Chamado ${codigo} criado`, {
        prioridade,
        pedido_id: pedidoId,
      });
      const admins = await getAdminUserIds();
      await notifyAssistencia({
        assistenciaId: ins.id,
        userIds: admins,
        tipo: "assistencia_triagem",
        titulo: "Novo chamado em triagem",
        mensagem: `${codigo} - ${ped?.cliente?.nome || ""}`,
      });
    }
    setLoading(false);
    toast.success("Assistência criada!");
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#ede9fe] flex items-center justify-center">
              <Wrench className="w-5 h-5 text-[#5b5bf5]" />
            </div>
            <div>
              <DialogTitle className="text-[20px]">Nova Assistência</DialogTitle>
              <p className="text-[12px] text-muted-foreground">Registre um novo chamado técnico</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#5b5bf5]" />
              Selecione o Contrato
            </Label>
            <Select value={pedidoId || undefined} onValueChange={setPedidoId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Buscar contrato..." />
              </SelectTrigger>
              <SelectContent>
                {pedidos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    #{p.codigo} - {p.cliente?.nome || "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              Descrição do Problema
            </Label>
            <Textarea
              rows={4}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o problema..."
              className="mt-1.5"
            />
          </div>

          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-cyan-500" />
              Fotos (opcional) <span className="text-muted-foreground ml-auto">({files.length}/10)</span>
            </Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2 mb-2">
              {files.map((f, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setFiles(files.filter((_, x) => x !== i))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/30 transition">
              <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <div className="text-[12px] font-medium">Clique para adicionar fotos</div>
              <div className="text-[10px] text-muted-foreground">PNG, JPG até 5MB</div>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const news = Array.from(e.target.files || []);
                  setFiles([...files, ...news].slice(0, 10));
                }}
              />
            </label>
          </div>

          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider">Prioridade</Label>
            <div className="grid grid-cols-4 gap-2 mt-1.5">
              {Object.entries(PRIO_COLORS).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPrioridade(k)}
                  className={`py-2.5 rounded-lg text-[12px] font-semibold transition border-2 flex flex-col items-center`}
                  style={{
                    background: prioridade === k ? v.bg : "#f8fafc",
                    color: prioridade === k ? v.fg : "#94a3b8",
                    borderColor: prioridade === k ? v.fg : "transparent",
                  }}
                >
                  <span>{v.label}</span>
                  <span className="text-[9px] opacity-80 mt-0.5">{PRAZO_DIAS[k]} dias úteis</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Prazo limite será calculado automaticamente com base na prioridade.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading} className="bg-[#5b5bf5] hover:bg-[#4a4ae0]">
            {loading ? "Criando…" : "Criar Assistência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Dialog: Atribuir Técnico ---------------- */
type MaterialItem = { descricao: string; quantidade: number; origem: string };

function AtribuirDialog({
  assist, profiles, onClose, onSaved,
}: { assist: Assistencia; profiles: Profile[]; onClose: () => void; onSaved: () => void }) {
  const [material, setMaterial] = useState<boolean>(!!assist.material_necessario);
  const [tecnicoId, setTecnicoId] = useState(assist.tecnico_id || "");
  const [data, setData] = useState(assist.data_agendamento || "");
  const [hora, setHora] = useState(assist.hora_agendamento?.slice(0, 5) || "");
  const [obs, setObs] = useState(assist.observacoes || "");
  const [loading, setLoading] = useState(false);
  const [origem, setOrigem] = useState<"deposito" | "compra" | "fabrica">("deposito");
  const [matDesc, setMatDesc] = useState("");
  const [matQtd, setMatQtd] = useState<number>(1);
  const [materiais, setMateriais] = useState<MaterialItem[]>([]);

  useEffect(() => {
    supabase
      .from("materiais_assistencia")
      .select("descricao, quantidade, origem")
      .eq("assistencia_id", assist.id)
      .then(({ data }) => setMateriais((data || []) as any));
  }, [assist.id]);

  const addMaterial = () => {
    if (!matDesc.trim()) return toast.error("Descreva o material");
    setMateriais([...materiais, { descricao: matDesc.trim(), quantidade: matQtd || 1, origem }]);
    setMatDesc("");
    setMatQtd(1);
  };

  const removeMaterial = (i: number) => setMateriais(materiais.filter((_, x) => x !== i));

  const submit = async () => {
    if (material) {
      if (materiais.length === 0) return toast.error("Adicione ao menos um material");
    } else {
      if (!tecnicoId) return toast.error("Selecione o técnico");
      if (!data) return toast.error("Defina a data");
    }
    setLoading(true);
    const newStatus = material ? "aguardando_material" : "agendada";
    const { error } = await supabase
      .from("assistencias")
      .update({
        material_necessario: material,
        tecnico_id: material ? assist.tecnico_id : tecnicoId,
        data_agendamento: material ? null : data,
        hora_agendamento: material ? null : (hora || null),
        observacoes: obs,
        status: newStatus,
      })
      .eq("id", assist.id);
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    if (material && materiais.length > 0) {
      // Resync: limpa e reinsere
      await supabase.from("materiais_assistencia").delete().eq("assistencia_id", assist.id);
      await supabase.from("materiais_assistencia").insert(
        materiais.map((m) => ({ assistencia_id: assist.id, ...m }))
      );
    }
    // Auditoria + notificações
    if (material) {
      await logAssistenciaEvent(assist.id, "material", `Aguardando ${materiais.length} material(is)`, { materiais });
      const admins = await getAdminUserIds();
      await notifyAssistencia({
        assistenciaId: assist.id,
        userIds: admins,
        tipo: "assistencia_material",
        titulo: "Chamado aguardando material",
        mensagem: `${assist.codigo || ""} - ${assist.cliente?.nome || ""}`,
      });
    } else {
      const tecNome = profiles.find((p) => p.user_id === tecnicoId)?.nome_completo || "técnico";
      await logAssistenciaEvent(assist.id, "agendamento", `Atribuído a ${tecNome} em ${data}${hora ? " " + hora : ""}`, {
        tecnico_id: tecnicoId,
        data,
        hora,
      });
      const admins = await getAdminUserIds();
      await notifyAssistencia({
        assistenciaId: assist.id,
        userIds: [tecnicoId, ...admins],
        tipo: "assistencia_agendada",
        titulo: "Chamado agendado",
        mensagem: `${assist.codigo || ""} - ${data}${hora ? " " + hora : ""}`,
      });
    }
    setLoading(false);
    toast.success(material ? "Material registrado!" : "Técnico atribuído!");
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#dcfce7] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-[#16a34a]" />
            </div>
            <div>
              <DialogTitle className="text-[20px]">Atribuição do Chamado</DialogTitle>
              <p className="text-[12px] text-muted-foreground">
                Chamado: #{assist.pedido?.codigo || assist.codigo} - {assist.cliente?.nome}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Material necessário */}
          <div className="rounded-xl border border-border p-4 bg-[#f8fafc]">
            <Label className="text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 mb-2">
              <Package className="w-3.5 h-3.5 text-[#5b5bf5]" />
              Material Necessário
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMaterial(false)}
                className={`py-3 rounded-lg text-[13px] font-semibold transition border-2`}
                style={{
                  background: !material ? "#5b5bf5" : "#ffffff",
                  color: !material ? "#ffffff" : "#94a3b8",
                  borderColor: !material ? "#5b5bf5" : "hsl(var(--border))",
                }}
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => setMaterial(true)}
                className={`py-3 rounded-lg text-[13px] font-semibold transition border-2`}
                style={{
                  background: material ? "#5b5bf5" : "#ffffff",
                  color: material ? "#ffffff" : "#94a3b8",
                  borderColor: material ? "#5b5bf5" : "hsl(var(--border))",
                }}
              >
                Sim
              </button>
            </div>
          </div>

          {/* Materiais (quando precisa) */}
          {material && (
            <div className="rounded-xl border border-border p-4 bg-[#f8fafc] space-y-3">
              <Label className="text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                Adicionar Material
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {(["deposito", "compra", "fabrica"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOrigem(o)}
                    className="py-2 rounded-lg text-[12px] font-semibold border-2 capitalize"
                    style={{
                      background: origem === o ? "#dcfce7" : "#fff",
                      color: origem === o ? "#15803d" : "#64748b",
                      borderColor: origem === o ? "#16a34a" : "hsl(var(--border))",
                    }}
                  >
                    {o === "deposito" ? "Depósito" : o === "compra" ? "Compra" : "Fábrica"}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Ex: Polia 100mm, Corrente 420..."
                value={matDesc}
                onChange={(e) => setMatDesc(e.target.value)}
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={matQtd}
                  onChange={(e) => setMatQtd(parseInt(e.target.value) || 1)}
                  className="w-32"
                  placeholder="Qtd"
                />
                <Button onClick={addMaterial} className="bg-[#5b5bf5] hover:bg-[#4a4ae0]">
                  Adicionar
                </Button>
              </div>
              {materiais.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  {materiais.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-[12px] bg-white rounded-md px-3 py-2 border border-border">
                      <div>
                        <span className="font-semibold">{m.descricao}</span>
                        <span className="text-muted-foreground ml-2">x{m.quantidade} • {m.origem}</span>
                      </div>
                      <button onClick={() => removeMaterial(i)} className="text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[11px] text-amber-700 bg-amber-50 rounded-md p-2 border border-amber-200">
                O agendamento será disponibilizado quando o material estiver disponível.
              </div>
            </div>
          )}

          {/* Técnico + Data + Hora */}
          {!material && (
            <div className="rounded-xl border border-border p-4 bg-[#f8fafc] space-y-3">
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  Técnico Responsável
                </Label>
                <Select value={tecnicoId || undefined} onValueChange={setTecnicoId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o técnico..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.nome_completo || p.user_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#5b5bf5]" />
                    Data do Agendamento
                  </Label>
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Hora
                  </Label>
                  <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="mt-1.5" />
                </div>
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              Observações Adicionais
            </Label>
            <Textarea
              rows={3}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Informações importantes para o técnico..."
              className="mt-1.5"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading} className="bg-[#16a34a] hover:bg-[#15803d]">
            {loading ? "Salvando…" : material ? "Confirmar Material" : "Atribuir Técnico"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Dialog: Histórico Auditável ---------------- */
const EVENT_LABEL_MAP: Record<string, string> = {
  criacao: "Chamado criado",
  material: "Material requisitado",
  material_disponivel: "Material disponível",
  agendamento: "Agendamento",
  checkin: "Check-in realizado",
  checklist: "Checklist atualizado",
  foto: "Foto adicionada",
  anexo: "Anexo adicionado",
  assinatura: "Assinatura coletada",
  enviado_conferencia: "Enviado para conferência",
  conferencia_aprovada: "Conferência aprovada",
  conferencia_reprovada: "Conferência reprovada",
  conclusao: "Chamado concluído",
  retorno_triagem: "Retornou à triagem",
  status_change: "Status alterado",
  tecnico_change: "Técnico alterado",
  prioridade_change: "Prioridade alterada",
  arquivamento: "Arquivado",
  desarquivamento: "Desarquivado",
};

function HistoricoDialog({ assist, onClose }: { assist: Assistencia; onClose: () => void }) {
  const [events, setEvents] = useState<any[]>([]);
  const [profMap, setProfMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("timeline_eventos")
        .select("*")
        .eq("entidade_tipo", "assistencia")
        .eq("entidade_id", assist.id)
        .order("created_at", { ascending: false });
      const evs = data || [];
      setEvents(evs);
      const ids = Array.from(new Set(evs.map((e: any) => e.usuario_id).filter(Boolean)));
      if (ids.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("user_id, nome_completo")
          .in("user_id", ids);
        const m: Record<string, string> = {};
        (ps || []).forEach((p: any) => (m[p.user_id] = p.nome_completo));
        setProfMap(m);
      }
      setLoading(false);
    })();
  }, [assist.id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <History className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-[18px]">Histórico Auditável</DialogTitle>
              <p className="text-[12px] text-muted-foreground">
                {assist.codigo} — {assist.cliente?.nome}
              </p>
            </div>
          </div>
        </DialogHeader>
        {loading ? (
          <div className="py-10 text-center text-[12px] text-muted-foreground">Carregando…</div>
        ) : events.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-muted-foreground">
            Nenhum evento registrado.
          </div>
        ) : (
          <div className="relative pl-6 border-l-2 border-border space-y-4 mt-2">
            {events.map((ev) => (
              <div key={ev.id} className="relative">
                <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-[#5b5bf5] border-2 border-white" />
                <div className="text-[11px] text-muted-foreground">
                  {new Date(ev.created_at).toLocaleString("pt-BR")} •{" "}
                  {profMap[ev.usuario_id || ""] || "Sistema"}
                </div>
                <div className="text-[13px] font-semibold">
                  {EVENT_LABEL_MAP[ev.tipo] || ev.tipo}
                </div>
                {ev.descricao && (
                  <div className="text-[12px] text-foreground mt-0.5">{ev.descricao}</div>
                )}
              </div>
            ))}
          </div>
        )}
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Dialog: Conferência (admin) ---------------- */
function ConferenciaDialog({
  assist, onClose, onSaved,
}: { assist: Assistencia; onClose: () => void; onSaved: () => void }) {
  const [motivoReprovacao, setMotivoReprovacao] = useState("");
  const [loading, setLoading] = useState(false);

  const aprovar = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("assistencias")
      .update({
        status: "concluida",
        concluida_em: new Date().toISOString(),
        arquivada: true,
        motivo_nao_conclusao: null,
      })
      .eq("id", assist.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    await logAssistenciaEvent(assist.id, "conferencia_aprovada", "Conferência aprovada e chamado arquivado");
    await logAssistenciaEvent(assist.id, "conclusao", "Chamado concluído com sucesso");
    if (assist.tecnico_id) {
      await notifyAssistencia({
        assistenciaId: assist.id,
        userIds: [assist.tecnico_id],
        tipo: "assistencia_aprovada",
        titulo: "Conferência aprovada",
        mensagem: `${assist.codigo} foi aprovado e concluído`,
      });
    }
    toast.success("Chamado aprovado e arquivado!");
    onSaved();
    onClose();
  };

  const reprovar = async () => {
    if (!motivoReprovacao.trim()) return toast.error("Informe o motivo da reprovação");
    setLoading(true);
    const { error } = await supabase
      .from("assistencias")
      .update({ status: "em_atendimento" })
      .eq("id", assist.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    await logAssistenciaEvent(
      assist.id,
      "conferencia_reprovada",
      `Reprovado pelo admin: ${motivoReprovacao.trim()}`
    );
    if (assist.tecnico_id) {
      await notifyAssistencia({
        assistenciaId: assist.id,
        userIds: [assist.tecnico_id],
        tipo: "assistencia_reprovada",
        titulo: "Conferência reprovada",
        mensagem: motivoReprovacao.trim(),
      });
    }
    toast.success("Chamado retornado ao técnico");
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <DialogTitle className="text-[18px]">Conferência do Chamado</DialogTitle>
              <p className="text-[12px] text-muted-foreground">
                {assist.codigo} — {assist.cliente?.nome}
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <p className="text-[13px] text-muted-foreground">
            Revise as fotos, checklist e assinatura no detalhe do chamado antes de aprovar.
            Aprovar finaliza e arquiva o chamado. Reprovar devolve o serviço ao técnico para correção.
          </p>
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-red-600">
              Motivo da reprovação (obrigatório se reprovar)
            </Label>
            <Textarea
              rows={3}
              value={motivoReprovacao}
              onChange={(e) => setMotivoReprovacao(e.target.value)}
              placeholder="Ex: Foto depois fora de foco; falta apertar parafuso X..."
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter className="grid grid-cols-2 gap-2 mt-4">
          <Button
            onClick={reprovar}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            <ThumbsDown className="w-4 h-4 mr-2" />
            Reprovar
          </Button>
          <Button
            onClick={aprovar}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <ThumbsUp className="w-4 h-4 mr-2" />
            Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
