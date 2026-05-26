import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

type Forma = { id: string; nome: string; ativo: boolean; ordem: number };

export function FormasPagamentoButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Tag className="w-4 h-4 mr-1.5" /> Formas de Pagamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Formas de Pagamento</DialogTitle>
        </DialogHeader>
        <FormasPagamentoAdmin />
      </DialogContent>
    </Dialog>
  );
}

export function FormasPagamentoAdmin() {
  const [items, setItems] = useState<Forma[]>([]);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("formas_pagamento")
      .select("id, nome, ativo, ordem")
      .order("ordem")
      .order("nome");
    if (error) return toast.error(error.message);
    setItems((data || []) as Forma[]);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    const v = nome.trim();
    if (!v) return toast.error("Informe um nome");
    setLoading(true);
    const nextOrdem = (items[items.length - 1]?.ordem ?? 0) + 1;
    const { error } = await supabase.from("formas_pagamento").insert({ nome: v, ordem: nextOrdem, ativo: true });
    setLoading(false);
    if (error) return toast.error(error.message);
    setNome("");
    toast.success("Forma adicionada");
    load();
  };

  const toggle = async (f: Forma) => {
    const { error } = await supabase.from("formas_pagamento").update({ ativo: !f.ativo }).eq("id", f.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (f: Forma) => {
    if (!confirm(`Excluir "${f.nome}"?`)) return;
    const { error } = await supabase.from("formas_pagamento").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("Excluída");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nova forma de pagamento (ex.: Vale Presente)"
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          maxLength={60}
        />
        <Button onClick={add} disabled={loading}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      <div className="border border-border rounded-md divide-y divide-border">
        {items.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma forma cadastrada</div>
        ) : items.map((f) => (
          <div key={f.id} className="flex items-center gap-3 px-3 py-2">
            <Switch checked={f.ativo} onCheckedChange={() => toggle(f)} />
            <div className={`flex-1 text-[13px] ${f.ativo ? "" : "text-muted-foreground line-through"}`}>{f.nome}</div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(f)} title="Excluir (admin)">
              <Trash2 className="w-4 h-4 text-rose-500" />
            </Button>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Apenas administradores podem excluir. Formas inativas não aparecem nos métodos de pagamento.
      </p>
    </div>
  );
}
