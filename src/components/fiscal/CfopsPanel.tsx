import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Pencil, Power } from "lucide-react";
import { toast } from "sonner";

type Cfop = {
  id: string; codigo: string; descricao: string;
  tipo_movimento: "entrada" | "saida";
  categoria: string; ativo: boolean; observacoes: string | null;
};

const CATS = ["venda","compra","devolucao","remessa","retorno","entrega_futura","industrializacao","transferencia","outro"];

export function CfopsPanel() {
  const [list, setList] = useState<Cfop[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<Cfop> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("fiscal_cfops" as any).select("*").order("codigo");
    setList((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = list.filter((c) =>
    !q || c.codigo.includes(q) || c.descricao.toLowerCase().includes(q.toLowerCase())
  );

  const salvar = async () => {
    if (!edit?.codigo || !edit?.descricao) { toast.error("Código e descrição obrigatórios"); return; }
    setSaving(true);
    try {
      const payload: any = {
        codigo: edit.codigo, descricao: edit.descricao,
        tipo_movimento: edit.tipo_movimento || "saida",
        categoria: edit.categoria || "venda",
        ativo: edit.ativo ?? true,
        observacoes: edit.observacoes || null,
      };
      if (edit.id) {
        const { error } = await supabase.from("fiscal_cfops" as any).update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fiscal_cfops" as any).insert(payload);
        if (error) throw error;
      }
      toast.success("CFOP salvo");
      setEdit(null);
      load();
    } catch (e: any) { toast.error(e?.message); } finally { setSaving(false); }
  };

  const toggleAtivo = async (c: Cfop) => {
    await supabase.from("fiscal_cfops" as any).update({ ativo: !c.ativo }).eq("id", c.id);
    load();
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-medium">CFOPs</h3>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground"/>
            <Input className="pl-7 h-9 w-64" placeholder="Buscar por código ou descrição" value={q} onChange={(e) => setQ(e.target.value)}/>
          </div>
          <Button size="sm" onClick={() => setEdit({ tipo_movimento: "saida", categoria: "venda", ativo: true })} className="gap-1">
            <Plus className="w-3.5 h-3.5"/> Novo CFOP
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Código</th>
              <th className="text-left p-2">Descrição</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Categoria</th>
              <th className="text-left p-2">Ativo</th>
              <th className="text-right p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="p-2 font-mono">{c.codigo}</td>
                <td className="p-2">{c.descricao}</td>
                <td className="p-2 capitalize">{c.tipo_movimento}</td>
                <td className="p-2"><Badge variant="outline" className="capitalize">{c.categoria.replace("_"," ")}</Badge></td>
                <td className="p-2">{c.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</td>
                <td className="p-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEdit(c)}><Pencil className="w-3.5 h-3.5"/></Button>
                  <Button size="icon" variant="ghost" onClick={() => toggleAtivo(c)}><Power className="w-3.5 h-3.5"/></Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-xs">Nenhum CFOP encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar" : "Novo"} CFOP</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código *</Label><Input value={edit?.codigo || ""} onChange={(e) => setEdit({ ...edit, codigo: e.target.value })}/></div>
              <div>
                <Label>Tipo movimento</Label>
                <Select value={edit?.tipo_movimento || "saida"} onValueChange={(v: any) => setEdit({ ...edit, tipo_movimento: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="entrada">Entrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descrição *</Label><Input value={edit?.descricao || ""} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })}/></div>
            <div>
              <Label>Categoria</Label>
              <Select value={edit?.categoria || "venda"} onValueChange={(v) => setEdit({ ...edit, categoria: v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c.replace("_"," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea value={edit?.observacoes || ""} onChange={(e) => setEdit({ ...edit, observacoes: e.target.value })}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
