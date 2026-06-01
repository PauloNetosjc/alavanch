import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Wrench, Loader2 } from "lucide-react";
import { toast } from "sonner";

type S = {
  id: string; loja_id: string | null; nome: string; descricao: string | null;
  codigo_lc116: string | null; codigo_servico_municipal: string | null;
  cnae: string | null; aliquota_iss: number | null; iss_retido: boolean;
  municipio_incidencia: string | null; ativo: boolean;
};

const empty = (lojaId: string): Partial<S> => ({ loja_id: lojaId, nome: "", ativo: true, iss_retido: false });

export function ServicosFiscaisPanel() {
  const { selectedLojaId } = useLoja();
  const [rows, setRows] = useState<S[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("ativos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<S | null>(null);
  const [form, setForm] = useState<Partial<S>>(empty(""));
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!selectedLojaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("servicos_fiscais" as any)
      .select("*")
      .or(`loja_id.eq.${selectedLojaId},loja_id.is.null`)
      .order("nome");
    setRows((data || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, [selectedLojaId]);

  const lista = useMemo(() => rows.filter((r) => {
    if (filtro === "ativos" && !r.ativo) return false;
    if (filtro === "inativos" && r.ativo) return false;
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return r.nome.toLowerCase().includes(q) || (r.codigo_lc116 || "").includes(q);
  }), [rows, busca, filtro]);

  const abrirNovo = () => { setEditing(null); setForm(empty(selectedLojaId!)); setOpen(true); };
  const abrirEdit = (s: S) => { setEditing(s); setForm({ ...s }); setOpen(true); };

  const salvar = async () => {
    if (!form.nome?.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    try {
      const payload: any = { ...form, loja_id: form.loja_id || selectedLojaId };
      delete payload.id;
      if (editing) {
        const { error } = await supabase.from("servicos_fiscais" as any).update(payload).eq("id", editing.id);
        if (error) throw error; toast.success("Serviço atualizado");
      } else {
        const { error } = await supabase.from("servicos_fiscais" as any).insert(payload);
        if (error) throw error; toast.success("Serviço criado");
      }
      setOpen(false); load();
    } catch (e: any) { toast.error(e?.message || "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  const inativar = async (s: S) => {
    await supabase.from("servicos_fiscais" as any).update({ ativo: !s.ativo } as any).eq("id", s.id);
    load();
  };

  if (!selectedLojaId) return <Card className="p-6 text-sm text-muted-foreground">Selecione uma loja no topo.</Card>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-display flex items-center gap-2"><Wrench className="w-5 h-5"/> Serviços Fiscais</h2>
        <Button onClick={abrirNovo} className="gap-2"><Plus className="w-4 h-4"/> Novo serviço fiscal</Button>
      </div>

      <Card className="p-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
            <Input className="pl-7" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou LC116"/>
          </div>
        </div>
        <div className="min-w-[160px]">
          <Label className="text-xs">Status</Label>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>
        ) : lista.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum serviço cadastrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase">
                <tr>
                  <th className="text-left p-2">Nome</th>
                  <th className="text-left p-2">LC 116</th>
                  <th className="text-left p-2">Código Municipal</th>
                  <th className="text-left p-2">ISS%</th>
                  <th className="text-left p-2">Retido</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-right p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-2">{s.nome}</td>
                    <td className="p-2 text-xs">{s.codigo_lc116 || "—"}</td>
                    <td className="p-2 text-xs">{s.codigo_servico_municipal || "—"}</td>
                    <td className="p-2 text-xs">{s.aliquota_iss ?? "—"}</td>
                    <td className="p-2 text-xs">{s.iss_retido ? "Sim" : "Não"}</td>
                    <td className="p-2"><Badge variant={s.ativo ? "default" : "secondary"}>{s.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => abrirEdit(s)}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => inativar(s)}>{s.ativo ? "Inativar" : "Reativar"}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar serviço fiscal" : "Novo serviço fiscal"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome *</Label><Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })}/></div>
            <div className="col-span-2"><Label>Descrição</Label><Input value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })}/></div>
            <div><Label>Código LC 116</Label><Input value={form.codigo_lc116 || ""} onChange={(e) => setForm({ ...form, codigo_lc116: e.target.value })}/></div>
            <div><Label>Código de serviço municipal</Label><Input value={form.codigo_servico_municipal || ""} onChange={(e) => setForm({ ...form, codigo_servico_municipal: e.target.value })}/></div>
            <div><Label>CNAE</Label><Input value={form.cnae || ""} onChange={(e) => setForm({ ...form, cnae: e.target.value })}/></div>
            <div><Label>Alíquota ISS (%)</Label><Input type="number" step="0.01" value={form.aliquota_iss ?? ""} onChange={(e) => setForm({ ...form, aliquota_iss: e.target.value ? parseFloat(e.target.value) : null })}/></div>
            <div><Label>Município de incidência</Label><Input value={form.municipio_incidencia || ""} onChange={(e) => setForm({ ...form, municipio_incidencia: e.target.value })}/></div>
            <label className="flex items-center gap-2 mt-6">
              <Switch checked={!!form.iss_retido} onCheckedChange={(v) => setForm({ ...form, iss_retido: v })}/>
              <span className="text-sm">ISS retido na fonte</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2"/>}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
