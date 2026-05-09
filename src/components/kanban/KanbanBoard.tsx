import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, AlertTriangle, Clock, Star, X, Search, Flame, Settings, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { KanbanFiltrosDialog, FILTROS_DEFAULT, URGENCIA_META, type KanbanFiltros, type UrgenciaNivel } from "./KanbanFiltrosDialog";

const URGENCIA_RANK: Record<UrgenciaNivel, number> = { alta: 3, media: 2, baixa: 1 };

export type KanbanBoardProps = {
  pipeline: string;
  stageColumn: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconVariant?: "blue" | "purple" | "green" | "amber" | "rose";
  /** Slot de conteúdo extra à esquerda do botão "Estágios" (ex.: switcher de Kanbans) */
  switcher?: ReactNode;
  /** Caminho para a tela de gestão de estágios deste pipeline */
  estagiosPath?: string;
  /** Conteúdo extra após o botão de Estágios (ex.: Novo Orçamento) */
  extraActions?: ReactNode;
};

type Estagio = { id: string; nome: string; ordem: number; cor: string | null };
type Card = {
  id: string;
  codigo: string;
  valor_total: number | null;
  vip: boolean | null;
  critico: boolean | null;
  estagio_responsavel_id: string | null;
  estagio_prazo: string | null;
  estagio_iniciado_em: string | null;
  loja_id: string | null;
  urgencia: UrgenciaNivel | null;
  arquivado: boolean | null;
  cliente: { nome: string } | null;
  [k: string]: any;
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
  stageColumn,
  title,
  subtitle,
  icon,
  iconVariant = "purple",
  switcher,
  estagiosPath = "/administracao?tab=pipelines",
  extraActions,
}: KanbanBoardProps) {
  const nav = useNavigate();
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<KanbanFiltros>(FILTROS_DEFAULT);
  const [filterOpen, setFilterOpen] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const [{ data: est }, { data: peds }, { data: profs }] = await Promise.all([
      supabase.from("pipeline_estagios").select("id,nome,ordem,cor").eq("pipeline", pipeline).eq("ativo", true).order("ordem"),
      supabase
        .from("pedidos")
        .select(`id,codigo,valor_total,vip,critico,${stageColumn},estagio_responsavel_id,estagio_prazo,estagio_iniciado_em,loja_id,urgencia,arquivado,cliente:clientes(nome)`)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id,nome_completo"),
    ]);
    setEstagios((est ?? []) as Estagio[]);
    setCards((peds ?? []) as any);
    setProfiles((profs ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [pipeline]);

  const profileNome = (id: string | null) =>
    profiles.find((p) => p.user_id === id)?.nome_completo || "—";

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      const t = search.toLowerCase();
      const matchTxt = !t || c.codigo.toLowerCase().includes(t) || (c.cliente?.nome || "").toLowerCase().includes(t);
      if (!matchTxt) return false;

      if (!filtros.arquivados && c.arquivado) return false;
      if (filtros.unidadeId && c.loja_id !== filtros.unidadeId) return false;
      if (filtros.responsavelId && c.estagio_responsavel_id !== filtros.responsavelId) return false;

      const d = diffDays(c.estagio_prazo);
      if (filtros.somenteAtrasados && (d == null || d >= 0)) return false;
      if (filtros.dataFim) {
        const lim = new Date(filtros.dataFim + "T23:59:59").getTime();
        const prazo = c.estagio_prazo ? new Date(c.estagio_prazo).getTime() : Infinity;
        if (prazo > lim) return false;
      }
      if (filtros.urgencia && c.urgencia !== filtros.urgencia) return false;
      return true;
    });
  }, [cards, search, filtros]);

  const cardsPorEstagio = useMemo(() => {
    const map = new Map<string, Card[]>();
    estagios.forEach((e) => map.set(e.id, []));
    filtered.forEach((c) => {
      const est = c[stageColumn];
      if (est && map.has(est)) map.get(est)!.push(c);
    });
    map.forEach((list) => {
      list.sort((a, b) => {
        if (filtros.ordenarPor === "urgencia") {
          return (URGENCIA_RANK[b.urgencia as UrgenciaNivel] || 0) - (URGENCIA_RANK[a.urgencia as UrgenciaNivel] || 0);
        }
        if (filtros.ordenarPor === "entrega") {
          const da = a.estagio_prazo ? new Date(a.estagio_prazo).getTime() : Infinity;
          const db = b.estagio_prazo ? new Date(b.estagio_prazo).getTime() : Infinity;
          return da - db;
        }
        return 0;
      });
    });
    return map;
  }, [filtered, estagios, filtros.ordenarPor, stageColumn]);

  const totaisPorEstagio = useMemo(() => {
    const t = new Map<string, number>();
    cardsPorEstagio.forEach((list, k) => {
      t.set(k, list.reduce((s, c) => s + (Number(c.valor_total) || 0), 0));
    });
    return t;
  }, [cardsPorEstagio]);

  const moverCard = async (cardId: string, novoEstagio: string) => {
    const { error } = await supabase.from("pedidos").update({ [stageColumn]: novoEstagio } as any).eq("id", cardId);
    if (error) return toast.error(error.message);
    toast.success("Card movido");
    carregar();
  };

  const chips: { label: string; onClear: () => void }[] = [];
  chips.push({ label: `Arquivados: ${filtros.arquivados ? "Sim" : "Não"}`, onClear: () => setFiltros((f) => ({ ...f, arquivados: false })) });
  chips.push({ label: `Atrasados: ${filtros.somenteAtrasados ? "Sim" : "Não"}`, onClear: () => setFiltros((f) => ({ ...f, somenteAtrasados: false })) });
  chips.push({ label: `Mostrar valores: ${filtros.mostrarValores ? "Sim" : "Não"}`, onClear: () => setFiltros((f) => ({ ...f, mostrarValores: !f.mostrarValores })) });
  chips.push({ label: `Mostrar tarefas: ${filtros.mostrarTarefas ? "Sim" : "Não"}`, onClear: () => setFiltros((f) => ({ ...f, mostrarTarefas: !f.mostrarTarefas })) });
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
            {switcher}
            <Button variant="outline" className="gap-1.5 rounded-xl" onClick={() => nav(estagiosPath)}>
              <Settings className="w-4 h-4" /> Estágios
            </Button>
            {extraActions}
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
                      const d = diffDays(c.estagio_prazo);
                      const prazoColor = d == null ? "" :
                        d < 0 ? "bg-red-50 border-red-200 text-red-700" :
                        d <= 5 ? "bg-amber-50 border-amber-200 text-amber-700" :
                        "bg-emerald-50 border-emerald-200 text-emerald-700";
                      const urg = c.urgencia ? URGENCIA_META[c.urgencia as UrgenciaNivel] : null;
                      return (
                        <div
                          key={c.id}
                          draggable
                          onDragStart={(ev) => ev.dataTransfer.setData("text/card", c.id)}
                          onClick={() => nav(`/pedidos/${c.id}`)}
                          className="bg-card border-l-4 border border-border rounded p-2.5 cursor-pointer hover:shadow-md transition-shadow"
                          style={{ borderLeftColor: e.cor || "#6b7280" }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[12px] font-bold text-primary">{c.codigo}</div>
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
                              {c.vip && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                            </div>
                          </div>
                          <div className="text-[12px] font-medium truncate mt-1">{c.cliente?.nome || "—"}</div>
                          {filtros.mostrarValores && (
                            <div className="text-[11px] text-muted-foreground mt-1">{fmtBrl(Number(c.valor_total) || 0)}</div>
                          )}
                          {c.estagio_responsavel_id && (
                            <div className="text-[10px] text-muted-foreground mt-1 truncate">
                              👤 {profileNome(c.estagio_responsavel_id)}
                            </div>
                          )}
                          {c.estagio_prazo && (
                            <div className={`mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${prazoColor}`}>
                              {d != null && d < 0 ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {d == null ? "—" : d < 0 ? `${Math.abs(d)}d atraso` : d === 0 ? "hoje" : `${d}d restantes`}
                            </div>
                          )}
                          {c.critico && (
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
