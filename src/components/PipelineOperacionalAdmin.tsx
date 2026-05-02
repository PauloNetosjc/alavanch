import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

type Estagio = { id: string; nome: string; ordem: number; cor: string | null; ativo: boolean };

export function PipelineOperacionalAdmin() {
  const [list, setList] = useState<Estagio[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pipeline_estagios")
      .select("id,nome,ordem,cor,ativo")
      .eq("pipeline", "operacional")
      .order("ordem");
    if (error) toast.error(error.message);
    setList((data ?? []) as Estagio[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const salvar = async (e: Estagio) => {
    const { error } = await supabase.from("pipeline_estagios")
      .update({ nome: e.nome, cor: e.cor, ordem: e.ordem, ativo: e.ativo })
      .eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Estágio salvo");
    load();
  };

  const remover = async (id: string) => {
    if (!confirm("Remover este estágio?")) return;
    const { error } = await supabase.from("pipeline_estagios").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Estágio removido");
    load();
  };

  const adicionar = async () => {
    const ordem = (list[list.length - 1]?.ordem ?? 0) + 1;
    const { error } = await supabase.from("pipeline_estagios").insert({
      pipeline: "operacional", nome: "Novo estágio", ordem, cor: "#6b7280", ativo: true,
    } as any);
    if (error) return toast.error(error.message);
    load();
  };

  const mover = (idx: number, dir: -1 | 1) => {
    const novo = [...list];
    const j = idx + dir;
    if (j < 0 || j >= novo.length) return;
    [novo[idx].ordem, novo[j].ordem] = [novo[j].ordem, novo[idx].ordem];
    Promise.all([salvar(novo[idx]), salvar(novo[j])]);
  };

  if (loading) return <div className="text-[12px] text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Estágios do Kanban Operacional</Label>
          <p className="text-[11px] text-muted-foreground">Edite, reordene ou desative os estágios da produção.</p>
        </div>
        <Button onClick={adicionar} size="sm"><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
      </div>
      <div className="space-y-2">
        {list.map((e, idx) => (
          <div key={e.id} className="flex items-center gap-2 border border-border rounded-lg p-2">
            <span className="text-[11px] text-muted-foreground w-6">{e.ordem}</span>
            <input
              type="color"
              value={e.cor || "#6b7280"}
              onChange={(ev) => setList(list.map(x => x.id === e.id ? { ...x, cor: ev.target.value } : x))}
              onBlur={() => salvar(e)}
              className="w-8 h-8 rounded border border-border"
            />
            <Input
              value={e.nome}
              onChange={(ev) => setList(list.map(x => x.id === e.id ? { ...x, nome: ev.target.value } : x))}
              onBlur={() => salvar(e)}
              className="flex-1"
            />
            <label className="flex items-center gap-1 text-[11px]">
              <input
                type="checkbox"
                checked={e.ativo}
                onChange={(ev) => { const v = ev.target.checked; setList(list.map(x => x.id === e.id ? { ...x, ativo: v } : x)); salvar({ ...e, ativo: v }); }}
              /> Ativo
            </label>
            <Button variant="ghost" size="icon" onClick={() => mover(idx, -1)}><ArrowUp className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => mover(idx, 1)}><ArrowDown className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => remover(e.id)}>
              <Trash2 className="w-4 h-4 text-rose-500" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
