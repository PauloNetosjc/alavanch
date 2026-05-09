import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, AlertTriangle, Clock, Star, X, Search, Flame, Settings, Check, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { KanbanFiltrosDialog, FILTROS_DEFAULT, URGENCIA_META, type KanbanFiltros, type UrgenciaNivel } from "./KanbanFiltrosDialog";
import { KanbanSwitcher } from "./KanbanSwitcher";
import { EstagiosEditDialog } from "./EstagiosEditDialog";
import { StageActionDialog } from "./StageActionDialog";
import type { KanbanKey } from "./kanbanRegistry";

const URGENCIA_RANK: Record<UrgenciaNivel, number> = { alta: 3, media: 2, baixa: 1 };

export type KanbanBoardProps = {
  pipeline: string;
  activeKey: KanbanKey;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconVariant?: "blue" | "purple" | "green" | "amber" | "rose";
  /** When true, clicking a card opens the stage action popup instead of navigating to /pedidos/:id */
  useStageDialog?: boolean;
};

type Estagio = { id: string; nome: string; ordem: number; cor: string | null; checklist_template_id: string | null };
type CardRow = {
  id: string;
  pedido_id: string;
  estagio_id: string;
  responsavel_id: string | null;
  prazo: string | null;
  iniciado_em: string | null;
  created_at: string | null;
  pedido: {
    id: string;
    codigo: string;
    valor_total: number | null;
    vip: boolean | null;
    critico: boolean | null;
    loja_id: string | null;
    urgencia: UrgenciaNivel | null;
    arquivado: boolean | null;
    cliente: { nome: string } | null;
  } | null;
};
type Profile = { user_id: string; nome_completo: string | null };

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const diffDays = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
};

