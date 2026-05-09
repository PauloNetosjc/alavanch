import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Workflow, AlertTriangle, Clock, Star, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { KanbanSwitcher } from "@/components/kanban/KanbanSwitcher";
import { EstagiosEditDialog } from "@/components/kanban/EstagiosEditDialog";
import { useAuth } from "@/contexts/AuthContext";

type Estagio = { id: string; nome: string; ordem: number; cor: string | null };
type Card = {
  id: string;
  codigo: string;
  valor_total: number | null;
  vip: boolean | null;
  critico: boolean | null;
  estagio_operacional_id: string | null;
  estagio_responsavel_id: string | null;
  estagio_prazo: string | null;
  estagio_iniciado_em: string | null;
  loja_id: string | null;
  cliente: { nome: string } | null;
};
type Profile = { user_id: string; nome_completo: string | null };
type Loja = { id: string; nome: string };

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const diffDays = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
};

export default function KanbanOperacional() {
  const nav = useNavigate();
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [editEstOpen, setEditEstOpen] = useState(false);
  const { role } = useAuth();
  const isAdmin = role === "admin";

  // filtros
  const [search, setSearch] = useState("");
  const [filterLoja, setFilterLoja] = useState<string>("todos");
  const [filterResp, setFilterResp] = useState<string>("todos");
  const [filterPrazo, setFilterPrazo] = useState<"todos" | "atrasado" | "proximo">("todos");

  const carregar = async () => {
    setLoading(true);
    const [{ data: est }, { data: peds }, { data: profs }, { data: ljs }] = await Promise.all([
      supabase.from("pipeline_estagios").select("id,nome,ordem,cor").eq("pipeline", "operacional").eq("ativo", true).order("ordem"),
      supabase
        .from("pedidos")
        .select("id,codigo,valor_total,vip,critico,estagio_operacional_id,estagio_responsavel_id,estagio_prazo,estagio_iniciado_em,loja_id,cliente:clientes(nome)")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id,nome_completo"),
      supabase.from("lojas").select("id,nome").order("nome"),
    ]);
    setEstagios((est ?? []) as Estagio[]);
    setCards((peds ?? []) as any);
    setProfiles((profs ?? []) as any);
    setLojas((ljs ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const profileNome = (id: string | null) =>
    profiles.find((p) => p.user_id === id)?.nome_completo || "—";

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      const t = search.toLowerCase();
      const matchTxt = !t || c.codigo.toLowerCase().includes(t) || (c.cliente?.nome || "").toLowerCase().includes(t);
      if (!matchTxt) return false;
      if (filterLoja !== "todos" && c.loja_id !== filterLoja) return false;
      if (filterResp !== "todos" && c.estagio_responsavel_id !== filterResp) return false;
      const d = diffDays(c.estagio_prazo);
      if (filterPrazo === "atrasado" && (d == null || d >= 0)) return false;
      if (filterPrazo === "proximo" && (d == null || d < 0 || d > 5)) return false;
      return true;
    });
  }, [cards, search, filterLoja, filterResp, filterPrazo]);

  const cardsPorEstagio = useMemo(() => {
    const map = new Map<string, Card[]>();
    estagios.forEach((e) => map.set(e.id, []));
    filtered.forEach((c) => {
      if (c.estagio_operacional_id && map.has(c.estagio_operacional_id))
        map.get(c.estagio_operacional_id)!.push(c);
    });
    return map;
  }, [filtered, estagios]);

  const moverCard = async (cardId: string, novoEstagio: string) => {
    const { error } = await supabase.from("pedidos")
      .update({ estagio_operacional_id: novoEstagio })
      .eq("id", cardId);
    if (error) return toast.error(error.message);
    toast.success("Card movido");
    carregar();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Workflow}
        iconVariant="purple"
        title="Kanban Operacional"
        subtitle="Workflow vinculado ao pedido de venda"
        actions={
          <div className="flex gap-2 items-center">
            <KanbanSwitcher active="operacional" />
            {isAdmin && (
              <Button variant="outline" className="gap-1.5 rounded-xl" onClick={() => setEditEstOpen(true)}>
                <Settings className="w-4 h-4" /> Editar estágios
              </Button>
            )}
          </div>
        }
      />
      <EstagiosEditDialog open={editEstOpen} onOpenChange={setEditEstOpen} pipeline="operacional" onChanged={carregar} />

      {/* Filtros */}
      <div className="surface-card p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <Input placeholder="Buscar cliente ou código…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={filterLoja} onValueChange={setFilterLoja}>
          <SelectTrigger><SelectValue placeholder="Loja" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as lojas</SelectItem>
            {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterResp} onValueChange={setFilterResp}>
          <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.nome_completo || "—"}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPrazo} onValueChange={(v) => setFilterPrazo(v as any)}>
          <SelectTrigger><SelectValue placeholder="Prazo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os prazos</SelectItem>
            <SelectItem value="atrasado">Atrasados</SelectItem>
            <SelectItem value="proximo">Próximos (5d)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12 text-[13px]">Carregando…</div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {estagios.map((e) => {
              const list = cardsPorEstagio.get(e.id) || [];
              return (
                <div key={e.id} className="w-[280px] shrink-0">
                  <div
                    className="rounded-t-lg px-3 py-2 flex items-center justify-between"
                    style={{ background: (e.cor || "#6b7280") + "22", borderTop: `3px solid ${e.cor || "#6b7280"}` }}
                  >
                    <div className="text-[12px] font-semibold uppercase tracking-wider truncate" style={{ color: e.cor || "#6b7280" }}>
                      {e.nome}
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/70">{list.length}</span>
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
                      return (
                        <div
                          key={c.id}
                          draggable
                          onDragStart={(ev) => ev.dataTransfer.setData("text/card", c.id)}
                          onClick={() => nav(`/pedidos/${c.id}`)}
                          className="bg-card border border-border rounded-lg p-2.5 cursor-pointer hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[12px] font-semibold truncate flex-1">{c.cliente?.nome || "—"}</div>
                            {c.vip && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{c.codigo}</div>
                          <div className="text-[12px] font-semibold text-mono mt-1">{fmtBrl(Number(c.valor_total) || 0)}</div>
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
          </div>
        </div>
      )}
    </div>
  );
}
