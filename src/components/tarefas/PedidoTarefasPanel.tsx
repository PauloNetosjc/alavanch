import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Play, Check, RotateCcw, X, MessageSquare, Paperclip, History, Plus, ListChecks, Wand2, AlertTriangle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

/* ============================================================
 * Fase 3 — Painel de Tarefas Nativas dentro do Pedido
 * Tabela: public.tarefas_pedido + public.eventos_tarefa
 * Bucket: tarefas-anexos
 * ============================================================ */

type Tarefa = {
  id: string;
  pedido_id: string;
  modelo_id: string | null;
  titulo: string;
  descricao: string | null;
  setor: string | null;
  cargo_id: string | null;
  responsavel_id: string | null;
  status: "pendente" | "em_andamento" | "aguardando_aprovacao" | "concluida" | "cancelada" | "bloqueada";
  origem: "automatica" | "manual" | "dependencia";
  prazo: string | null;
  pre_alerta_em: string | null;
  prioridade: "baixa" | "media" | "alta" | "critica";
  exige_anexo: boolean;
  exige_aprovacao: boolean;
  bloqueio_proxima: boolean;
  concluido_em: string | null;
  concluido_por: string | null;
  observacao_conclusao: string | null;
  created_at: string;
  rh_cargos?: { nome: string } | null;
  profiles?: { nome_completo: string | null } | null;
};

type Evento = {
  id: string;
  tarefa_id: string;
  tipo: string;
  usuario_id: string | null;
  payload: any;
  anexo_url: string | null;
  created_at: string;
};

const GATILHOS_TESTE = [
  "pedido_criado", "contrato_criado", "pedido_assinado",
  "pdf_projeto_final_assinado", "revisao_projeto_concluida",
  "implantacao_fabrica_concluida", "projeto_final_concluido",
  "medicao_tecnica_agendada", "medicao_tecnica_concluida",
  "revisao_final_agendada", "revisao_final_concluida",
  "entrega_agendada", "montagem_agendada", "vistoria_agendada",
  "vistoria_concluida", "assistencia_pedido_peca", "assistencia_agendada",
];

const STATUS_BADGE: Record<Tarefa["status"], string> = {
  pendente: "bg-slate-100 text-slate-700",
  em_andamento: "bg-blue-100 text-blue-700",
  aguardando_aprovacao: "bg-amber-100 text-amber-700",
  concluida: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-zinc-200 text-zinc-600 line-through",
  bloqueada: "bg-orange-100 text-orange-700",
};
const STATUS_LABEL: Record<Tarefa["status"], string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  aguardando_aprovacao: "Aguardando aprovação",
  concluida: "Concluída",
  cancelada: "Cancelada",
  bloqueada: "Bloqueada",
};
const PRIO_BADGE: Record<Tarefa["prioridade"], string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-blue-50 text-blue-700",
  alta: "bg-amber-50 text-amber-700",
  critica: "bg-red-50 text-red-700",
};

