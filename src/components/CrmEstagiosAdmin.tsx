import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
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

export function CrmEstagiosAdmin() {
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("crm_estagios").select("*").order("ordem");
    if (error) toast.error(error.message);
    setEstagios((data ?? []) as Estagio[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const salvar = async (e: Estagio) => {
    const { error } = await supabase.from("crm_estagios").update({
      nome: e.nome, cor: e.cor, ordem: e.ordem,
      is_ganho: e.is_ganho, is_perdido: e.is_perdido, ativo: e.ativo,
    }).eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Estágio salvo");
    load();
  };

  const novo = async () => {
    const ordem = (estagios[estagios.length - 1]?.ordem ?? 0) + 1;
    const { error } = await supabase.from("crm_estagios").insert({
      nome: "Novo estágio", ordem, cor: "#6366F1",
    });
    if (error) return toast.error(error.message);
    load();
  };

  const remover = async (id: string) => {
    if (!confirm("Excluir estágio? Cards desse estágio ficarão sem estágio.")) return;
    const { error } = await supabase.from("crm_estagios").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const mover = async (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= estagios.length) return;
    const a = estagios[idx], b = estagios[next];
    await supabase.from("crm_estagios").update({ ordem: b.ordem }).eq("id", a.id);
    await supabase.from("crm_estagios").update({ ordem: a.ordem }).eq("id", b.id);
    load();
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Estágios do CRM Comercial</h3>
        <Button size="sm" onClick={novo}><Plus className="w-4 h-4 mr-1" /> Novo estágio</Button>
      </div>
      <div className="space-y-2">
        {estagios.map((e, idx) => (
          <div key={e.id} className="surface-card p-3 grid grid-cols-12 gap-2 items-end">
            <div className="col-span-1 flex flex-col gap-1">
              <Button size="icon" variant="ghost" onClick={() => mover(idx, -1)}><ArrowUp className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => mover(idx, 1)}><ArrowDown className="w-4 h-4" /></Button>
            </div>
            <div className="col-span-4">
              <Label className="text-xs">Nome</Label>
              <Input value={e.nome} onChange={(ev) => setEstagios((s) => s.map((x) => x.id === e.id ? { ...x, nome: ev.target.value } : x))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Cor</Label>
              <Input type="color" value={e.cor} onChange={(ev) => setEstagios((s) => s.map((x) => x.id === e.id ? { ...x, cor: ev.target.value } : x))} />
            </div>
            <div className="col-span-1 flex items-center gap-1">
              <Checkbox checked={e.is_ganho} onCheckedChange={(c) => setEstagios((s) => s.map((x) => x.id === e.id ? { ...x, is_ganho: !!c, is_perdido: !!c ? false : x.is_perdido } : x))} />
              <Label className="text-xs">Ganho</Label>
            </div>
            <div className="col-span-1 flex items-center gap-1">
              <Checkbox checked={e.is_perdido} onCheckedChange={(c) => setEstagios((s) => s.map((x) => x.id === e.id ? { ...x, is_perdido: !!c, is_ganho: !!c ? false : x.is_ganho } : x))} />
              <Label className="text-xs">Perdido</Label>
            </div>
            <div className="col-span-1 flex items-center gap-1">
              <Checkbox checked={e.ativo} onCheckedChange={(c) => setEstagios((s) => s.map((x) => x.id === e.id ? { ...x, ativo: !!c } : x))} />
              <Label className="text-xs">Ativo</Label>
            </div>
            <div className="col-span-2 flex gap-1 justify-end">
              <Button size="sm" onClick={() => salvar(e)}>Salvar</Button>
              <Button size="icon" variant="ghost" onClick={() => remover(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
