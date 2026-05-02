import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Folder, Plus, Search, ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Cat = { id: string; nome: string; tipo: string; parent_id: string | null; ordem: number | null };

export default function CategoriasFinanceiras() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [tab, setTab] = useState<"saida" | "entrada">("saida");
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState(false);
  const [edit, setEdit] = useState<Partial<Cat> | null>(null);

  async function load() {
    const { data } = await supabase.from("categorias_financeiras").select("*").order("ordem").order("nome");
    setCats((data as Cat[]) || []);
  }
  useEffect(() => { load(); }, []);

  const filhasPor = useMemo(() => {
    const m: Record<string, Cat[]> = {};
    cats.forEach((c) => { if (c.parent_id) (m[c.parent_id] ||= []).push(c); });
    return m;
  }, [cats]);

  const raizes = useMemo(() => {
    return cats
      .filter((c) => !c.parent_id && c.tipo === tab)
      .filter((c) => !busca || c.nome.toLowerCase().includes(busca.toLowerCase()));
  }, [cats, tab, busca]);

  async function salvar() {
    if (!edit?.nome) return toast.error("Nome obrigatório");
    const payload: any = { nome: edit.nome, tipo: edit.tipo || tab, parent_id: edit.parent_id || null };
    const q = edit.id
      ? supabase.from("categorias_financeiras").update(payload).eq("id", edit.id)
      : supabase.from("categorias_financeiras").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setDialog(false); setEdit(null); load();
  }

  async function remover(id: string) {
    if (!confirm("Excluir categoria? As subcategorias também serão afetadas.")) return;
    const { error } = await supabase.from("categorias_financeiras").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="p-8 space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Folder className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Administração de Categorias</h2>
              <p className="text-sm text-muted-foreground">Gerencie categorias e subcategorias financeiras</p>
            </div>
          </div>
          <Button onClick={() => { setEdit({ tipo: tab }); setDialog(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Nova Categoria
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab("saida")} className={`px-5 py-2 rounded-md text-sm font-medium ${tab === "saida" ? "bg-rose-100 text-rose-700" : "bg-muted text-muted-foreground"}`}>
            Categorias a Pagar
          </button>
          <button onClick={() => setTab("entrada")} className={`px-5 py-2 rounded-md text-sm font-medium ${tab === "entrada" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
            Categorias a Receber
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar categoria..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>

        <div className="space-y-2">
          {raizes.map((c) => {
            const filhas = filhasPor[c.id] || [];
            const aberto = open[c.id];
            return (
              <div key={c.id} className="rounded-xl border">
                <div className="flex items-center justify-between px-4 py-3">
                  <button onClick={() => setOpen({ ...open, [c.id]: !aberto })} className="flex items-center gap-3 flex-1 text-left">
                    {filhas.length ? (aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : <span className="w-4" />}
                    <Folder className="w-5 h-5 text-amber-600" />
                    <div>
                      <div className="font-medium">{c.nome}</div>
                      <div className="text-xs text-muted-foreground">{filhas.length} subcategoria{filhas.length !== 1 ? "s" : ""}</div>
                    </div>
                  </button>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEdit({ tipo: tab, parent_id: c.id }); setDialog(true); }}><Plus className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEdit(c); setDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remover(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
                {aberto && filhas.length > 0 && (
                  <div className="border-t bg-muted/20 px-12 py-2 space-y-1">
                    {filhas.map((f) => (
                      <div key={f.id} className="flex items-center justify-between py-1.5">
                        <span className="text-sm">— {f.nome}</span>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEdit(f); setDialog(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => remover(f.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!raizes.length && <div className="text-center py-10 text-muted-foreground">Nenhuma categoria</div>}
        </div>
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={edit?.nome || ""} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></div>
            <div><Label>Categoria pai (opcional)</Label>
              <select className="w-full border rounded-md h-9 px-2 bg-background" value={edit?.parent_id || ""} onChange={(e) => setEdit({ ...edit, parent_id: e.target.value || null })}>
                <option value="">— Nenhuma (categoria raiz) —</option>
                {cats.filter((c) => !c.parent_id && c.tipo === (edit?.tipo || tab) && c.id !== edit?.id).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setDialog(false)}>Cancelar</Button><Button onClick={salvar}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
