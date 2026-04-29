import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wrench } from "lucide-react";
import { toast } from "sonner";

type Assistencia = {
  id: string;
  codigo: string | null;
  tipo: string;
  prioridade: string | null;
  status: string | null;
  descricao: string | null;
  data_agendamento: string | null;
  cliente: { nome: string } | null;
  pedido: { codigo: string } | null;
};

const STATUS = ["triagem", "agendada", "em_atendimento", "aguardando_material", "concluida", "cancelada"];
const PRIO = ["baixa", "media", "alta", "critica"];
const TIPOS = ["Ajuste", "Reparo", "Substituição", "Garantia", "Outro"];

const statusColor: Record<string, string> = {
  triagem: "bg-slate-500", agendada: "bg-blue-500", em_atendimento: "bg-amber-500",
  aguardando_material: "bg-purple-500", concluida: "bg-emerald-600", cancelada: "bg-red-500",
};

export default function Assistencia() {
  const [list, setList] = useState<Assistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [pedidos, setPedidos] = useState<{ id: string; codigo: string }[]>([]);
  const [form, setForm] = useState({
    cliente_id: "", pedido_id: "", tipo: "Ajuste", prioridade: "media",
    descricao: "", data_agendamento: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("assistencias")
      .select("id, codigo, tipo, prioridade, status, descricao, data_agendamento, cliente:clientes(nome), pedido:pedidos(codigo)")
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
    if (!form.cliente_id || !form.tipo) return toast.error("Preencha cliente e tipo");
    const codigo = `AT-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { error } = await supabase.from("assistencias").insert({
      codigo,
      cliente_id: form.cliente_id,
      pedido_id: form.pedido_id || null,
      tipo: form.tipo,
      prioridade: form.prioridade,
      descricao: form.descricao,
      data_agendamento: form.data_agendamento || null,
      status: "triagem",
    });
    if (error) return toast.error(error.message);
    toast.success("Assistência registrada");
    setOpen(false);
    setForm({ cliente_id: "", pedido_id: "", tipo: "Ajuste", prioridade: "media", descricao: "", data_agendamento: "" });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("assistencias").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1>Assistência Técnica</h1>
          <p className="text-[12px] text-muted-foreground mt-1">Gerencie chamados pós-venda e garantias.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1.5" />Novo Chamado</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo Chamado</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-[11px]">Cliente *</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">Pedido relacionado</Label>
                <Select value={form.pedido_id} onValueChange={(v) => setForm({ ...form, pedido_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                  <SelectContent>
                    {pedidos.map((p) => <SelectItem key={p.id} value={p.id}>{p.codigo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px]">Tipo</Label>
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
                <Label className="text-[11px]">Data agendamento</Label>
                <Input type="date" value={form.data_agendamento} onChange={(e) => setForm({ ...form, data_agendamento: e.target.value })} />
              </div>
              <div>
                <Label className="text-[11px]">Descrição</Label>
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
        {loading ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">Carregando…</div>
        ) : list.length === 0 ? (
          <div className="text-center py-12">
            <Wrench className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <div className="text-[12px] text-muted-foreground">Nenhum chamado cadastrado.</div>
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
                <th className="py-2 px-2 font-normal">Agendamento</th>
                <th className="py-2 px-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{a.codigo}</td>
                  <td className="py-2 px-2">{a.cliente?.nome || "—"}</td>
                  <td className="py-2 px-2">{a.pedido?.codigo || "—"}</td>
                  <td className="py-2 px-2">{a.tipo}</td>
                  <td className="py-2 px-2">
                    <Badge variant="outline" className="text-[10px] capitalize">{a.prioridade}</Badge>
                  </td>
                  <td className="py-2 px-2">{a.data_agendamento ? new Date(a.data_agendamento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="py-2 px-2">
                    <Select value={a.status || "triagem"} onValueChange={(v) => updateStatus(a.id, v)}>
                      <SelectTrigger className="h-7 w-[160px]">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${statusColor[a.status || "triagem"]}`} />
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
