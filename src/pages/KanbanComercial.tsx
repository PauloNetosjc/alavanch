import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Plus, Search, KanbanSquare, Settings } from "lucide-react";
import { toast } from "sonner";

type Estagio = { id: string; nome: string; ordem: number; cor: string; is_ganho: boolean; is_perdido: boolean; ativo: boolean };
type Card = {
  id: string;
  codigo: string;
  nome_projeto: string | null;
  total: number | null;
  created_at: string;
  estagio_id: string | null;
  status: string;
  vendedor_id: string | null;
  loja_id: string | null;
  cliente: { nome: string } | null;
  pedido_id?: string | null;
};

const fmtBrl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export default function KanbanComercial() {
  const navigate = useNavigate();
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lojas, setLojas] = useState<{ id: string; nome: string }[]>([]);
  const [vendedores, setVendedores] = useState<{ user_id: string; nome_completo: string }[]>([]);
  const [filtroLoja, setFiltroLoja] = useState<string>("todas");
  const [filtroVend, setFiltroVend] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");

  // perda dialog
  const [perdaOpen, setPerdaOpen] = useState(false);
  const [perdaOrcId, setPerdaOrcId] = useState<string | null>(null);
  const [perdaEstId, setPerdaEstId] = useState<string | null>(null);
  const [perdaMotivo, setPerdaMotivo] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: ests }, { data: orcs }, { data: lj }, { data: pf }, { data: peds }] = await Promise.all([
      supabase.from("crm_estagios").select("*").eq("ativo", true).order("ordem"),
      supabase.from("orcamentos").select("id, codigo, nome_projeto, total, created_at, estagio_id, status, vendedor_id, loja_id, cliente:clientes(nome)").order("created_at", { ascending: false }),
      supabase.from("lojas").select("id, nome").order("nome"),
      supabase.from("profiles").select("user_id, nome_completo").order("nome_completo"),
      supabase.from("pedidos").select("id, orcamento_id"),
    ]);
    const pedidoMap = new Map<string, string>();
    (peds ?? []).forEach((p: any) => { if (p.orcamento_id) pedidoMap.set(p.orcamento_id, p.id); });
    const orcsWithPedido = (orcs ?? []).map((o: any) => ({ ...o, pedido_id: pedidoMap.get(o.id) ?? null }));
    setEstagios((ests ?? []) as Estagio[]);
    setCards(orcsWithPedido as any);
    setLojas((lj ?? []) as any);
    setVendedores((pf ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const meses = useMemo(() => {
    const arr: { key: string; label: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      arr.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }) });
    }
    return arr;
  }, []);

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (filtroLoja !== "todas" && c.loja_id !== filtroLoja) return false;
      if (filtroVend !== "todos" && c.vendedor_id !== filtroVend) return false;
      if (filtroMes !== "todos") {
        const [y, m] = filtroMes.split("-").map(Number);
        const d = new Date(c.created_at);
        if (d.getFullYear() !== y || d.getMonth() !== m) return false;
      }
      const q = search.toLowerCase().trim();
      if (q) {
        const hay = `${c.codigo} ${c.nome_projeto ?? ""} ${c.cliente?.nome ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cards, filtroLoja, filtroVend, filtroMes, search]);

  const moverCard = async (orcId: string, novoEstId: string) => {
    const est = estagios.find((e) => e.id === novoEstId);
    if (est?.is_perdido) {
      setPerdaOrcId(orcId);
      setPerdaEstId(novoEstId);
      setPerdaMotivo("");
      setPerdaOpen(true);
      return;
    }
    const { error } = await supabase.from("orcamentos").update({ estagio_id: novoEstId }).eq("id", orcId);
    if (error) return toast.error(error.message);
    toast.success("Card movido");
    load();
  };

  const confirmarPerda = async () => {
    if (!perdaMotivo.trim()) return toast.error("Informe o motivo da perda");
    if (!perdaOrcId || !perdaEstId) return;
    const { error } = await supabase
      .from("orcamentos")
      .update({ estagio_id: perdaEstId, motivo_perda: perdaMotivo, perdido_em: new Date().toISOString() })
      .eq("id", perdaOrcId);
    if (error) return toast.error(error.message);
    toast.success("Orçamento marcado como perdido");
    setPerdaOpen(false);
    setPerdaOrcId(null);
    setPerdaEstId(null);
    load();
  };

  const onDragStart = (e: React.DragEvent, id: string) => e.dataTransfer.setData("text/plain", id);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent, estId: string) => {
    e.preventDefault();
    const orcId = e.dataTransfer.getData("text/plain");
    if (orcId) moverCard(orcId, estId);
  };

  return (
    <div>
      <PageHeader
        icon={KanbanSquare}
        iconVariant="purple"
        title="CRM Comercial"
        subtitle="Funil de orçamentos por estágio"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5 rounded-xl" onClick={() => navigate("/administracao?tab=crm")}>
              <Settings className="w-4 h-4" /> Estágios
            </Button>
            <Button onClick={() => navigate("/comercial/novo")} variant="outline" className="gap-1.5 rounded-xl">
              <Plus className="w-4 h-4" /> Novo Orçamento
            </Button>
          </div>
        }
      />

      {/* Filtros */}
      <div className="surface-card mb-4 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl" />
        </div>
        <Select value={filtroLoja} onValueChange={setFiltroLoja}>
          <SelectTrigger><SelectValue placeholder="Loja" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as lojas</SelectItem>
            {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroVend} onValueChange={setFiltroVend}>
          <SelectTrigger><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos vendedores</SelectItem>
            {vendedores.map((v) => <SelectItem key={v.user_id} value={v.user_id}>{v.nome_completo}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroMes} onValueChange={setFiltroMes}>
          <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {meses.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {estagios.map((est) => {
            const items = filtered.filter((c) => c.estagio_id === est.id);
            const total = items.reduce((s, c) => s + (Number(c.total) || 0), 0);
            return (
              <div
                key={est.id}
                className="flex-shrink-0 w-72 rounded-2xl bg-muted/30 p-3"
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, est.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: est.cor }} />
                    <span className="font-semibold text-sm">{est.nome}</span>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground mb-2 font-mono">{fmtBrl(total)}</div>
                <div className="space-y-2 min-h-[100px]">
                  {items.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, c.id)}
                      onClick={() => {
                        if (c.pedido_id) navigate(`/pedidos/${c.pedido_id}`);
                        else if (c.status === "negociacao" || c.status === "aprovado") navigate(`/comercial/${c.id}/negociar`);
                        else navigate(`/comercial/${c.id}`);
                      }}
                      className="bg-card border rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="text-[11px] font-mono text-muted-foreground">{c.codigo}</div>
                      <div className="font-medium text-sm truncate">{c.cliente?.nome ?? "—"}</div>
                      {c.nome_projeto && <div className="text-xs text-muted-foreground truncate">{c.nome_projeto}</div>}
                      <div className="text-sm font-semibold mt-1">{fmtBrl(Number(c.total) || 0)}</div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-8 border-2 border-dashed rounded-xl">
                      Arraste cards aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {estagios.length === 0 && (
            <div className="text-center w-full py-12 text-muted-foreground">
              <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-50" />
              Nenhum estágio configurado. Acesse a Administração para criar.
            </div>
          )}
        </div>
      )}

      {/* Dialog de motivo de perda */}
      <Dialog open={perdaOpen} onOpenChange={setPerdaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motivo da perda</DialogTitle></DialogHeader>
          <Textarea
            rows={4}
            placeholder="Descreva o motivo (obrigatório)"
            value={perdaMotivo}
            onChange={(e) => setPerdaMotivo(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPerdaOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarPerda}>Confirmar perda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
