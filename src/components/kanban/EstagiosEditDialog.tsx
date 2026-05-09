import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

type Estagio = {
  id: string;
  pipeline: string;
  nome: string;
  ordem: number;
  cor: string | null;
  ativo: boolean;
  checklist_template_id: string | null;
};
type Template = { id: string; nome: string; tipo_servico: string };

export function EstagiosEditDialog({
  open, onOpenChange, pipeline, onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipeline: string;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Estagio[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: ests }, { data: tpls }] = await Promise.all([
      (supabase as any).from("pipeline_estagios").select("*").eq("pipeline", pipeline).order("ordem"),
      supabase.from("checklist_templates").select("id,nome,tipo_servico").eq("ativo", true).order("nome"),
    ]);
    setRows((ests ?? []) as Estagio[]);
    setTemplates((tpls ?? []) as Template[]);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open, pipeline]);

  const update = (i: number, patch: Partial<Estagio>) => {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };

  const move = (i: number, dir: -1 | 1) => {
    setRows((r) => {
      const arr = [...r];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr.map((x, idx) => ({ ...x, ordem: idx + 1 }));
    });
  };

  const remove = async (i: number) => {
    const row = rows[i];
    if (!row.id.startsWith("new-")) {
      if (!confirm(`Excluir estágio "${row.nome}"? Cards podem ser afetados.`)) return;
      const { error } = await (supabase as any).from("pipeline_estagios").delete().eq("id", row.id);
      if (error) return toast.error(error.message);
    }
    setRows((r) => r.filter((_, idx) => idx !== i));
  };

  const addNew = () => {
    setRows((r) => [
      ...r,
      { id: `new-${Date.now()}`, pipeline, nome: "Novo estágio", ordem: r.length + 1, cor: "#6b7280", ativo: true, checklist_template_id: null },
    ]);
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const [i, row] of rows.entries()) {
        const payload = { nome: row.nome, ordem: i + 1, cor: row.cor, ativo: row.ativo, checklist_template_id: row.checklist_template_id };
        if (row.id.startsWith("new-")) {
          const { error } = await (supabase as any).from("pipeline_estagios").insert({ pipeline, ...payload });
          if (error) throw error;
        } else {
          const { error } = await (supabase as any).from("pipeline_estagios").update(payload).eq("id", row.id);
          if (error) throw error;
        }
      }
      toast.success("Estágios salvos");
      onChanged();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Editar estágios — {pipeline}</DialogTitle></DialogHeader>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Carregando…</div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {rows.map((r, i) => (
              <div key={r.id} className="grid grid-cols-12 gap-2 items-center border rounded-lg p-2">
                <div className="col-span-1 flex flex-col items-center gap-0.5 text-muted-foreground">
                  <button onClick={() => move(i, -1)} className="hover:text-foreground"><ArrowUp className="w-3 h-3" /></button>
                  <GripVertical className="w-3 h-3" />
                  <button onClick={() => move(i, 1)} className="hover:text-foreground"><ArrowDown className="w-3 h-3" /></button>
                </div>
                <Input className="col-span-4" value={r.nome} onChange={(e) => update(i, { nome: e.target.value })} placeholder="Nome do estágio" />
                <Input className="col-span-2" type="color" value={r.cor || "#6b7280"} onChange={(e) => update(i, { cor: e.target.value })} />
                <Select value={r.checklist_template_id ?? "none"} onValueChange={(v) => update(i, { checklist_template_id: v === "none" ? null : v })}>
                  <SelectTrigger className="col-span-4"><SelectValue placeholder="Modelo de checklist" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem checklist —</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="col-span-1 text-destructive" onClick={() => remove(i)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={addNew} className="w-full"><Plus className="w-4 h-4 mr-1" /> Novo estágio</Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
