import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Lock, Briefcase } from "lucide-react";
import { toast } from "sonner";

type Cargo = {
  id: string;
  nome: string;
  descricao: string | null;
  setor_id: string | null;
  ativo: boolean;
  protegido_sistema: boolean;
  pode_receber_tarefas: boolean;
  pode_ser_responsavel_pedido: boolean;
  ordem: number;
};
type Setor = { id: string; nome: string };

const EMPTY: Partial<Cargo> = {
  nome: "", descricao: "", setor_id: null, ativo: true,
  protegido_sistema: false, pode_receber_tarefas: true,
  pode_ser_responsavel_pedido: true, ordem: 100,
};

export function CargosOperacionaisAdmin() {
  const [items, setItems] = useState<Cargo[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cargo | null>(null);
  const [form, setForm] = useState<Partial<Cargo>>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [a, b] = await Promise.all([
      supabase.from("rh_cargos" as any).select("*").order("ordem").order("nome"),
      supabase.from("rh_setores" as any).select("id,nome").order("nome"),
    ]);
    setItems(((a.data as any) || []) as Cargo[]);
    setSetores(((b.data as any) || []) as Setor[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (c: Cargo) => { setEditing(c); setForm(c); setOpen(true); };

  const salvar = async () => {
    if (!form.nome?.trim()) return toast.error("Nome é obrigatório");
    const payload: any = {
      nome: form.nome.trim(),
      descricao: form.descricao || null,
      setor_id: form.setor_id || null,
      ativo: !!form.ativo,
      pode_receber_tarefas: !!form.pode_receber_tarefas,
      pode_ser_responsavel_pedido: !!form.pode_ser_responsavel_pedido,
      ordem: Number(form.ordem) || 100,
    };
    // protegido_sistema só admin pode mudar; preservar valor existente
    if (editing) payload.protegido_sistema = editing.protegido_sistema;

    const q = editing
      ? supabase.from("rh_cargos" as any).update(payload).eq("id", editing.id)
      : supabase.from("rh_cargos" as any).insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success(editing ? "Cargo atualizado" : "Cargo criado");
    setOpen(false); load();
  };

  const excluir = async (c: Cargo) => {
    if (c.protegido_sistema) return toast.error("Cargo protegido não pode ser excluído");
    const { data: emUso } = await supabase.rpc("rh_cargo_em_uso" as any, { p_cargo_id: c.id });
    if (emUso) {
      if (!confirm("Este cargo está em uso e será apenas desativado para preservar histórico. Continuar?")) return;
      const { error } = await supabase.from("rh_cargos" as any).update({ ativo: false }).eq("id", c.id);
      if (error) return toast.error(error.message);
      toast.success("Cargo desativado");
    } else {
      if (!confirm(`Excluir o cargo "${c.nome}"?`)) return;
      const { error } = await supabase.from("rh_cargos" as any).delete().eq("id", c.id);
      if (error) return toast.error(error.message);
      toast.success("Cargo excluído");
    }
    load();
  };

  const setorNome = (id: string | null) => setores.find(s => s.id === id)?.nome || "—";

  return (
    <div className="space-y-3">
      <div className="surface-card p-3 flex items-center justify-between">
        <div className="text-[13px] text-muted-foreground">
          Cargos operacionais usados pelas tarefas nativas, RH e atribuição de responsáveis.
          Para alterar permissões de acesso, use a aba <strong>Cargos do sistema</strong>.
        </div>
        <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-1" /> Novo cargo</Button>
      </div>

      <div className="surface-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Setor</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Flags</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 font-medium">
                      <Briefcase className="w-3.5 h-3.5 text-primary" />
                      {c.nome}
                      {c.protegido_sistema && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Lock className="w-2.5 h-2.5" /> protegido
                        </Badge>
                      )}
                    </div>
                    {c.descricao && <div className="text-[11px] text-muted-foreground">{c.descricao}</div>}
                  </td>
                  <td className="px-3 py-2">{setorNome(c.setor_id)}</td>
                  <td className="px-3 py-2">
                    {c.ativo
                      ? <Badge variant="default">Ativo</Badge>
                      : <Badge variant="secondary">Inativo</Badge>}
                  </td>
                  <td className="px-3 py-2 space-x-1">
                    {c.pode_receber_tarefas && <Badge variant="outline" className="text-[10px]">tarefas</Badge>}
                    {c.pode_ser_responsavel_pedido && <Badge variant="outline" className="text-[10px]">pedidos</Badge>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => excluir(c)} disabled={c.protegido_sistema}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhum cargo</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cargo" : "Novo cargo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div>
              <Label>Setor</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-[13px]"
                value={form.setor_id || ""}
                onChange={(e) => setForm({ ...form, setor_id: e.target.value || null })}
              >
                <option value="">— Sem setor —</option>
                {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div><Label>Ordem</Label><Input type="number" value={form.ordem ?? 100} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} /></div>
            <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={!!form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /></div>
            <div className="flex items-center justify-between"><Label>Pode receber tarefas</Label><Switch checked={!!form.pode_receber_tarefas} onCheckedChange={(v) => setForm({ ...form, pode_receber_tarefas: v })} /></div>
            <div className="flex items-center justify-between"><Label>Pode ser responsável por pedido</Label><Switch checked={!!form.pode_ser_responsavel_pedido} onCheckedChange={(v) => setForm({ ...form, pode_ser_responsavel_pedido: v })} /></div>
            {editing?.protegido_sistema && (
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" /> Este cargo é protegido pelo sistema e não pode ser excluído.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
