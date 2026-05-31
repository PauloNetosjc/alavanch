import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Plus, MoreVertical, ShoppingCart, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { toast } from "sonner";

const STATUS = ["pendente", "solicitado", "comprado", "recebido", "liberado_sem_item", "cancelado"] as const;
type Status = typeof STATUS[number];

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  solicitado: "Solicitado",
  comprado: "Comprado",
  recebido: "Recebido",
  liberado_sem_item: "Liberado sem item",
  cancelado: "Cancelado",
};

function statusBadge(s: string) {
  switch (s) {
    case "recebido": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "comprado": return "bg-blue-100 text-blue-800 border-blue-200";
    case "solicitado": return "bg-amber-100 text-amber-800 border-amber-200";
    case "liberado_sem_item": return "bg-violet-100 text-violet-800 border-violet-200";
    case "cancelado": return "bg-muted text-muted-foreground border-border";
    default: return "bg-red-50 text-red-700 border-red-200";
  }
}

interface Requisicao {
  id: string;
  pedido_id: string | null;
  cliente_nome: string | null;
  loja_id: string | null;
  ambiente: string | null;
  item: string;
  descricao: string | null;
  quantidade: number;
  unidade: string | null;
  fornecedor_nome: string | null;
  status: string;
  data_prevista: string | null;
  observacoes: string | null;
  created_at: string;
}

export default function RequisicoesCompra() {
  const { selectedLojaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<Requisicao[]>([]);
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<string>("");
  const [novaOpen, setNovaOpen] = useState(false);
  const [editing, setEditing] = useState<Requisicao | null>(null);

  async function carregar() {
    setLoading(true);
    let q = (supabase as any)
      .from("fabrica_requisicoes_compra")
      .select("*")
      .order("created_at", { ascending: false });
    if (selectedLojaId) q = q.or(`loja_id.eq.${selectedLojaId},loja_id.is.null`);
    const { data, error } = await q;
    if (error) toast.error("Erro ao carregar: " + error.message);
    setItens((data as any) || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [selectedLojaId]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return itens.filter((r) => {
      if (fStatus && r.status !== fStatus) return false;
      if (t) {
        const blob = [r.item, r.cliente_nome, r.ambiente, r.descricao, r.fornecedor_nome].join(" ").toLowerCase();
        if (!blob.includes(t)) return false;
      }
      return true;
    });
  }, [itens, busca, fStatus]);

  async function mudarStatus(r: Requisicao, novo: Status) {
    const patch: any = { status: novo };
    if (novo === "liberado_sem_item") {
      patch.liberado_sem_item = true;
      patch.liberado_em = new Date().toISOString();
    }
    const { error } = await (supabase as any)
      .from("fabrica_requisicoes_compra")
      .update(patch)
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    carregar();
  }

  async function excluir(r: Requisicao) {
    if (!confirm(`Excluir requisição "${r.item}"?`)) return;
    const { error } = await (supabase as any)
      .from("fabrica_requisicoes_compra")
      .delete()
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    carregar();
  }

  const contadores = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of STATUS) c[s] = 0;
    for (const r of itens) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [itens]);

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-lg font-semibold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Requisições de Compra
          </div>
          <div className="text-sm text-muted-foreground">
            Itens que não fabricamos internamente e precisam ser comprados para completar o pedido.
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setNovaOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova requisição
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {STATUS.map((s) => (
          <Card key={s} className="p-3">
            <div className="text-[11px] text-muted-foreground">{STATUS_LABEL[s]}</div>
            <div className="text-xl font-bold">{contadores[s] || 0}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar item, cliente, ambiente, fornecedor..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" />
        </div>
        <Select value={fStatus || "all"} onValueChange={(v) => setFStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Cliente / Ambiente</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prevista</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.item}</div>
                    {r.descricao && <div className="text-xs text-muted-foreground">{r.descricao}</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{r.cliente_nome || "—"}</div>
                    {r.ambiente && <div className="text-xs text-muted-foreground">{r.ambiente}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{r.quantidade} {r.unidade || ""}</TableCell>
                  <TableCell className="text-sm">{r.fornecedor_nome || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadge(r.status)}>{STATUS_LABEL[r.status] || r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.data_prevista ? new Date(r.data_prevista).toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(r); setNovaOpen(true); }}>Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => mudarStatus(r, "solicitado")}>Marcar como solicitado</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => mudarStatus(r, "comprado")}>Marcar como comprado</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => mudarStatus(r, "recebido")}>Marcar como recebido</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => mudarStatus(r, "liberado_sem_item")}>Liberar expedição sem item</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => mudarStatus(r, "cancelado")}>Cancelar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => excluir(r)} className="text-destructive">Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtrados.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma requisição encontrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <RequisicaoDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        editing={editing}
        lojaId={selectedLojaId}
        onSaved={() => { setNovaOpen(false); carregar(); }}
      />
    </Card>
  );
}

