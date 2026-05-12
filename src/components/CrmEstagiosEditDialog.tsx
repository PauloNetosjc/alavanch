import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, GripVertical, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Settings } from "lucide-react";
import { toast } from "sonner";

type Estagio = {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
  is_ganho: boolean;
  is_perdido: boolean;
  ativo: boolean;
};

export function CrmEstagiosEditDialog({
  open, onOpenChange, onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Estagio[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("crm_estagios").select("*").order("ordem");
    setRows((data ?? []) as Estagio[]);
    setRemovidos([]);
    setExpandido({});
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

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

  const remove = (i: number) => {
    const row = rows[i];
    if (!row.id.startsWith("new-")) {
      if (!confirm(`Excluir estágio "${row.nome}"? Cards podem ser afetados.`)) return;
      setRemovidos((arr) => [...arr, row.id]);
    }
    setRows((r) => r.filter((_, idx) => idx !== i));
  };

  const addNew = () => {
    setRows((r) => [
      ...r,
      {
        id: `new-${Date.now()}`,
        nome: "Novo estágio",
        ordem: r.length + 1,
        cor: "#6b7280",
        is_ganho: false,
        is_perdido: false,
        ativo: true,
      },
    ]);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (removidos.length) {
        const { error } = await supabase.from("crm_estagios").delete().in("id", removidos);
        if (error) throw error;
      }
      for (const [i, row] of rows.entries()) {
        const payload = {
          nome: row.nome,
          ordem: i + 1,
          cor: row.cor,
          is_ganho: row.is_ganho,
          is_perdido: row.is_perdido,
          ativo: row.ativo,
        };
        if (row.id.startsWith("new-")) {
          const { error } = await supabase.from("crm_estagios").insert(payload);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("crm_estagios").update(payload).eq("id", row.id);
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
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>Editar estágios — CRM Comercial</DialogTitle></DialogHeader>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Carregando…</div>
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {rows.map((r, i) => {
              const aberto = !!expandido[r.id];
              return (
              <div key={r.id} className="border rounded-lg p-2 space-y-2">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-1 flex flex-col items-center gap-0.5 text-muted-foreground">
                    <button onClick={() => move(i, -1)} className="hover:text-foreground"><ArrowUp className="w-3 h-3" /></button>
                    <GripVertical className="w-3 h-3" />
                    <button onClick={() => move(i, 1)} className="hover:text-foreground"><ArrowDown className="w-3 h-3" /></button>
                  </div>
                  <Input className="col-span-6" value={r.nome} onChange={(e) => update(i, { nome: e.target.value })} placeholder="Nome do estágio" />
                  <Input className="col-span-1" type="color" value={r.cor || "#6366F1"} onChange={(e) => update(i, { cor: e.target.value })} />
                  <div className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex h-2 w-2 rounded-full" style={{ background: r.cor || "#6b7280" }} />
                    {r.ativo ? "Ativo" : "Inativo"}
                  </div>
                  <Button variant="ghost" size="sm" className="col-span-1" onClick={() => setExpandido((x) => ({ ...x, [r.id]: !aberto }))} title="Configurações">
                    {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <Settings className="w-3 h-3 ml-0.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="col-span-1 text-destructive" onClick={() => remove(i)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {aberto && (
                  <div className="ml-8 border-l-2 pl-3 bg-muted/20 p-2 rounded">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex items-center gap-2"><Switch checked={r.is_ganho} onCheckedChange={(c) => update(i, { is_ganho: c, is_perdido: c ? false : r.is_perdido })} /><Label className="text-xs">Pipe de ganho/concluído</Label></div>
                      <div className="flex items-center gap-2"><Switch checked={r.is_perdido} onCheckedChange={(c) => update(i, { is_perdido: c, is_ganho: c ? false : r.is_ganho })} /><Label className="text-xs">Pipe de perdido</Label></div>
                      <div className="flex items-center gap-2"><Switch checked={r.ativo} onCheckedChange={(c) => update(i, { ativo: c })} /><Label className="text-xs">Pipe ativo</Label></div>
                    </div>
                  </div>
                )}
              </div>
              );
            })}
            <Button variant="outline" className="w-full gap-1" onClick={addNew}>
              <Plus className="w-4 h-4" /> Novo estágio
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
