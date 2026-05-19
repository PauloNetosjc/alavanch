import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tags, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

type Etiqueta = { id: string; nome: string; cor: string; ativo: boolean };

const CORES = ["#7E4FA0", "#2D6BE5", "#3F8B5C", "#A8842A", "#C0392B", "#0F766E", "#DB2777", "#475569"];

export function EtiquetasAdmin() {
  const [rows, setRows] = useState<Etiqueta[]>([]);
  const [novo, setNovo] = useState<{ nome: string; cor: string }>({ nome: "", cor: CORES[0] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("etiquetas" as any).select("*").order("nome");
    if (error) toast.error(error.message);
    setRows(((data as unknown) as Etiqueta[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const criar = async () => {
    if (!novo.nome.trim()) return toast.error("Informe um nome");
    const { error } = await supabase.from("etiquetas" as any).insert({ nome: novo.nome.trim(), cor: novo.cor, ativo: true });
    if (error) return toast.error(error.message);
    setNovo({ nome: "", cor: CORES[0] });
    load();
  };
  const salvar = async (r: Etiqueta) => {
    const { error } = await supabase.from("etiquetas" as any).update({ nome: r.nome, cor: r.cor, ativo: r.ativo }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
  };
  const excluir = async (id: string) => {
    if (!confirm("Excluir etiqueta?")) return;
    const { error } = await supabase.from("etiquetas" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="surface-card p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-4"><Tags className="w-5 h-5 text-[#7E4FA0]" /><h2 className="text-[18px] font-semibold">Etiquetas de Pedido</h2></div>

      <div className="flex items-end gap-3 mb-4 border-b pb-4">
        <div className="flex-1"><Label>Nome</Label><Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Ex.: Prioritário" /></div>
        <div>
          <Label>Cor</Label>
          <div className="flex gap-1">
            {CORES.map(c => (
              <button key={c} type="button" onClick={() => setNovo({ ...novo, cor: c })}
                className="w-6 h-6 rounded-full border-2" style={{ background: c, borderColor: novo.cor === c ? "#000" : "transparent" }} />
            ))}
          </div>
        </div>
        <Button onClick={criar}><Plus className="w-4 h-4 mr-1" />Criar</Button>
      </div>

      {loading ? <div className="text-center py-6 text-muted-foreground text-[13px]">Carregando…</div> : (
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={r.id} className="flex items-center gap-3 border rounded-lg px-3 py-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: r.cor }} />
              <Input className="flex-1" value={r.nome} onChange={(e) => setRows(rs => rs.map((x, i) => i === idx ? { ...x, nome: e.target.value } : x))} />
              <div className="flex gap-1">
                {CORES.map(c => (
                  <button key={c} type="button" onClick={() => setRows(rs => rs.map((x, i) => i === idx ? { ...x, cor: c } : x))}
                    className="w-5 h-5 rounded-full border-2" style={{ background: c, borderColor: r.cor === c ? "#000" : "transparent" }} />
                ))}
              </div>
              <Switch checked={r.ativo} onCheckedChange={(v) => setRows(rs => rs.map((x, i) => i === idx ? { ...x, ativo: v } : x))} />
              <Button size="sm" variant="outline" onClick={() => salvar(r)}><Save className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="outline" className="text-red-600" onClick={() => excluir(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
          {rows.length === 0 && <div className="text-center py-6 text-muted-foreground text-[13px]">Nenhuma etiqueta cadastrada.</div>}
        </div>
      )}
    </div>
  );
}
