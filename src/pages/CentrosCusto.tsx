import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Layers, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type CC = {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number | null;
  ativo: boolean;
};

export default function CentrosCusto() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [list, setList] = useState<CC[]>([]);
  const [busca, setBusca] = useState("");
  const [dialog, setDialog] = useState(false);
  const [edit, setEdit] = useState<Partial<CC> | null>(null);

  async function load() {
    const { data } = await supabase.from("centros_custo")
      .select("id,nome,descricao,ordem,ativo")
      .order("ordem").order("nome");
    setList((data as any as CC[]) || []);
  }
  useEffect(() => { load(); }, []);

  const filtrados = useMemo(() =>
    list.filter((c) =>
      !busca ||
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (c.descricao || "").toLowerCase().includes(busca.toLowerCase())
    ),
    [list, busca],
  );

  async function salvar() {
    if (!edit?.nome) return toast.error("Nome obrigatório");
    const payload: any = {
      nome: edit.nome,
      descricao: edit.descricao || null,
      ordem: edit.ordem ?? 0,
      ativo: edit.ativo ?? true,
      atualizado_por: user?.id ?? null,
    };
    const q = edit.id
      ? supabase.from("centros_custo").update(payload).eq("id", edit.id)
      : supabase.from("centros_custo").insert({ ...payload, criado_por: user?.id ?? null });
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setDialog(false); setEdit(null); load();
  }

  async function remover(c: CC) {
    const { count } = await supabase
      .from("lancamentos_financeiros")
      .select("id", { count: "exact", head: true })
      .eq("centro_custo_id", c.id);
    if ((count ?? 0) > 0) {
      if (!confirm("Este centro de custo possui lançamentos vinculados e não pode ser excluído. Deseja inativá-lo?")) return;
      const { error } = await supabase.from("centros_custo").update({ ativo: false }).eq("id", c.id);
      if (error) return toast.error(error.message);
      toast.success("Centro de custo inativado");
      load();
      return;
    }
    if (!confirm("Excluir centro de custo?")) return;
    const { error } = await supabase.from("centros_custo").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/financeiro"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao Financeiro</Button></Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <Layers className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Centros de Custo</h1>
              <p className="text-sm text-muted-foreground">Áreas/departamentos para classificar lançamentos financeiros</p>
            </div>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEdit({ ativo: true, ordem: 0 }); setDialog(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Novo Centro
          </Button>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar centro de custo..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
                <th className="text-left py-3 px-4">Nome</th>
                <th className="text-left py-3">Descrição</th>
                <th className="text-center py-3">Ordem</th>
                <th className="text-center py-3">Status</th>
                <th className="text-right py-3 px-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className={`border-b hover:bg-muted/30 ${!c.ativo ? "opacity-60" : ""}`}>
                  <td className="py-3 px-4 font-medium">{c.nome}</td>
                  <td className="py-3 text-muted-foreground">{c.descricao || "—"}</td>
                  <td className="py-3 text-center">{c.ordem ?? 0}</td>
                  <td className="py-3 text-center">
                    {c.ativo ? <Badge className="bg-emerald-500/15 text-emerald-700">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {isAdmin && (
                      <div className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEdit(c); setDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remover(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!filtrados.length && (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum centro de custo</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar Centro de Custo" : "Novo Centro de Custo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={edit?.nome || ""} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={edit?.descricao || ""} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} /></div>
            <div><Label>Ordem</Label><Input type="number" value={edit?.ordem ?? 0} onChange={(e) => setEdit({ ...edit, ordem: Number(e.target.value) })} /></div>
            <div className="flex items-center justify-between border rounded-md px-3 py-2">
              <div className="text-sm font-medium">Ativo</div>
              <Switch checked={edit?.ativo ?? true} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