function RequisicaoDialog({
  open, onOpenChange, editing, lojaId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Requisicao | null;
  lojaId: string | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [pedidos, setPedidos] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? { ...editing } : {
      item: "", descricao: "", quantidade: 1, unidade: "un",
      status: "pendente", ambiente: "", cliente_nome: "",
      fornecedor_nome: "", data_prevista: "", observacoes: "",
      pedido_id: null,
    });
    (async () => {
      let q = (supabase as any)
        .from("pedidos")
        .select("id, codigo, cliente:clientes(nome)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (lojaId) q = q.eq("loja_id", lojaId);
      const { data } = await q;
      setPedidos((data as any) || []);
    })();
  }, [open, editing, lojaId]);

  async function salvar() {
    if (!form.item?.trim()) return toast.error("Informe o item");
    setSaving(true);
    const payload: any = {
      pedido_id: form.pedido_id || null,
      cliente_nome: form.cliente_nome || null,
      loja_id: lojaId,
      ambiente: form.ambiente || null,
      item: form.item.trim(),
      descricao: form.descricao || null,
      quantidade: Number(form.quantidade) || 1,
      unidade: form.unidade || null,
      fornecedor_nome: form.fornecedor_nome || null,
      status: form.status || "pendente",
      data_prevista: form.data_prevista || null,
      observacoes: form.observacoes || null,
    };

    let error;
    if (editing) {
      ({ error } = await (supabase as any)
        .from("fabrica_requisicoes_compra")
        .update(payload)
        .eq("id", editing.id));
    } else {
      const { data: u } = await supabase.auth.getUser();
      payload.created_by = u?.user?.id || null;
      ({ error } = await (supabase as any)
        .from("fabrica_requisicoes_compra")
        .insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Requisição atualizada" : "Requisição criada");
    onSaved();
  }

  function selecionarPedido(pid: string) {
    const p = pedidos.find((x) => x.id === pid);
    setForm((f: any) => ({ ...f, pedido_id: pid, cliente_nome: p?.cliente?.nome || f.cliente_nome }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar requisição" : "Nova requisição de compra"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Pedido</Label>
            <Select value={form.pedido_id || "none"} onValueChange={(v) => v === "none" ? setForm((f: any) => ({ ...f, pedido_id: null })) : selecionarPedido(v)}>
              <SelectTrigger><SelectValue placeholder="Selecione um pedido (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem pedido —</SelectItem>
                {pedidos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.codigo || p.id.slice(0, 8)} — {p.cliente?.nome || "Sem cliente"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cliente</Label>
            <Input value={form.cliente_nome || ""} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} />
          </div>
          <div>
            <Label>Ambiente</Label>
            <Input value={form.ambiente || ""} onChange={(e) => setForm({ ...form, ambiente: e.target.value })} placeholder="Cozinha, dormitório..." />
          </div>
          <div className="col-span-2">
            <Label>Item *</Label>
            <Input value={form.item || ""} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="Divisor de talheres, puxador especial..." />
          </div>
          <div className="col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input type="number" min={1} value={form.quantidade || 1} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
          </div>
          <div>
            <Label>Unidade</Label>
            <Input value={form.unidade || ""} onChange={(e) => setForm({ ...form, unidade: e.target.value })} placeholder="un, pç, m..." />
          </div>
          <div>
            <Label>Fornecedor</Label>
            <Input value={form.fornecedor_nome || ""} onChange={(e) => setForm({ ...form, fornecedor_nome: e.target.value })} />
          </div>
          <div>
            <Label>Data prevista</Label>
            <Input type="date" value={form.data_prevista || ""} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Status</Label>
            <Select value={form.status || "pendente"} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {editing ? "Salvar" : "Criar requisição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
