import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AgendaEventoDialog } from "@/components/agenda/AgendaEventoDialog";
import { EventoDetalheDialog } from "@/components/agenda/EventoDetalheDialog";
import { ListChecks, Plus, Clock, AlertTriangle, CheckCircle2, User } from "lucide-react";

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  hora_inicio: string;
  status: string;
  responsavel_id: string;
  pedido_id: string | null;
  responsavel_nome?: string | null;
};

interface Props {
  pedidoId?: string | null;
  /** quando setado, filtra apenas tarefas do usuário (não-admin) */
  scope?: "pedido" | "minhas" | "todas";
  /** modo agrupado por usuário (admin em meus chamados) */
  groupByUser?: boolean;
  /** título customizado */
  title?: string;
  /** Quando informado, filtra/cria eventos vinculados a este PARC. */
  desmembramentoId?: string | null;
}

export function TarefasPanel({ pedidoId = null, scope = "pedido", groupByUser = false, title, desmembramentoId = null }: Props) {
  const { user, role } = useAuth();
  const isAdmin = role === "admin" || role === "diretor";
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(false);
  const [openNova, setOpenNova] = useState(false);
  const [openEv, setOpenEv] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("agenda_eventos" as any)
      .select("id, titulo, descricao, data, hora_inicio, status, responsavel_id, pedido_id")
      .eq("tipo", "tarefa_interna")
      .order("data", { ascending: true });
    if (scope === "pedido" && pedidoId) {
      q = q.eq("pedido_id", pedidoId);
      q = desmembramentoId
        ? (q as any).eq("desmembramento_id", desmembramentoId)
        : (q as any).is("desmembramento_id", null);
    }
    else if (scope === "minhas" && user) q = q.eq("responsavel_id", user.id);
    // scope=todas → admin (RLS já restringe)
    const { data } = await q;
    const rows = (data || []) as any as Tarefa[];
    const ids = Array.from(new Set(rows.map((r) => r.responsavel_id).filter(Boolean)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome_completo")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => (map[p.user_id] = p.nome_completo));
      rows.forEach((r) => (r.responsavel_nome = map[r.responsavel_id] || null));
    }
    setTarefas(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [pedidoId, scope, user?.id, desmembramentoId]);

  const today = new Date().toISOString().slice(0, 10);

  const renderTarefa = (t: Tarefa) => {
    const atrasada = t.status !== "concluido" && t.status !== "cancelado" && t.data < today;
    const concluida = t.status === "concluido";
    const Icon = concluida ? CheckCircle2 : atrasada ? AlertTriangle : Clock;
    const cor = concluida
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : atrasada
      ? "text-red-600 bg-red-50 border-red-200"
      : "text-amber-700 bg-amber-50 border-amber-200";
    return (
      <button
        key={t.id}
        onClick={() => setOpenEv(t.id)}
        className={`w-full text-left rounded-lg border p-3 hover:shadow-sm transition flex items-start gap-3 ${cor}`}
      >
        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[13px] truncate">{t.titulo}</div>
          {t.descricao && (
            <div className="text-[11px] opacity-80 line-clamp-2 mt-0.5">{t.descricao}</div>
          )}
          <div className="text-[11px] mt-1 flex items-center gap-3 opacity-80">
            <span>📅 {new Date(t.data + "T00:00:00").toLocaleDateString("pt-BR")} {t.hora_inicio?.slice(0, 5)}</span>
            {t.responsavel_nome && (
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{t.responsavel_nome}</span>
            )}
            <span className="ml-auto uppercase font-semibold tracking-wide text-[10px]">
              {concluida ? "Concluída" : atrasada ? "Atrasada" : "Em aberto"}
            </span>
          </div>
        </div>
      </button>
    );
  };

  const grupos: Record<string, Tarefa[]> = {};
  if (groupByUser && isAdmin) {
    tarefas.forEach((t) => {
      const k = t.responsavel_nome || "Sem responsável";
      (grupos[k] = grupos[k] || []).push(t);
    });
  }

  return (
    <section className="surface-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-primary" />
          <h3 className="font-playfair text-[18px] font-semibold leading-none">
            {title || "Tarefas"}
          </h3>
          <span className="text-[11px] text-muted-foreground">({tarefas.length})</span>
        </div>
        <Button size="sm" onClick={() => setOpenNova(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nova Tarefa
        </Button>
      </div>

      {loading ? (
        <div className="text-[12px] text-muted-foreground py-6 text-center">Carregando…</div>
      ) : tarefas.length === 0 ? (
        <div className="text-[12px] text-muted-foreground py-6 text-center border border-dashed rounded-lg">
          Nenhuma tarefa cadastrada.
        </div>
      ) : groupByUser && isAdmin ? (
        <div className="space-y-4">
          {Object.entries(grupos).map(([nome, lista]) => (
            <div key={nome}>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                {nome} <span className="opacity-60">({lista.length})</span>
              </div>
              <div className="space-y-2">{lista.map(renderTarefa)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">{tarefas.map(renderTarefa)}</div>
      )}

      <AgendaEventoDialog
        open={openNova}
        onOpenChange={setOpenNova}
        pedidoId={pedidoId || undefined}
        defaultTipo="tarefa_interna"
        desmembramentoId={desmembramentoId}
        onCreated={() => {
          setOpenNova(false);
          load();
        }}
      />
      {openEv && (
        <EventoDetalheDialog
          eventoId={openEv}
          open={!!openEv}
          onOpenChange={(o) => !o && setOpenEv(null)}
          onChanged={load}
        />
      )}
    </section>
  );
}
