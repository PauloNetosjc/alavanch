import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";

type P = {
  id: string; loja_id: string | null; nome: string; descricao: string | null;
  ncm: string | null; cest: string | null; cfop_padrao: string | null;
  origem_mercadoria: number | null; cst_icms: string | null; csosn: string | null;
  cst_pis: string | null; cst_cofins: string | null; cst_ipi: string | null;
  unidade_comercial: string | null; unidade_tributavel: string | null;
  aliquota_icms: number | null; aliquota_pis: number | null;
  aliquota_cofins: number | null; aliquota_ipi: number | null;
  ativo: boolean;
};

const empty = (lojaId: string): Partial<P> => ({
  loja_id: lojaId, nome: "", ativo: true, unidade_comercial: "UN", unidade_tributavel: "UN",
});

export function ProdutosFiscaisPanel() {
  const { selectedLojaId } = useLoja();
  const [rows, setRows] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("ativos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<P | null>(null);
  const [form, setForm] = useState<Partial<P> & { grupo_tributario?: string; operacao_fiscal_padrao_id?: string | null }>(empty(""));
  const [saving, setSaving] = useState(false);
  const [ops, setOps] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedLojaId) return;
    supabase.from("fiscal_operacoes" as any).select("id,nome,codigo_cfop").eq("ativo", true)
      .or(`loja_id.eq.${selectedLojaId},loja_id.is.null`).order("nome")
      .then(({ data }) => setOps((data as any) || []));
  }, [selectedLojaId]);


  const load = async () => {
    if (!selectedLojaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("produtos_fiscais" as any)
      .select("*")
      .or(`loja_id.eq.${selectedLojaId},loja_id.is.null`)
      .order("nome");
    setRows((data || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, [selectedLojaId]);

  const lista = useMemo(() => {
    return rows.filter((r) => {
      if (filtro === "ativos" && !r.ativo) return false;
      if (filtro === "inativos" && r.ativo) return false;
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return r.nome.toLowerCase().includes(q) || (r.ncm || "").includes(q);
    });
  }, [rows, busca, filtro]);

  const abrirNovo = () => { setEditing(null); setForm(empty(selectedLojaId!)); setOpen(true); };
  const abrirEdit = (p: P) => { setEditing(p); setForm({ ...p }); setOpen(true); };

  const salvar = async () => {
    if (!form.nome?.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    try {
      const payload: any = { ...form, loja_id: form.loja_id || selectedLojaId };
      delete payload.id;
      if (editing) {
        const { error } = await supabase.from("produtos_fiscais" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Produto fiscal atualizado");
      } else {
        const { error } = await supabase.from("produtos_fiscais" as any).insert(payload);
        if (error) throw error;
        toast.success("Produto fiscal criado");
      }
      setOpen(false); load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const inativar = async (p: P) => {
    await supabase.from("produtos_fiscais" as any).update({ ativo: !p.ativo } as any).eq("id", p.id);
    load();
  };

  if (!selectedLojaId) return <Card className="p-6 text-sm text-muted-foreground">Selecione uma loja no topo.</Card>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-display flex items-center gap-2"><Package className="w-5 h-5"/> Produtos Fiscais</h2>
        <Button onClick={abrirNovo} className="gap-2"><Plus className="w-4 h-4"/> Novo produto fiscal</Button>
      </div>

      <Card className="p-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
            <Input className="pl-7" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou NCM"/>
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
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum produto cadastrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase">
                <tr>
                  <th className="text-left p-2">Nome</th>
                  <th className="text-left p-2">NCM</th>
                  <th className="text-left p-2">CFOP</th>
                  <th className="text-left p-2">Unid.</th>
                  <th className="text-left p-2">ICMS%</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-right p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">{p.nome}</td>
                    <td className="p-2 text-xs">{p.ncm || "—"}</td>
                    <td className="p-2 text-xs">{p.cfop_padrao || "—"}</td>
                    <td className="p-2 text-xs">{p.unidade_comercial || "—"}</td>
                    <td className="p-2 text-xs">{p.aliquota_icms ?? "—"}</td>
                    <td className="p-2"><Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => abrirEdit(p)}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => inativar(p)}>{p.ativo ? "Inativar" : "Reativar"}</Button>
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
            <DialogTitle>{editing ? "Editar produto fiscal" : "Novo produto fiscal"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome *</Label><Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })}/></div>
            <div className="col-span-2"><Label>Descrição</Label><Input value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })}/></div>
            <div><Label>NCM</Label><Input value={form.ncm || ""} onChange={(e) => setForm({ ...form, ncm: e.target.value })}/></div>
            <div><Label>CEST</Label><Input value={form.cest || ""} onChange={(e) => setForm({ ...form, cest: e.target.value })}/></div>
            <div><Label>CFOP padrão</Label><Input value={form.cfop_padrao || ""} onChange={(e) => setForm({ ...form, cfop_padrao: e.target.value })}/></div>
            <div><Label>Origem da mercadoria (0-8)</Label><Input type="number" value={form.origem_mercadoria ?? ""} onChange={(e) => setForm({ ...form, origem_mercadoria: e.target.value ? parseInt(e.target.value) : null })}/></div>
            <div><Label>CST ICMS</Label><Input value={form.cst_icms || ""} onChange={(e) => setForm({ ...form, cst_icms: e.target.value })}/></div>
            <div><Label>CSOSN</Label><Input value={form.csosn || ""} onChange={(e) => setForm({ ...form, csosn: e.target.value })}/></div>
            <div><Label>CST PIS</Label><Input value={form.cst_pis || ""} onChange={(e) => setForm({ ...form, cst_pis: e.target.value })}/></div>
            <div><Label>CST COFINS</Label><Input value={form.cst_cofins || ""} onChange={(e) => setForm({ ...form, cst_cofins: e.target.value })}/></div>
            <div><Label>CST IPI</Label><Input value={form.cst_ipi || ""} onChange={(e) => setForm({ ...form, cst_ipi: e.target.value })}/></div>
            <div><Label>Unidade comercial</Label><Input value={form.unidade_comercial || ""} onChange={(e) => setForm({ ...form, unidade_comercial: e.target.value })}/></div>
            <div><Label>Unidade tributável</Label><Input value={form.unidade_tributavel || ""} onChange={(e) => setForm({ ...form, unidade_tributavel: e.target.value })}/></div>
            <div><Label>Alíquota ICMS (%)</Label><Input type="number" step="0.01" value={form.aliquota_icms ?? ""} onChange={(e) => setForm({ ...form, aliquota_icms: e.target.value ? parseFloat(e.target.value) : null })}/></div>
            <div><Label>Alíquota PIS (%)</Label><Input type="number" step="0.01" value={form.aliquota_pis ?? ""} onChange={(e) => setForm({ ...form, aliquota_pis: e.target.value ? parseFloat(e.target.value) : null })}/></div>
            <div><Label>Alíquota COFINS (%)</Label><Input type="number" step="0.01" value={form.aliquota_cofins ?? ""} onChange={(e) => setForm({ ...form, aliquota_cofins: e.target.value ? parseFloat(e.target.value) : null })}/></div>
            <div><Label>Alíquota IPI (%)</Label><Input type="number" step="0.01" value={form.aliquota_ipi ?? ""} onChange={(e) => setForm({ ...form, aliquota_ipi: e.target.value ? parseFloat(e.target.value) : null })}/></div>
            <div>
              <Label>Grupo tributário</Label>
              <Select value={(form as any).grupo_tributario || ""} onValueChange={(v) => setForm({ ...form, grupo_tributario: v } as any)}>
                <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nacional">Nacional</SelectItem>
                  <SelectItem value="importado">Importado</SelectItem>
                  <SelectItem value="substituicao_tributaria">Substituição Tributária</SelectItem>
                  <SelectItem value="isento">Isento</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Operação fiscal padrão</Label>
              <Select value={(form as any).operacao_fiscal_padrao_id || ""} onValueChange={(v) => setForm({ ...form, operacao_fiscal_padrao_id: v } as any)}>
                <SelectTrigger><SelectValue placeholder="—"/></SelectTrigger>
                <SelectContent>
                  {ops.map((o) => <SelectItem key={o.id} value={o.id}>{o.codigo_cfop ? `${o.codigo_cfop} — ` : ""}{o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
