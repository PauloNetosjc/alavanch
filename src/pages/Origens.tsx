import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tags, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Row = { id: string; nome: string; ativo: boolean };

export default function Origens() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);
  const [form, setForm] = useState({ nome: "", ativo: true });

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("origens_lead").select("*").order("nome");
    setRows((data as Row[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function novo() {
    setEdit(null);
    setForm({ nome: "", ativo: true });
    setOpen(true);
  }
  function editar(r: Row) {
    setEdit(r);
    setForm({ nome: r.nome, ativo: r.ativo });
    setOpen(true);
  }
  async function salvar() {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (edit) {
      const { error } = await supabase.from("origens_lead").update(form).eq("id", edit.id);
      if (error) return toast.error(error.message);
      toast.success("Origem atualizada");
    } else {
      const { error } = await supabase.from("origens_lead").insert(form);
      if (error) return toast.error(error.message);
      toast.success("Origem criada");
    }
    setOpen(false);
    load();
  }
  async function excluir(r: Row) {
    if (!confirm(`Excluir "${r.nome}"?`)) return;
    const { error } = await supabase.from("origens_lead").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Origem excluída");
    load();
  }

  return (
    <div>
      <PageHeader icon={Tags} title="Origens de Lead" subtitle="Canais de captação de clientes" />
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={novo}><Plus className="w-3.5 h-3.5 mr-1.5" />Nova origem</Button>
      </div>
      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-[13px]">Carregando…</div>
      ) : (
        <div className="border rounded-md divide-y">
          {rows.length === 0 && <div className="p-6 text-center text-muted-foreground text-[13px]">Nenhuma origem cadastrada.</div>}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1">
                <div className="text-[13px] font-medium">{r.nome}</div>
                <div className="text-[11px] text-muted-foreground">{r.ativo ? "Ativo" : "Inativo"}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => editar(r)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => excluir(r)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Editar origem" : "Nova origem"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