function isAtrasada(t: Tarefa): boolean {
  if (!t.prazo) return false;
  if (t.status === "concluida" || t.status === "cancelada") return false;
  return new Date(t.prazo).getTime() < Date.now();
}
function isPreAlerta(t: Tarefa): boolean {
  if (!t.pre_alerta_em) return false;
  if (t.status === "concluida" || t.status === "cancelada") return false;
  const now = Date.now();
  return new Date(t.pre_alerta_em).getTime() <= now && (!t.prazo || new Date(t.prazo).getTime() >= now);
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function PedidoTarefasPanel({
  pedidoId, clienteId, lojaId,
}: { pedidoId: string; clienteId?: string | null; lojaId?: string | null }) {
  const { user } = useAuth();
  const { can, isAdmin, role } = usePermissions();

  const podeVer = isAdmin || can("tarefas_pedido", "visualizar") || can("tarefas_pedido", "editar");
  const podeCriar = isAdmin || can("tarefas_pedido", "criar") || can("tarefas_pedido", "editar");
  const podeEditar = isAdmin || can("tarefas_pedido", "editar");
  const podeConcluirGeral = isAdmin || can("tarefas_pedido", "concluir") || can("tarefas_pedido", "editar");
  const podeAdministrar = isAdmin || role === "diretor" || role === "gerente" || can("tarefas_pedido_admin", "administrar" as any);

  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [cargos, setCargos] = useState<{ id: string; nome: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; nome_completo: string | null; user_id: string }[]>([]);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  // filtros
  const [filtro, setFiltro] = useState<"todas" | "pendentes" | "andamento" | "atrasadas" | "concluidas">("todas");
  const [fSetor, setFSetor] = useState("");
  const [fResp, setFResp] = useState("");

  // dialogs
  const [taSelecionada, setTaSelecionada] = useState<Tarefa | null>(null);
  const [openConcluir, setOpenConcluir] = useState(false);
  const [openReabrir, setOpenReabrir] = useState(false);
  const [openComentar, setOpenComentar] = useState(false);
  const [openAnexo, setOpenAnexo] = useState(false);
  const [openHistorico, setOpenHistorico] = useState(false);
  const [openManual, setOpenManual] = useState(false);
  const [openGerar, setOpenGerar] = useState(false);

  async function load() {
    setLoading(true);
    const [t, c, p, me] = await Promise.all([
      (supabase as any).from("tarefas_pedido")
        .select("*, rh_cargos(nome), profiles(nome_completo)")
        .eq("pedido_id", pedidoId)
        .order("prazo", { ascending: true, nullsFirst: false }),
      supabase.from("rh_cargos").select("id,nome").order("nome"),
      supabase.from("profiles").select("id,nome_completo,user_id").eq("ativo", true).order("nome_completo"),
      user ? supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (t.error) toast.error("Erro ao carregar tarefas: " + t.error.message);
    setTarefas((t.data || []) as Tarefa[]);
    setCargos((c.data as any) || []);
    setProfiles((p.data as any) || []);
    setMyProfileId(((me as any).data?.id) || null);
    setLoading(false);
  }

  useEffect(() => {
    if (podeVer && pedidoId) load();
    /* eslint-disable-next-line */
  }, [pedidoId, podeVer]);

  const filtradas = useMemo(() => {
    return tarefas.filter((t) => {
      if (filtro === "pendentes" && t.status !== "pendente" && t.status !== "bloqueada") return false;
      if (filtro === "andamento" && t.status !== "em_andamento") return false;
      if (filtro === "concluidas" && t.status !== "concluida") return false;
      if (filtro === "atrasadas" && !isAtrasada(t)) return false;
      if (fSetor && (t.setor || "") !== fSetor) return false;
      if (fResp && (t.responsavel_id || "") !== fResp) return false;
      return true;
    });
  }, [tarefas, filtro, fSetor, fResp]);

  const counts = useMemo(() => ({
    todas: tarefas.length,
    pendentes: tarefas.filter((x) => x.status === "pendente" || x.status === "bloqueada").length,
    andamento: tarefas.filter((x) => x.status === "em_andamento").length,
    atrasadas: tarefas.filter(isAtrasada).length,
    concluidas: tarefas.filter((x) => x.status === "concluida").length,
  }), [tarefas]);

  function podeOperar(t: Tarefa): boolean {
    if (podeEditar) return true;
    if (t.responsavel_id && t.responsavel_id === myProfileId) return true;
    return false;
  }

  async function logEvento(tarefa_id: string, tipo: string, payload: any = {}, anexo_url: string | null = null) {
    await (supabase as any).from("eventos_tarefa").insert({
      tarefa_id, tipo, usuario_id: user?.id || null, payload, anexo_url,
    });
  }

  async function iniciar(t: Tarefa) {
    if (!podeOperar(t)) return toast.error("Sem permissão para iniciar esta tarefa.");
    const { error } = await (supabase as any).from("tarefas_pedido")
      .update({ status: "em_andamento" }).eq("id", t.id);
    if (error) return toast.error(error.message);
    await logEvento(t.id, "status", { de: t.status, para: "em_andamento" });
    toast.success("Tarefa iniciada.");
    load();
  }

  async function cancelar(t: Tarefa) {
    if (!podeEditar) return toast.error("Sem permissão.");
    const motivo = prompt("Motivo do cancelamento (opcional):") || "";
    const { error } = await (supabase as any).from("tarefas_pedido")
      .update({ status: "cancelada" }).eq("id", t.id);
    if (error) return toast.error(error.message);
    await logEvento(t.id, "status", { de: t.status, para: "cancelada", motivo });
    toast.success("Tarefa cancelada.");
    load();
  }

  return (
    <section className="rounded-xl border bg-card p-4 md:p-6 space-y-4">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><ListChecks className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="font-playfair text-[22px] font-semibold leading-tight">Tarefas do Pedido</h2>
            <p className="text-[12px] text-muted-foreground">Tarefas operacionais geradas automaticamente para este pedido.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeAdministrar && (
            <Button size="sm" variant="outline" onClick={() => setOpenGerar(true)}>
              <Wand2 className="h-4 w-4 mr-1" /> Gerar tarefas nativas
            </Button>
          )}
          {podeCriar && (
            <Button size="sm" onClick={() => setOpenManual(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova tarefa
            </Button>
          )}
        </div>
      </header>

      {!podeVer ? (
        <div className="text-[12px] text-muted-foreground py-6 text-center">
          Você não tem permissão para visualizar tarefas do pedido.
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            {([
              ["todas", "Todas"], ["pendentes", "Pendentes"], ["andamento", "Em andamento"],
              ["atrasadas", "Atrasadas"], ["concluidas", "Concluídas"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFiltro(k)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition ${filtro === k ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
              >
                {label} <span className="opacity-70">({(counts as any)[k]})</span>
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              <Select value={fSetor || "_"} onValueChange={(v) => setFSetor(v === "_" ? "" : v)}>
                <SelectTrigger className="h-8 text-[11px] min-w-[140px]"><SelectValue placeholder="Setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Todos os setores</SelectItem>
                  {Array.from(new Set(tarefas.map((t) => t.setor).filter(Boolean) as string[])).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fResp || "_"} onValueChange={(v) => setFResp(v === "_" ? "" : v)}>
                <SelectTrigger className="h-8 text-[11px] min-w-[160px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="_">Todos</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome_completo || p.id.slice(0, 8)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="text-center py-10 text-[12px] text-muted-foreground">Carregando…</div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-10 text-[12px] text-muted-foreground border border-dashed rounded-lg">
              Nenhuma tarefa encontrada para este pedido.
            </div>
          ) : (
            <div className="space-y-2">
              {filtradas.map((t) => {
                const atrasada = isAtrasada(t);
                const preAlerta = isPreAlerta(t);
                return (
                  <div
                    key={t.id}
                    className={`rounded-lg border p-3 ${atrasada ? "border-red-300 bg-red-50/40" : preAlerta ? "border-amber-300 bg-amber-50/40" : "bg-background"}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium">{t.titulo}</span>
                          <Badge variant="secondary" className={STATUS_BADGE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                          <Badge variant="secondary" className={PRIO_BADGE[t.prioridade]}>{t.prioridade}</Badge>
                          {atrasada && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="h-3 w-3" /> Atrasada
                            </span>
                          )}
                          {!atrasada && preAlerta && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                              <Clock className="h-3 w-3" /> Pré-alerta
                            </span>
                          )}
                          {t.origem === "manual" && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">manual</span>}
                          {t.bloqueio_proxima && <span className="text-[10px] text-orange-700">bloqueia próxima</span>}
                          {t.exige_anexo && <span className="text-[10px] text-muted-foreground">exige anexo</span>}
                        </div>
                        {t.descricao && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{t.descricao}</p>}
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground mt-1.5">
                          {t.setor && <span>Setor: <b className="text-foreground">{t.setor}</b></span>}
                          {t.rh_cargos?.nome && <span>Cargo: <b className="text-foreground">{t.rh_cargos.nome}</b></span>}
                          <span>Responsável: <b className="text-foreground">{t.profiles?.nome_completo || "—"}</b></span>
                          <span>Prazo: <b className={atrasada ? "text-red-700" : "text-foreground"}>{fmtDate(t.prazo)}</b></span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {t.status !== "concluida" && t.status !== "cancelada" && t.status !== "em_andamento" && podeOperar(t) && (
                          <Button size="sm" variant="outline" onClick={() => iniciar(t)}><Play className="h-3.5 w-3.5 mr-1" />Iniciar</Button>
                        )}
                        {t.status !== "concluida" && t.status !== "cancelada" && podeOperar(t) && (
                          <Button size="sm" onClick={() => { setTaSelecionada(t); setOpenConcluir(true); }}>
                            <Check className="h-3.5 w-3.5 mr-1" />Concluir
                          </Button>
                        )}
                        {t.status === "concluida" && podeEditar && (
                          <Button size="sm" variant="outline" onClick={() => { setTaSelecionada(t); setOpenReabrir(true); }}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />Reabrir
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Comentar" onClick={() => { setTaSelecionada(t); setOpenComentar(true); }}>
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Anexar" onClick={() => { setTaSelecionada(t); setOpenAnexo(true); }}>
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Histórico" onClick={() => { setTaSelecionada(t); setOpenHistorico(true); }}>
                          <History className="h-4 w-4" />
                        </Button>
                        {t.status !== "cancelada" && t.status !== "concluida" && podeEditar && (
                          <Button size="icon" variant="ghost" title="Cancelar" onClick={() => cancelar(t)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* DIALOGS */}
      <ConcluirDialog open={openConcluir} setOpen={setOpenConcluir} tarefa={taSelecionada} onDone={load} userId={user?.id || null} />
      <ReabrirDialog open={openReabrir} setOpen={setOpenReabrir} tarefa={taSelecionada} onDone={load} userId={user?.id || null} />
      <ComentarDialog open={openComentar} setOpen={setOpenComentar} tarefa={taSelecionada} onDone={load} userId={user?.id || null} />
      <AnexoDialog open={openAnexo} setOpen={setOpenAnexo} tarefa={taSelecionada} onDone={load} userId={user?.id || null} />
      <HistoricoDialog open={openHistorico} setOpen={setOpenHistorico} tarefa={taSelecionada} profiles={profiles} />
      <NovaManualDialog
        open={openManual} setOpen={setOpenManual} onDone={load}
        pedidoId={pedidoId} clienteId={clienteId || null} lojaId={lojaId || null}
        cargos={cargos} profiles={profiles} userId={user?.id || null}
      />
      <GerarTarefasDialog open={openGerar} setOpen={setOpenGerar} pedidoId={pedidoId} onDone={load} />
    </section>
  );
}

/* ============================================================
 * DIALOGS
 * ============================================================ */

export function ConcluirDialog({
  open, setOpen, tarefa, onDone, userId,
}: { open: boolean; setOpen: (b: boolean) => void; tarefa: Tarefa | null; onDone: () => void; userId: string | null }) {
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setObs(""); setFile(null); } }, [open]);

  async function confirmar() {
    if (!tarefa) return;
    if (tarefa.exige_anexo && !file) return toast.error("Esta tarefa exige anexo para concluir.");
    setSaving(true);
    let anexoPath: string | null = null;
    if (file) {
      const key = `${tarefa.pedido_id}/${tarefa.id}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("tarefas-anexos").upload(key, file);
      if (up.error) { setSaving(false); return toast.error("Falha ao anexar: " + up.error.message); }
      anexoPath = up.data?.path || key;
    }
    const { error } = await (supabase as any).from("tarefas_pedido").update({
      status: "concluida",
      concluido_em: new Date().toISOString(),
      concluido_por: userId,
      observacao_conclusao: obs || null,
    }).eq("id", tarefa.id);
    if (error) { setSaving(false); return toast.error(error.message); }
    await (supabase as any).from("eventos_tarefa").insert([
      { tarefa_id: tarefa.id, tipo: "status", usuario_id: userId, payload: { de: tarefa.status, para: "concluida", observacao: obs } },
      ...(anexoPath ? [{ tarefa_id: tarefa.id, tipo: "anexo", usuario_id: userId, anexo_url: anexoPath, payload: { nome: file?.name, tipo: file?.type, tamanho: file?.size } }] : []),
    ]);
    toast.success("Tarefa concluída.");
    setSaving(false); setOpen(false); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Concluir tarefa</DialogTitle>
          <DialogDescription>{tarefa?.titulo}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[11px]">Observação de conclusão</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Descreva como foi concluída…" />
          </div>
          <div>
            <Label className="text-[11px]">
              Anexo {tarefa?.exige_anexo && <span className="text-red-600">*obrigatório</span>}
            </Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={saving}>{saving ? "Salvando…" : "Confirmar conclusão"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReabrirDialog({
  open, setOpen, tarefa, onDone, userId,
}: { open: boolean; setOpen: (b: boolean) => void; tarefa: Tarefa | null; onDone: () => void; userId: string | null }) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setMotivo(""); }, [open]);

  async function confirmar() {
    if (!tarefa) return;
    if (!motivo.trim()) return toast.error("Informe o motivo da reabertura.");
    setSaving(true);
    const { error } = await (supabase as any).from("tarefas_pedido").update({
      status: "pendente",
      concluido_em: null, concluido_por: null,
    }).eq("id", tarefa.id);
    if (error) { setSaving(false); return toast.error(error.message); }
    await (supabase as any).from("eventos_tarefa").insert({
      tarefa_id: tarefa.id, tipo: "status", usuario_id: userId,
      payload: { de: tarefa.status, para: "pendente", motivo, reaberta: true },
    });
    toast.success("Tarefa reaberta.");
    setSaving(false); setOpen(false); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reabrir tarefa</DialogTitle>
          <DialogDescription>{tarefa?.titulo}</DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-[11px]">Motivo *</Label>
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={saving}>{saving ? "Reabrindo…" : "Reabrir"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComentarDialog({
  open, setOpen, tarefa, onDone, userId,
}: { open: boolean; setOpen: (b: boolean) => void; tarefa: Tarefa | null; onDone: () => void; userId: string | null }) {
  const [txt, setTxt] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setTxt(""); }, [open]);

  async function enviar() {
    if (!tarefa || !txt.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).from("eventos_tarefa").insert({
      tarefa_id: tarefa.id, tipo: "comentario", usuario_id: userId, payload: { comentario: txt.trim() },
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Comentário adicionado.");
    setOpen(false); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Comentar</DialogTitle>
          <DialogDescription>{tarefa?.titulo}</DialogDescription>
        </DialogHeader>
        <Textarea rows={4} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Escreva um comentário…" />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={enviar} disabled={saving || !txt.trim()}>Enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnexoDialog({
  open, setOpen, tarefa, onDone, userId,
}: { open: boolean; setOpen: (b: boolean) => void; tarefa: Tarefa | null; onDone: () => void; userId: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setFile(null); }, [open]);

  async function enviar() {
    if (!tarefa || !file) return;
    setSaving(true);
    const key = `${tarefa.pedido_id}/${tarefa.id}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("tarefas-anexos").upload(key, file);
    if (up.error) { setSaving(false); return toast.error(up.error.message); }
    await (supabase as any).from("eventos_tarefa").insert({
      tarefa_id: tarefa.id, tipo: "anexo", usuario_id: userId,
      anexo_url: up.data?.path || key,
      payload: { nome: file.name, tipo: file.type, tamanho: file.size },
    });
    setSaving(false);
    toast.success("Anexo enviado.");
    setOpen(false); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anexar arquivo</DialogTitle>
          <DialogDescription>{tarefa?.titulo}</DialogDescription>
        </DialogHeader>
        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={enviar} disabled={saving || !file}>Enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoricoDialog({
  open, setOpen, tarefa, profiles,
}: { open: boolean; setOpen: (b: boolean) => void; tarefa: Tarefa | null; profiles: any[] }) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !tarefa) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).from("eventos_tarefa")
        .select("*").eq("tarefa_id", tarefa.id).order("created_at", { ascending: true });
      setEventos((data as any) || []);
      setLoading(false);
    })();
  }, [open, tarefa]);

  function userLabel(uid: string | null) {
    if (!uid) return "Sistema";
    const p = profiles.find((x) => x.user_id === uid);
    return p?.nome_completo || uid.slice(0, 8);
  }
  function eventoLabel(e: Evento) {
    switch (e.tipo) {
      case "criada": return "Tarefa criada";
      case "status": return `Status: ${e.payload?.de || "?"} → ${e.payload?.para || "?"}${e.payload?.motivo ? ` (${e.payload.motivo})` : ""}`;
      case "comentario": return `💬 ${e.payload?.comentario || ""}`;
      case "anexo": return `📎 ${e.payload?.nome || "anexo"}`;
      case "atribuida": return "Atribuída";
      case "aprovada": return "Aprovada";
      case "reprovada": return "Reprovada";
      default: return e.tipo;
    }
  }
  async function abrirAnexo(path: string) {
    const { data } = await supabase.storage.from("tarefas-anexos").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico da tarefa</DialogTitle>
          <DialogDescription>{tarefa?.titulo}</DialogDescription>
        </DialogHeader>
        {loading ? <div className="text-[12px] text-muted-foreground py-6 text-center">Carregando…</div> :
         eventos.length === 0 ? <div className="text-[12px] text-muted-foreground py-6 text-center">Nenhum evento registrado.</div> :
         (
          <ol className="space-y-2 border-l-2 border-muted pl-4">
            {eventos.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[22px] top-1 h-3 w-3 rounded-full bg-primary" />
                <div className="text-[12px]">{eventoLabel(e)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {userLabel(e.usuario_id)} · {fmtDate(e.created_at)}
                  {e.anexo_url && (
                    <button onClick={() => abrirAnexo(e.anexo_url!)} className="ml-2 text-primary underline">abrir anexo</button>
                  )}
                </div>
              </li>
            ))}
          </ol>
         )}
        <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaManualDialog({
  open, setOpen, onDone, pedidoId, clienteId, lojaId, cargos, profiles, userId,
}: {
  open: boolean; setOpen: (b: boolean) => void; onDone: () => void;
  pedidoId: string; clienteId: string | null; lojaId: string | null;
  cargos: { id: string; nome: string }[]; profiles: { id: string; nome_completo: string | null }[]; userId: string | null;
}) {
  const EMPTY = {
    titulo: "", descricao: "", setor: "", cargo_id: null as string | null,
    responsavel_id: null as string | null, prazo: "", prioridade: "media" as Tarefa["prioridade"],
  };
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setF(EMPTY); /* eslint-disable-next-line */ }, [open]);

  async function salvar() {
    if (!f.titulo.trim()) return toast.error("Informe o título.");
    setSaving(true);
    const payload: any = {
      pedido_id: pedidoId,
      cliente_id: clienteId,
      loja_id: lojaId,
      titulo: f.titulo.trim(),
      descricao: f.descricao || null,
      setor: f.setor || null,
      cargo_id: f.cargo_id,
      responsavel_id: f.responsavel_id,
      prioridade: f.prioridade,
      origem: "manual",
      status: "pendente",
      prazo: f.prazo ? new Date(f.prazo).toISOString() : null,
      criado_por: userId,
    };
    const { data, error } = await (supabase as any).from("tarefas_pedido").insert(payload).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    await (supabase as any).from("eventos_tarefa").insert({
      tarefa_id: data.id, tipo: "criada", usuario_id: userId, payload: { origem: "manual" },
    });
    toast.success("Tarefa manual criada.");
    setOpen(false); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>Crie uma tarefa avulsa vinculada a este pedido.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label className="text-[11px]">Título *</Label>
            <Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[11px]">Descrição</Label>
            <Textarea rows={2} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
          </div>
          <div>
            <Label className="text-[11px]">Setor</Label>
            <Input value={f.setor} onChange={(e) => setF({ ...f, setor: e.target.value })} placeholder="Ex.: Conferência" />
          </div>
          <div>
            <Label className="text-[11px]">Cargo</Label>
            <Select value={f.cargo_id || "_"} onValueChange={(v) => setF({ ...f, cargo_id: v === "_" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">—</SelectItem>
                {cargos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Responsável</Label>
            <Select value={f.responsavel_id || "_"} onValueChange={(v) => setF({ ...f, responsavel_id: v === "_" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="_">—</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome_completo || p.id.slice(0, 8)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Prazo</Label>
            <Input type="datetime-local" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} />
          </div>
          <div>
            <Label className="text-[11px]">Prioridade</Label>
            <Select value={f.prioridade} onValueChange={(v: any) => setF({ ...f, prioridade: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">baixa</SelectItem>
                <SelectItem value="media">media</SelectItem>
                <SelectItem value="alta">alta</SelectItem>
                <SelectItem value="critica">critica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Criar tarefa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GerarTarefasDialog({
  open, setOpen, pedidoId, onDone,
}: { open: boolean; setOpen: (b: boolean) => void; pedidoId: string; onDone: () => void }) {
  const [gatilho, setGatilho] = useState("pedido_assinado");
  const [running, setRunning] = useState(false);

  async function executar() {
    setRunning(true);
    const { error } = await (supabase as any).rpc("fn_instanciar_tarefas_nativas", {
      p_pedido_id: pedidoId, p_gatilho: gatilho,
    });
    setRunning(false);
    if (error) return toast.error(error.message);
    toast.success("Tarefas instanciadas (a função é idempotente — não duplica).");
    setOpen(false); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar tarefas nativas</DialogTitle>
          <DialogDescription>
            Use esta ação para criar manualmente as tarefas do gatilho selecionado. A função é idempotente —
            executar de novo não cria duplicadas. (Ferramenta de teste até a Fase 4 ligar os gatilhos automáticos.)
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-[11px]">Gatilho</Label>
          <Select value={gatilho} onValueChange={setGatilho}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {GATILHOS_TESTE.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={executar} disabled={running}>{running ? "Gerando…" : "Executar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
