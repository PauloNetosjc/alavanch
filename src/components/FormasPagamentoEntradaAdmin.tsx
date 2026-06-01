import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Wallet, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Entrada = {
  id: string;
  nome: string;
  forma_pagamento: string;
  forma_pagamento_id: string | null;
  percentual_desconto: number;
  ativo: boolean;
  observacoes: string | null;
};

const FORMAS_FALLBACK = ["Boleto", "PIX", "Cartão de Crédito", "Cartão de Débito", "Dinheiro", "Transferência", "Cheque", "Crediário Próprio"];

function blank(): Entrada {
  return { id: "", nome: "", forma_pagamento: "Boleto", forma_pagamento_id: null, percentual_desconto: 20, ativo: true, observacoes: "" };
}

export function FormasPagamentoEntradaAdmin() {
  const [rows, setRows] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Entrada | null>(null);
  const [open, setOpen] = useState(false);
  const [FORMAS, setFORMAS] = useState<{ id: string; nome: string }[]>(
    FORMAS_FALLBACK.map((n) => ({ id: "", nome: n })),
  );

  useEffect(() => {
    supabase.from("formas_pagamento").select("id, nome").eq("ativo", true).order("ordem").then(({ data }) => {
      const list = (data || []).filter((r: any) => r.nome);
      if (list.length) setFORMAS(list as any);
    });
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("formas_pagamento_entrada")
      .select("id, nome, forma_pagamento, forma_pagamento_id, percentual_desconto, ativo, observacoes")
      .order("nome");
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.nome.trim()) return toast.error("Informe o nome");
    if (!editing.forma_pagamento) return toast.error("Selecione a forma de pagamento");
    const payload = {
      nome: editing.nome.trim(),
      forma_pagamento: editing.forma_pagamento,
      forma_pagamento_id: editing.forma_pagamento_id || null,
      percentual_desconto: Number(editing.percentual_desconto) || 0,
      ativo: editing.ativo,
      observacoes: editing.observacoes || null,
    };
    const q = editing.id
      ? supabase.from("formas_pagamento_entrada").update(payload).eq("id", editing.id)
      : supabase.from("formas_pagamento_entrada").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Configuração de entrada salva");
    setOpen(false); setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta configuração de entrada?")) return;
    const { error } = await supabase.from("formas_pagamento_entrada").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    load();
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-700" />
          <div>
            <div className="font-semibold text-[14px]">ENTRADA</div>
            <div className="text-[11px] text-muted-foreground">Configurações de entrada e percentual de desconto adicional gerado pela entrada</div>
          </div>
        </div>
        <Button size="sm" onClick={() => { setEditing(blank()); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Nova entrada
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50 text-muted-foreground text-[11px] uppercase">
            <tr>
              <th className="text-left px-4 py-2">Nome</th>
              <th className="text-left px-4 py-2">Forma de pagamento</th>
              <th className="text-right px-4 py-2">% desconto</th>
              <th className="text-center px-4 py-2">Ativo</th>
              <th className="text-left px-4 py-2">Observações</th>
              <th className="text-right px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Nenhuma configuração de entrada cadastrada.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2 font-medium">{r.nome}</td>
                <td className="px-4 py-2">{r.forma_pagamento}</td>
                <td className="px-4 py-2 text-right text-mono">{Number(r.percentual_desconto).toFixed(2)}%</td>
                <td className="px-4 py-2 text-center">
                  {r.ativo ? <span className="text-emerald-700">●</span> : <span className="text-muted-foreground">○</span>}
                </td>
                <td className="px-4 py-2 text-muted-foreground text-[12px]">{r.observacoes || "—"}</td>
                <td className="px-4 py-2 text-right">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(r); setOpen(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(r.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar entrada" : "Nova entrada"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} placeholder="Ex.: Entrada à vista" />
              </div>
              <div>
                <Label>Forma de pagamento vinculada</Label>
                <Select
                  value={editing.forma_pagamento}
                  onValueChange={(v) => {
                    const f = FORMAS.find((x) => x.nome === v);
                    setEditing({ ...editing, forma_pagamento: v, forma_pagamento_id: f?.id || null });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS.map((f) => <SelectItem key={f.nome} value={f.nome}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Percentual de desconto da entrada (%)</Label>
                <Input type="number" step="0.01" min={0} value={editing.percentual_desconto}
                  onChange={(e) => setEditing({ ...editing, percentual_desconto: Number(e.target.value) || 0 })} />
                <div className="text-[11px] text-muted-foreground mt-1">A entrada continua preservada — esse percentual gera um desconto adicional sobre o pedido.</div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.ativo} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
                <Label>Ativo</Label>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea rows={2} value={editing.observacoes || ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
