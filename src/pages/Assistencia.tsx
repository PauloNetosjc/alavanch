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
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";

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
  cliente: { nome: string } | null;
  pedido: { codigo: string } | null;
  tecnico?: { nome_completo: string } | null;
};

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

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("assistencias")
      .select(
        "id, codigo, tipo, prioridade, status, descricao, data_agendamento, hora_agendamento, observacoes, material_necessario, tecnico_id, created_at, cliente:clientes(nome), pedido:pedidos(codigo)"
      )
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
                      items.map((a) => <ChamadoCard key={a.id} a={a} onAtribuir={() => setOpenAtribuir(a)} onChange={load} />)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <NovaAssistenciaDialog open={openNova} onClose={() => setOpenNova(false)} onCreated={load} />
      {openAtribuir && (
        <AtribuirDialog
          assist={openAtribuir}
          profiles={profiles}
          onClose={() => setOpenAtribuir(null)}
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
  a, onAtribuir, onChange,
}: { a: Assistencia; onAtribuir: () => void; onChange: () => void }) {
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
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
        <button
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
      </div>
    </div>
  );
}

/* ---------------- Dialog: Nova Assistência ---------------- */
function NovaAssistenciaDialog({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [pedidos, setPedidos] = useState<{ id: string; codigo: string; cliente_id: string; cliente: { nome: string } | null }[]>([]);
  const [pedidoId, setPedidoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("media");
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
                  className={`py-2.5 rounded-lg text-[12px] font-semibold transition border-2`}
                  style={{
                    background: prioridade === k ? v.bg : "#f8fafc",
                    color: prioridade === k ? v.fg : "#94a3b8",
                    borderColor: prioridade === k ? v.fg : "transparent",
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
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
function AtribuirDialog({
  assist, profiles, onClose, onSaved,
}: { assist: Assistencia; profiles: Profile[]; onClose: () => void; onSaved: () => void }) {
  const [material, setMaterial] = useState<boolean>(!!assist.material_necessario);
  const [tecnicoId, setTecnicoId] = useState(assist.tecnico_id || "");
  const [data, setData] = useState(assist.data_agendamento || "");
  const [hora, setHora] = useState(assist.hora_agendamento?.slice(0, 5) || "");
  const [obs, setObs] = useState(assist.observacoes || "");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!tecnicoId) return toast.error("Selecione o técnico");
    if (!data) return toast.error("Defina a data");
    setLoading(true);
    // Define o status: se precisa material → aguardando_material; senão → agendada
    const newStatus = material ? "aguardando_material" : "agendada";
    const { error } = await supabase
      .from("assistencias")
      .update({
        material_necessario: material,
        tecnico_id: tecnicoId,
        data_agendamento: data,
        hora_agendamento: hora || null,
        observacoes: obs,
        status: newStatus,
      })
      .eq("id", assist.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Técnico atribuído!");
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

          {/* Técnico + Data + Hora */}
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
            {loading ? "Salvando…" : "Atribuir Técnico"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
