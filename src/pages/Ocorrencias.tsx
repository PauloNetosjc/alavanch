import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";

type Ocorrencia = {
  id: string;
  codigo: string | null;
  tipo: string;
  prioridade: string | null;
  status: string | null;
  descricao: string | null;
  prazo_resolucao: string | null;
  cliente: { nome: string } | null;
  pedido: { codigo: string } | null;
};

const STATUS = ["aberta", "em_analise", "em_resolucao", "resolvida", "cancelada"];
const PRIO = ["baixa", "media", "alta", "critica"];
const TIPOS = ["Atraso", "Defeito", "Falta de peça", "Reclamação cliente", "Logística", "Outro"];

const prioColor: Record<string, string> = {
  baixa: "bg-slate-500", media: "bg-blue-500",
  alta: "bg-amber-500", critica: "bg-red-500",
};

const statusColor: Record<string, string> = {
  aberta: "bg-red-500", em_analise: "bg-amber-500",
  em_resolucao: "bg-blue-500", resolvida: "bg-emerald-600", cancelada: "bg-slate-500",
};

export default function Ocorrencias() {
  const [list, setList] = useState<Ocorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todas");
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [pedidos, setPedidos] = useState<{ id: string; codigo: string }[]>([]);
  const [form, setForm] = useState({
    cliente_id: "", pedido_id: "", tipo: "Atraso",
    prioridade: "media", descricao: "", prazo_resolucao: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ocorrencias")
      .select("id, codigo, tipo, prioridade, status, descricao, prazo_resolucao, cliente:clientes(nome), pedido:pedidos(codigo)")
      .order("created_at", { ascending: false });
    setList((data || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from("clientes").select("id, nome").order("nome").then(({ data }) => setClientes(data || []));
    supabase.from("pedidos").select("id, codigo").order("codigo").then(({ data }) => setPedidos(data || []));
  }, []);

  const criar = async () => {
    if (!form.tipo || !form.descricao) return toast.error("Preencha tipo e descrição");
    const codigo = `OC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { error } = await supabase.from("ocorrencias").insert({
      codigo,
      cliente_id: form.cliente_id || null,
      pedido_id: form.pedido_id || null,
      tipo: form.tipo,
      prioridade: form.prioridade,
      descricao: form.descricao,
      prazo_resolucao: form.prazo_resolucao || null,
      status: "aberta",
    });
    if (error) return toast.error(error.message);
    toast.success("Ocorrência registrada");
    setOpen(false);
    setForm({ cliente_id: "", pedido_id: "", tipo: "Atraso", prioridade: "media", descricao: "", prazo_resolucao: "" });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("ocorrencias").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const filtered = list.filter((o) => {
    const t = search.toLowerCase();
    const matchTxt = !t || (o.codigo || "").toLowerCase().includes(t) ||
      (o.cliente?.nome || "").toLowerCase().includes(t) ||
      (o.descricao || "").toLowerCase().includes(t);
    const matchStatus = filterStatus === "todas" || o.status === filterStatus;
    return matchTxt && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1>Ocorrências</h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            Registro central de problemas, atrasos e reclamações.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1.5" />Nova Ocorrência</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Ocorrência</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px]">Tipo *</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-[11px]">Cliente</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Pedido</Label>
                <Select value={form.pedido_id} onValueChange={(v) => setForm({ ...form, pedido_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                  <SelectContent>
                    {pedidos.map((p) => <SelectItem key={p.id} value={p.id}>{p.codigo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Prazo resolução</Label>
                <Input type="date" value={form.prazo_resolucao} onChange={(e) => setForm({ ...form, prazo_resolucao: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">Descrição *</Label>
                <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={criar}>Registrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="surface-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {STATUS.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <div className="text-[12px] text-muted-foreground">Nenhuma ocorrência encontrada.</div>
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 px-2 font-normal">Código</th>
                <th className="py-2 px-2 font-normal">Cliente</th>
                <th className="py-2 px-2 font-normal">Pedido</th>
                <th className="py-2 px-2 font-normal">Tipo</th>
                <th className="py-2 px-2 font-normal">Prioridade</th>
                <th className="py-2 px-2 font-normal">Prazo</th>
                <th className="py-2 px-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{o.codigo}</td>
                  <td className="py-2 px-2">{o.cliente?.nome || "—"}</td>
                  <td className="py-2 px-2">{o.pedido?.codigo || "—"}</td>
                  <td className="py-2 px-2">{o.tipo}</td>
                  <td className="py-2 px-2">
                    <Badge className={`text-[10px] text-white capitalize ${prioColor[o.prioridade || "media"]}`}>
                      {o.prioridade}
                    </Badge>
                  </td>
                  <td className="py-2 px-2">
                    {o.prazo_resolucao ? new Date(o.prazo_resolucao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="py-2 px-2">
                    <Select value={o.status || "aberta"} onValueChange={(v) => updateStatus(o.id, v)}>
                      <SelectTrigger className="h-7 w-[150px]">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${statusColor[o.status || "aberta"]}`} />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
