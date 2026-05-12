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
import { Briefcase, Plus, Search, KanbanSquare, Settings, CalendarDays, FileText, Phone, MapPin, User, Tag, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { KanbanSwitcher } from "@/components/kanban/KanbanSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

type Estagio = { id: string; nome: string; ordem: number; cor: string; is_ganho: boolean; is_perdido: boolean; ativo: boolean };

type Card = {
  kind: "lead" | "orcamento";
  id: string;
  codigo: string;
  titulo: string;
  subtitulo?: string | null;
  total: number;
  created_at: string;
  estagio_id: string | null;
  loja_id: string | null;
  vendedor_id: string | null;
  cliente_id?: string | null;
  cliente_nome: string;
  pedido_id?: string | null;
  data_apresentacao?: string | null;
  hora_apresentacao?: string | null;
};

const fmtBrl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export default function KanbanComercial() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lojas, setLojas] = useState<{ id: string; nome: string }[]>([]);
  const [vendedores, setVendedores] = useState<{ user_id: string; nome_completo: string }[]>([]);
  const [filtroLoja, setFiltroLoja] = useState<string>("todas");
  const [filtroVend, setFiltroVend] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");

  const [perdaOpen, setPerdaOpen] = useState(false);
  const [perdaCard, setPerdaCard] = useState<Card | null>(null);
  const [perdaEstId, setPerdaEstId] = useState<string | null>(null);
  const [perdaMotivo, setPerdaMotivo] = useState("");

  const [detalheOpen, setDetalheOpen] = useState(false);
  const [detalheCard, setDetalheCard] = useState<Card | null>(null);
  const [detalheData, setDetalheData] = useState<any>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: ests }, { data: orcs }, { data: lds }, { data: lj }, { data: pf }, { data: peds }] = await Promise.all([
      supabase.from("crm_estagios").select("*").eq("ativo", true).order("ordem"),
      supabase.from("orcamentos").select("id, codigo, nome_projeto, total, created_at, estagio_id, status, vendedor_id, loja_id, cliente_id, cliente:clientes(nome)").order("created_at", { ascending: false }),
      supabase.from("leads" as any).select("id, nome, whatsapp, cliente_id, loja_id, usuario_id, crm_estagio_id, data_apresentacao, hora_apresentacao, created_at, arquivado, orcamento_id, cliente:clientes(nome)").eq("arquivado", false).is("orcamento_id", null),
      supabase.from("lojas").select("id, nome").order("nome"),
      supabase.from("profiles").select("user_id, nome_completo").order("nome_completo"),
      supabase.from("pedidos").select("id, orcamento_id"),
    ]);
    const pedidoMap = new Map<string, string>();
    (peds ?? []).forEach((p: any) => { if (p.orcamento_id) pedidoMap.set(p.orcamento_id, p.id); });

    const orcCards: Card[] = (orcs ?? []).map((o: any) => ({
      kind: "orcamento",
      id: o.id,
      codigo: o.codigo,
      titulo: o.cliente?.nome ?? "—",
      subtitulo: o.nome_projeto,
      total: Number(o.total) || 0,
      created_at: o.created_at,
      estagio_id: o.estagio_id,
      loja_id: o.loja_id,
      vendedor_id: o.vendedor_id,
      cliente_id: o.cliente_id,
      cliente_nome: o.cliente?.nome ?? "—",
      pedido_id: pedidoMap.get(o.id) ?? null,
    }));

    const leadCards: Card[] = (lds ?? []).map((l: any) => ({
      kind: "lead",
      id: l.id,
      codigo: `LEAD-${String(l.id).slice(0, 6).toUpperCase()}`,
      titulo: l.cliente?.nome ?? l.nome ?? "—",
      subtitulo: l.data_apresentacao ? `Apresentação ${new Date(l.data_apresentacao + "T00:00:00").toLocaleDateString("pt-BR")}${l.hora_apresentacao ? ` ${String(l.hora_apresentacao).slice(0,5)}` : ""}` : null,
      total: 0,
      created_at: l.created_at,
      estagio_id: l.crm_estagio_id,
      loja_id: l.loja_id,
      vendedor_id: l.usuario_id,
      cliente_id: l.cliente_id,
      cliente_nome: l.cliente?.nome ?? l.nome ?? "—",
      data_apresentacao: l.data_apresentacao,
      hora_apresentacao: l.hora_apresentacao,
    }));

    setEstagios((ests ?? []) as Estagio[]);
    setCards([...leadCards, ...orcCards]);
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
        const hay = `${c.codigo} ${c.subtitulo ?? ""} ${c.cliente_nome}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cards, filtroLoja, filtroVend, filtroMes, search]);

  const moverCard = async (card: Card, novoEstId: string) => {
    const est = estagios.find((e) => e.id === novoEstId);
    if (est?.is_perdido) {
      setPerdaCard(card);
      setPerdaEstId(novoEstId);
      setPerdaMotivo("");
      setPerdaOpen(true);
      return;
    }
    if (card.kind === "lead") {
      const { error } = await supabase.from("leads" as any).update({ crm_estagio_id: novoEstId }).eq("id", card.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("orcamentos").update({ estagio_id: novoEstId }).eq("id", card.id);
      if (error) return toast.error(error.message);
    }
    toast.success("Card movido");
    load();
  };

  const confirmarPerda = async () => {
    if (!perdaMotivo.trim()) return toast.error("Informe o motivo da perda");
    if (!perdaCard || !perdaEstId) return;
    if (perdaCard.kind === "lead") {
      const { error } = await supabase.from("leads" as any)
        .update({ crm_estagio_id: perdaEstId, motivo_perda: perdaMotivo, arquivado: true })
        .eq("id", perdaCard.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("orcamentos")
        .update({ estagio_id: perdaEstId, motivo_perda: perdaMotivo, perdido_em: new Date().toISOString() })
        .eq("id", perdaCard.id);
      if (error) return toast.error(error.message);
    }
    toast.success("Marcado como perdido");
    setPerdaOpen(false);
    setPerdaCard(null);
    setPerdaEstId(null);
    load();
  };

  const cardKey = (c: Card) => `${c.kind}:${c.id}`;
  const onDragStart = (e: React.DragEvent, c: Card) => e.dataTransfer.setData("text/plain", cardKey(c));
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent, estId: string) => {
    e.preventDefault();
    const k = e.dataTransfer.getData("text/plain");
    const found = cards.find((c) => cardKey(c) === k);
    if (found) moverCard(found, estId);
  };

  const criarOrcamentoFromLead = (c: Card) => {
    if (!c.cliente_id) return toast.error("Lead sem cliente vinculado");
    navigate(`/comercial/novo?cliente=${c.cliente_id}`);
  };

  const handleCardClick = async (c: Card) => {
    setDetalheCard(c);
    setDetalheData(null);
    setDetalheOpen(true);
    setDetalheLoading(true);
    try {
      if (c.kind === "lead") {
        const { data: lead } = await supabase
          .from("leads" as any)
          .select("*, cliente:clientes(nome, telefone, email), loja:lojas(nome), responsavel:profiles!leads_responsavel_id_fkey(nome_completo), vendedor:profiles!leads_usuario_id_fkey(nome_completo)")
          .eq("id", c.id)
          .maybeSingle();
        setDetalheData(lead);
      } else {
        const { data: orc } = await supabase
          .from("orcamentos")
          .select("*, cliente:clientes(nome, telefone, email), loja:lojas(nome), vendedor:profiles!orcamentos_vendedor_id_fkey(nome_completo), ambientes(id, nome, valor_total), pagamentos:pagamentos_orcamento(id, valor, forma_pagamento)")
          .eq("id", c.id)
          .maybeSingle();
        setDetalheData(orc);
      }
    } finally {
      setDetalheLoading(false);
    }
  };

  const irParaOrcamento = () => {
    if (!detalheCard) return;
    setDetalheOpen(false);
    if (detalheCard.pedido_id) navigate(`/pedidos/${detalheCard.pedido_id}`);
    else navigate(`/comercial/${detalheCard.id}/negociacao`);
  };

  return (
    <div>
      <PageHeader
        icon={KanbanSquare}
        iconVariant="purple"
        title="CRM Comercial"
        subtitle="Funil de leads e orçamentos por estágio"
        actions={
          <div className="flex gap-2">
            <KanbanSwitcher active="comercial" />
            {isAdmin && (
              <Button variant="outline" className="gap-1.5 rounded-xl" onClick={() => navigate("/administracao?tab=crm")}>
                <Settings className="w-4 h-4" /> Editar estágios
              </Button>
            )}
            <Button onClick={() => navigate("/comercial/novo")} variant="outline" className="gap-1.5 rounded-xl">
              <Plus className="w-4 h-4" /> Novo Orçamento
            </Button>
          </div>
        }
      />

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

      {loading ? (
        <div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {estagios.map((est) => {
            const items = filtered.filter((c) => c.estagio_id === est.id);
            const total = items.reduce((s, c) => s + c.total, 0);
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
                      key={cardKey(c)}
                      draggable
                      onDragStart={(e) => onDragStart(e, c)}
                      onClick={() => handleCardClick(c)}
                      className="bg-card border rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                        {c.kind === "lead" ? <CalendarDays className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        {c.codigo}
                      </div>
                      <div className="font-medium text-sm truncate">{c.cliente_nome}</div>
                      {c.subtitulo && <div className="text-xs text-muted-foreground truncate">{c.subtitulo}</div>}
                      {c.kind === "orcamento" && (
                        <div className="text-sm font-semibold mt-1">{fmtBrl(c.total)}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Criado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </div>
                      {c.kind === "lead" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2 h-7 text-[11px] rounded-lg"
                          onClick={(e) => { e.stopPropagation(); criarOrcamentoFromLead(c); }}
                        >
                          <Plus className="w-3 h-3" /> Criar Orçamento
                        </Button>
                      )}
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
