import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ListChecks, Play, Check, ExternalLink, MessageSquare, Paperclip, History,
  AlertTriangle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  ConcluirDialog, ComentarDialog, AnexoDialog, HistoricoDialog,
} from "@/components/tarefas/PedidoTarefasPanel";

/* ============================================================
 * Painel de Tarefas Nativas em Meus Chamados.
 * - Lista tarefas_pedido com exibir_meus_chamados=true
 *   atribuídas ao usuário (ou todas, p/ admin/diretor/gerente).
 * - Reutiliza os Dialogs do PedidoTarefasPanel.
 * ============================================================ */

type TarefaNativa = {
  id: string;
  pedido_id: string;
  modelo_id: string | null;
  titulo: string;
  descricao: string | null;
  setor: string | null;
  cargo_id: string | null;
  responsavel_id: string | null;
  status: "pendente" | "em_andamento" | "aguardando_aprovacao" | "concluida" | "cancelada" | "bloqueada";
  prazo: string | null;
  pre_alerta_em: string | null;
  prioridade: "baixa" | "media" | "alta" | "critica";
  exige_anexo: boolean;
  exige_aprovacao: boolean;
  bloqueio_proxima: boolean;
  concluido_em: string | null;
  concluido_por: string | null;
  observacao_conclusao: string | null;
  origem: "automatica" | "manual" | "dependencia";
  created_at: string;
  pedidos?: { codigo: string | null; cliente_id: string | null; clientes?: { nome: string | null } | null } | null;
  rh_cargos?: { nome: string | null } | null;
  profiles?: { nome_completo: string | null } | null;
  conclui_por_upload_categoria?: string | null;
  tarefas_nativas_modelos?: { nome?: string | null; exibir_meus_chamados: boolean; conclui_por_upload_categoria: string | null } | null;
};

/* Filtros por tarefa nativa (chaves técnicas fixas → nome do modelo no banco).
 * Centralizado para não duplicar regra e evitar regressão. */
export const TASK_FILTERS: ReadonlyArray<{ key: string; label: string; modelo: string }> = [
  { key: "acompanhar_assinatura_contrato",   label: "Acompanhar assinatura do contrato",     modelo: "Acompanhar assinatura do contrato" },
  { key: "enviar_projeto_inicial",           label: "Enviar projeto inicial para o cliente", modelo: "Enviar projeto inicial para o cliente" },
  { key: "subir_arquivo_3d_vendido",         label: "Subir arquivo 3D vendido",              modelo: "Subir arquivo 3D vendido" },
  { key: "fazer_medicao_tecnica",            label: "Fazer medição técnica",                 modelo: "Fazer medição técnica" },
  { key: "preparo_projeto_revisao",          label: "Preparo projeto revisão",               modelo: "Preparo projeto revisão" },
  { key: "revisao_loja",                     label: "Revisão loja",                          modelo: "Revisão loja" },
  { key: "preparo_envio_pdf_projeto_final",  label: "Preparo e envio de PDF Projeto Final",  modelo: "Preparo e envio de PDF Projeto Final" },
];


const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-slate-100 text-slate-700",
  em_andamento: "bg-blue-100 text-blue-700",
  aguardando_aprovacao: "bg-amber-100 text-amber-700",
  concluida: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-zinc-200 text-zinc-600 line-through",
  bloqueada: "bg-orange-100 text-orange-700",
};
const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  aguardando_aprovacao: "Aguardando aprovação",
  concluida: "Concluída",
  cancelada: "Cancelada",
  bloqueada: "Bloqueada",
};
const PRIO_BADGE: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-blue-50 text-blue-700",
  alta: "bg-amber-50 text-amber-700",
  critica: "bg-red-50 text-red-700",
};

function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
function isAtrasada(t: TarefaNativa): boolean {
  if (!t.prazo) return false;
  if (t.status === "concluida" || t.status === "cancelada") return false;
  return new Date(t.prazo).getTime() < Date.now();
}
function isPreAlerta(t: TarefaNativa): boolean {
  if (!t.pre_alerta_em) return false;
  if (t.status === "concluida" || t.status === "cancelada") return false;
  const now = Date.now();
  return new Date(t.pre_alerta_em).getTime() <= now && (!t.prazo || new Date(t.prazo).getTime() >= now);
}
function isHoje(t: TarefaNativa): boolean {
  if (!t.prazo) return false;
  const d = new Date(t.prazo);
  const hoje = new Date();
  return d.toDateString() === hoje.toDateString();
}