export default function KanbanBoard({
  pipeline,
  activeKey,
  title,
  subtitle,
  icon,
  iconVariant = "purple",
  useStageDialog = false,
}: KanbanBoardProps) {
  const nav = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<KanbanFiltros>(FILTROS_DEFAULT);
  const [filterOpen, setFilterOpen] = useState(false);
  const [editEstOpen, setEditEstOpen] = useState(false);

  const [activeCard, setActiveCard] = useState<CardRow | null>(null);
  const [activeStage, setActiveStage] = useState<Estagio | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      // Trigger overdue check (best-effort, ignore errors)
      try { await (supabase as any).rpc("kanban_processar_atrasos"); } catch { /* ignore */ }

      const [{ data: est }, { data: rows }, { data: profs }] = await Promise.all([
        (supabase as any).from("pipeline_estagios")
          .select("id,nome,ordem,cor,checklist_template_id")
          .eq("pipeline", pipeline).eq("ativo", true).order("ordem"),
        (supabase as any).from("kanban_cards")
          .select(`id,pedido_id,estagio_id,responsavel_id,prazo,iniciado_em,created_at,
                   pedido:pedidos(id,codigo,valor_total,vip,critico,loja_id,urgencia,arquivado,cliente:clientes(nome))`)
          .eq("pipeline", pipeline)
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("user_id,nome_completo"),
      ]);
      setEstagios((est ?? []) as Estagio[]);
      setCards((rows ?? []) as CardRow[]);
      setProfiles((profs ?? []) as any);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar Kanban");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pipeline]);

  const profileNome = (id: string | null) =>
    profiles.find((p) => p.user_id === id)?.nome_completo || "—";

  const isConcluidos = (e: Estagio) => e.nome.trim().toLowerCase() === "concluídos" || e.nome.trim().toLowerCase() === "concluidos";

  const visibleEstagios = useMemo(
    () => (isAdmin ? estagios : estagios.filter((e) => !isConcluidos(e))),
    [estagios, isAdmin]
  );

  // Última etapa "real" (antes de Concluídos) — usada para liberar o botão de concluir
  const lastRealStageId = useMemo(() => {
    const reais = estagios.filter((e) => !isConcluidos(e));
    return reais.length ? reais[reais.length - 1].id : null;
  }, [estagios]);

  const podeConcluir = (card: CardRow) => {
    // Pós-venda permite concluir em qualquer etapa
    if (pipeline === "pos_venda") return true;
    return card.estagio_id === lastRealStageId;
  };

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      // Esconde cards que já estão em "Concluídos" para não-admin
      if (!isAdmin) {
        const est = estagios.find((e) => e.id === c.estagio_id);
        if (est && isConcluidos(est)) return false;
      }
      const ped = c.pedido;
      if (!ped) return false;
      const t = search.toLowerCase();
      const matchTxt = !t || ped.codigo.toLowerCase().includes(t) || (ped.cliente?.nome || "").toLowerCase().includes(t);
      if (!matchTxt) return false;

      if (!filtros.arquivados && ped.arquivado) return false;
      if (filtros.unidadeId && ped.loja_id !== filtros.unidadeId) return false;
      if (filtros.responsavelId && c.responsavel_id !== filtros.responsavelId) return false;

      const d = diffDays(c.prazo);
      if (filtros.somenteAtrasados && (d == null || d >= 0)) return false;
      if (filtros.dataFim) {
        const lim = new Date(filtros.dataFim + "T23:59:59").getTime();
        const prazo = c.prazo ? new Date(c.prazo).getTime() : Infinity;
        if (prazo > lim) return false;
      }
      if (filtros.urgencia && ped.urgencia !== filtros.urgencia) return false;
      return true;
    });
  }, [cards, search, filtros, isAdmin, estagios]);

  const cardsPorEstagio = useMemo(() => {
    const map = new Map<string, CardRow[]>();
    estagios.forEach((e) => map.set(e.id, []));
    filtered.forEach((c) => {
      if (map.has(c.estagio_id)) map.get(c.estagio_id)!.push(c);
    });
    map.forEach((list) => {
      list.sort((a, b) => {
        if (filtros.ordenarPor === "urgencia") {
          return (URGENCIA_RANK[b.pedido?.urgencia as UrgenciaNivel] || 0) - (URGENCIA_RANK[a.pedido?.urgencia as UrgenciaNivel] || 0);
        }
        if (filtros.ordenarPor === "entrega") {
          const da = a.prazo ? new Date(a.prazo).getTime() : Infinity;
          const db = b.prazo ? new Date(b.prazo).getTime() : Infinity;
          return da - db;
        }
        return 0;
      });
    });
    return map;
  }, [filtered, estagios, filtros.ordenarPor]);

  const totaisPorEstagio = useMemo(() => {
    const t = new Map<string, number>();
    cardsPorEstagio.forEach((list, k) => {
      t.set(k, list.reduce((s, c) => s + (Number(c.pedido?.valor_total) || 0), 0));
    });
    return t;
  }, [cardsPorEstagio]);

  const logEvento = async (pedidoId: string, tipo: string, descricao: string, metadata: Record<string, any> = {}) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      await (supabase as any).from("timeline_eventos").insert({
        entidade_tipo: "pedido", entidade_id: pedidoId, tipo, descricao,
        usuario_id: u.user?.id ?? null, metadata,
      });
    } catch (e) { console.error(e); }
  };

  const moverCard = async (cardId: string, novoEstagio: string) => {
    const card = cards.find((c) => c.id === cardId);
    const deEst = estagios.find((e) => e.id === card?.estagio_id);
    const paraEst = estagios.find((e) => e.id === novoEstagio);
    if (card?.estagio_id === novoEstagio) return;
    const { error } = await (supabase as any).from("kanban_cards")
      .update({ estagio_id: novoEstagio, iniciado_em: new Date().toISOString(), notificacao_atraso_em: null })
      .eq("id", cardId);
    if (error) return toast.error(error.message);
    if (card?.pedido_id) {
      await logEvento(card.pedido_id, "kanban_movimento",
        `[${pipeline}] ${deEst?.nome ?? "—"} → ${paraEst?.nome ?? "—"} (drag & drop)`,
        { pipeline, de: deEst?.nome, para: paraEst?.nome, card_id: cardId, drag: true });
    }
    toast.success("Card movido");
    carregar();
  };

  const concluirCard = async (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Concluir e remover este card? O pedido permanece no sistema.")) return;
    const card = cards.find((c) => c.id === cardId);
    const est = estagios.find((es) => es.id === card?.estagio_id);
    const { error } = await (supabase as any).rpc("concluir_kanban_card", { _card_id: cardId });
    if (error) return toast.error(error.message);
    if (card?.pedido_id) {
      await logEvento(card.pedido_id, "kanban_concluido",
        `[${pipeline}] Card concluído na etapa "${est?.nome ?? "—"}"`,
        { pipeline, estagio: est?.nome, card_id: cardId });
    }
    toast.success("Card concluído");
    carregar();
  };

  const onCardClick = (c: CardRow, est: Estagio) => {
    if (useStageDialog) {
      setActiveCard(c);
      setActiveStage(est);
    } else if (c.pedido) {
      nav(`/pedidos/${c.pedido.id}`);
    }
  };

  const chips: { label: string; onClear: () => void }[] = [];
  chips.push({ label: `Arquivados: ${filtros.arquivados ? "Sim" : "Não"}`, onClear: () => setFiltros((f) => ({ ...f, arquivados: false })) });
  chips.push({ label: `Atrasados: ${filtros.somenteAtrasados ? "Sim" : "Não"}`, onClear: () => setFiltros((f) => ({ ...f, somenteAtrasados: false })) });
  chips.push({ label: `Mostrar valores: ${filtros.mostrarValores ? "Sim" : "Não"}`, onClear: () => setFiltros((f) => ({ ...f, mostrarValores: !f.mostrarValores })) });
  if (filtros.urgencia) chips.push({ label: `Urgência: ${URGENCIA_META[filtros.urgencia].label}`, onClear: () => setFiltros((f) => ({ ...f, urgencia: undefined })) });

  return (
    <div className="space-y-4">
      <PageHeader
        icon={icon || Filter}
        iconVariant={iconVariant}
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex gap-2 items-center">
            <KanbanSwitcher active={activeKey} />
            {isAdmin && (
              <Button variant="outline" className="gap-1.5 rounded-xl" onClick={() => setEditEstOpen(true)}>
                <Settings className="w-4 h-4" /> Editar estágios
              </Button>
            )}
          </div>
        }
      />

      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Pesquisar" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => setFilterOpen(true)}>
          <Filter className="w-4 h-4 mr-2" /> Filtros
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-[12px]">
            {c.label}
            <button onClick={c.onClear} className="hover:text-foreground text-muted-foreground"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>

      <KanbanFiltrosDialog open={filterOpen} onOpenChange={setFilterOpen} value={filtros} onChange={setFiltros} />
      <EstagiosEditDialog open={editEstOpen} onOpenChange={setEditEstOpen} pipeline={pipeline} onChanged={carregar} />
      <StageActionDialog
        open={!!activeCard}
        onOpenChange={(v) => { if (!v) { setActiveCard(null); setActiveStage(null); } }}
        card={activeCard}
        stage={activeStage}
        pipeline={pipeline}
        estagios={estagios}
        onUpdated={carregar}
      />

      {loading ? (
        <div className="text-center text-muted-foreground py-12 text-[13px]">Carregando…</div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {estagios.map((e) => {
              const list = cardsPorEstagio.get(e.id) || [];
              const total = totaisPorEstagio.get(e.id) || 0;
              return (
                <div key={e.id} className="w-[300px] shrink-0">
                  <div
                    className="rounded-t-lg px-3 py-2"
                    style={{ background: (e.cor || "#6b7280") + "15", borderTop: `3px solid ${e.cor || "#6b7280"}` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12px] font-semibold uppercase tracking-wider truncate" style={{ color: e.cor || "#6b7280" }}>
                        {e.nome}
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white/80 text-foreground">{list.length}</span>
                    </div>
                    {filtros.mostrarValores && (
                      <div className="text-right text-[11px] text-muted-foreground mt-0.5">{fmtBrl(total)}</div>
                    )}
                  </div>
                  <div
                    className="bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[140px]"
                    onDragOver={(ev) => ev.preventDefault()}
                    onDrop={(ev) => {
                      const cardId = ev.dataTransfer.getData("text/card");
                      if (cardId) moverCard(cardId, e.id);
                    }}
                  >
                    {list.map((c) => {
                      const ped = c.pedido!;
                      const d = diffDays(c.prazo);
                      const atrasado = d != null && d < 0;
                      const cardBg = atrasado ? "bg-red-50 border-red-300" : "bg-card border-border";
                      const prazoColor = d == null ? "" :
                        d < 0 ? "bg-red-100 border-red-300 text-red-700" :
                        d <= 2 ? "bg-amber-50 border-amber-200 text-amber-700" :
                        "bg-emerald-50 border-emerald-200 text-emerald-700";
                      const urg = ped.urgencia ? URGENCIA_META[ped.urgencia as UrgenciaNivel] : null;
                      return (
                        <div
                          key={c.id}
                          draggable
                          onDragStart={(ev) => ev.dataTransfer.setData("text/card", c.id)}
                          onClick={() => onCardClick(c, e)}
                          className={`border-l-4 border rounded p-2.5 cursor-pointer hover:shadow-md transition-shadow ${cardBg}`}
                          style={{ borderLeftColor: e.cor || "#6b7280" }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[12px] font-bold text-primary">{ped.codigo}</div>
                            <div className="flex items-center gap-1">
                              {urg && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                  style={{ background: urg.bg, color: urg.color }}
                                  title={`Urgência ${urg.label}`}
                                >
                                  <Flame className="w-3 h-3" /> {urg.label}
                                </span>
                              )}
                              {ped.vip && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                              <button
                                onClick={(ev) => concluirCard(c.id, ev)}
                                title="Concluir card"
                                className="p-0.5 rounded hover:bg-emerald-100 text-emerald-600"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="text-[12px] font-medium truncate mt-1">{ped.cliente?.nome || "—"}</div>
                          {filtros.mostrarValores && (
                            <div className="text-[11px] text-muted-foreground mt-1">{fmtBrl(Number(ped.valor_total) || 0)}</div>
                          )}
                          {c.responsavel_id && (
                            <div className="text-[10px] text-muted-foreground mt-1 truncate">
                              👤 {profileNome(c.responsavel_id)}
                            </div>
                          )}
                          {c.prazo && (
                            <div className={`mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${prazoColor}`}>
                              {atrasado ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {d == null ? "—" : d < 0 ? `${Math.abs(d)}d atraso` : d === 0 ? "vence hoje" : `${d}d restantes`}
                            </div>
                          )}
                          {ped.critico && (
                            <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-medium">
                              <AlertTriangle className="w-3 h-3" /> Crítico
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {list.length === 0 && (
                      <div className="text-[11px] text-muted-foreground text-center py-4">Vazio</div>
                    )}
                  </div>
                </div>
              );
            })}
            {estagios.length === 0 && (
              <div className="text-[13px] text-muted-foreground py-8">Nenhum estágio configurado.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