type Filtro = "minhas" | "todas" | "atrasadas" | "hoje" | "prealerta";

export function MinhasTarefasNativasPanel() {
  const { user } = useAuth();
  const { isAdmin, role } = usePermissions();
  const navigate = useNavigate();

  const podeVerTodas = isAdmin || role === "diretor" || role === "gerente";

  const [list, setList] = useState<TarefaNativa[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; user_id: string; nome_completo: string | null }[]>([]);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [myCargoId, setMyCargoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("minhas");

  // dialogs
  const [taSel, setTaSel] = useState<TarefaNativa | null>(null);
  const [openConcluir, setOpenConcluir] = useState(false);
  const [openComentar, setOpenComentar] = useState(false);
  const [openAnexo, setOpenAnexo] = useState(false);
  const [openHistorico, setOpenHistorico] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);

    // Identifica perfil e cargo do usuário (cargo via rh_funcionarios)
    const [meProf, meFunc] = await Promise.all([
      supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle(),
      (supabase as any).from("rh_funcionarios").select("cargo_id").eq("user_id", user.id).maybeSingle(),
    ]);
    const profileId = (meProf as any).data?.id || null;
    const cargoId = (meFunc as any).data?.cargo_id || null;
    setMyProfileId(profileId);
    setMyCargoId(cargoId);

    // Busca tarefas visíveis em Meus Chamados (join com modelo)
    let q: any = (supabase as any)
      .from("tarefas_pedido")
      .select(`
        *,
        pedidos(codigo, cliente_id, clientes(nome)),
        rh_cargos(nome),
        profiles(nome_completo),
        tarefas_nativas_modelos!inner(exibir_meus_chamados, conclui_por_upload_categoria)
      `)
      .eq("tarefas_nativas_modelos.exibir_meus_chamados", true)

      .not("status", "in", "(concluida,cancelada)")
      .order("prazo", { ascending: true, nullsFirst: false });

    // Tarefas manuais (modelo_id null) também podem entrar se quisermos,
    // mas o requisito foca em tarefas nativas → mantemos inner join.
    const { data, error } = await q;
    if (error) {
      console.error("[MinhasTarefasNativasPanel] erro", error);
      toast.error("Erro ao carregar tarefas nativas");
      setLoading(false);
      return;
    }

    const rows = ((data || []) as TarefaNativa[]).filter((t) => {
      if (podeVerTodas) return true;
      if (profileId && t.responsavel_id === profileId) return true;
      if (cargoId && t.cargo_id === cargoId && !t.responsavel_id) return true;
      return false;
    });

    setList(rows);

    // Profiles para HistoricoDialog (mapeamento usuario_id → nome)
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, user_id, nome_completo")
      .eq("ativo", true);
    setProfiles(((profs || []) as any[]).map((p) => ({
      id: p.id, user_id: p.user_id, nome_completo: p.nome_completo,
    })));

    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const filtrada = useMemo(() => {
    return list.filter((t) => {
      if (filtro === "minhas") {
        return myProfileId && t.responsavel_id === myProfileId;
      }
      if (filtro === "atrasadas") return isAtrasada(t);
      if (filtro === "hoje") return isHoje(t);
      if (filtro === "prealerta") return isPreAlerta(t) && !isAtrasada(t);
      return true; // todas
    });
  }, [list, filtro, myProfileId]);

  const counts = {
    minhas: list.filter((t) => myProfileId && t.responsavel_id === myProfileId).length,
    todas: list.length,
    atrasadas: list.filter(isAtrasada).length,
    hoje: list.filter(isHoje).length,
    prealerta: list.filter((t) => isPreAlerta(t) && !isAtrasada(t)).length,
  };

  function podeOperar(t: TarefaNativa): boolean {
    if (podeVerTodas) return true;
    return !!myProfileId && t.responsavel_id === myProfileId;
  }

  async function iniciar(t: TarefaNativa) {
    if (!podeOperar(t)) return toast.error("Sem permissão para iniciar esta tarefa.");
    const { error } = await (supabase as any)
      .from("tarefas_pedido")
      .update({ status: "em_andamento" })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    await (supabase as any).from("eventos_tarefa").insert({
      tarefa_id: t.id, tipo: "status", usuario_id: user?.id || null,
      payload: { de: t.status, para: "em_andamento" },
    });
    toast.success("Tarefa iniciada.");
    load();
  }

  return (
    <section className="surface-card p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-primary" />
          <h3 className="font-playfair text-[18px] font-semibold leading-none">
            Tarefas Nativas do Pedido
          </h3>
          <span className="text-[11px] text-muted-foreground">({filtrada.length})</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["minhas", `Minhas (${counts.minhas})`],
            ...(podeVerTodas ? [["todas", `Todas (${counts.todas})`] as const] : []),
            ["hoje", `Hoje (${counts.hoje})`],
            ["atrasadas", `Atrasadas (${counts.atrasadas})`],
            ["prealerta", `Pré-alerta (${counts.prealerta})`],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFiltro(k as Filtro)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                filtro === k ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-[12px] text-muted-foreground py-6 text-center">Carregando…</div>
      ) : filtrada.length === 0 ? (
        <div className="text-[12px] text-muted-foreground py-6 text-center border border-dashed rounded-lg">
          Nenhuma tarefa nativa encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {filtrada.map((t) => {
            const atrasada = isAtrasada(t);
            const preAlerta = isPreAlerta(t);
            return (
              <div
                key={t.id}
                className={`rounded-lg border p-3 ${
                  atrasada ? "border-red-300 bg-red-50/40"
                    : preAlerta ? "border-amber-300 bg-amber-50/40"
                    : "bg-background"
                }`}
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
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground mt-1.5">
                      {t.pedidos?.codigo && (
                        <span>Pedido: <b className="text-foreground">{t.pedidos.codigo}</b></span>
                      )}
                      {t.pedidos?.clientes?.nome && (
                        <span>Cliente: <b className="text-foreground">{t.pedidos.clientes.nome}</b></span>
                      )}
                      {t.setor && <span>Setor: <b className="text-foreground">{t.setor}</b></span>}
                      {t.rh_cargos?.nome && <span>Cargo: <b className="text-foreground">{t.rh_cargos.nome}</b></span>}
                      <span>Responsável: <b className="text-foreground">{t.profiles?.nome_completo || "—"}</b></span>
                      <span>Prazo: <b className={atrasada ? "text-red-700" : "text-foreground"}>{fmtDateTime(t.prazo)}</b></span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end shrink-0">
                    {t.pedido_id && (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/pedidos/${t.pedido_id}`)}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir pedido
                      </Button>
                    )}
                    {t.status !== "em_andamento" && podeOperar(t) && (
                      <Button size="sm" variant="outline" onClick={() => iniciar(t)}>
                        <Play className="h-3.5 w-3.5 mr-1" /> Iniciar
                      </Button>
                    )}
                    {podeOperar(t) && (
                      <Button size="sm" onClick={() => { setTaSel(t); setOpenConcluir(true); }}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Concluir
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" title="Comentar" onClick={() => { setTaSel(t); setOpenComentar(true); }}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Anexar" onClick={() => { setTaSel(t); setOpenAnexo(true); }}>
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Histórico" onClick={() => { setTaSel(t); setOpenHistorico(true); }}>
                      <History className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConcluirDialog
        open={openConcluir} setOpen={setOpenConcluir}
        tarefa={taSel as any} onDone={load} userId={user?.id || null}
      />
      <ComentarDialog
        open={openComentar} setOpen={setOpenComentar}
        tarefa={taSel as any} onDone={load} userId={user?.id || null}
      />
      <AnexoDialog
        open={openAnexo} setOpen={setOpenAnexo}
        tarefa={taSel as any} onDone={load} userId={user?.id || null}
      />
      <HistoricoDialog
        open={openHistorico} setOpen={setOpenHistorico}
        tarefa={taSel as any} profiles={profiles as any}
      />
    </section>
  );
}
