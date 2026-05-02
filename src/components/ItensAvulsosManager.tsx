import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus, Package } from "lucide-react";
import { toast } from "sonner";

type ItemAvulso = {
  id: string;
  nome: string;
  descricao: string | null;
  valor_venda: number;
  negociavel: boolean;
};

interface Props {
  pedidoId?: string;
  orcamentoId?: string;
  /** Quando os itens mudarem (criação/remoção/edição), notifica o pai. */
  onChange?: (totals: { totalNegociavel: number; totalNaoNegociavel: number }) => void;
  /** Quando true, esconde botões de edição (usado em pedidos fechados — alterações viram adendo). */
  readOnly?: boolean;
}

const fmtBrl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export function ItensAvulsosManager({ pedidoId, orcamentoId, onChange, readOnly = false }: Props) {
  const [itens, setItens] = useState<ItemAvulso[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", descricao: "", valor_venda: "0", negociavel: true });

  const load = async () => {
    let q = supabase.from("pedido_itens_avulsos").select("*").order("ordem");
    if (pedidoId) q = q.eq("pedido_id", pedidoId);
    else if (orcamentoId) q = q.eq("orcamento_id", orcamentoId);
    else { setItens([]); return; }
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    const list = (data ?? []) as ItemAvulso[];
    setItens(list);
    notify(list);
  };

  const notify = (list: ItemAvulso[]) => {
    if (!onChange) return;
    const tNeg = list.filter((i) => i.negociavel).reduce((s, i) => s + Number(i.valor_venda), 0);
    const tNN = list.filter((i) => !i.negociavel).reduce((s, i) => s + Number(i.valor_venda), 0);
    onChange({ totalNegociavel: tNeg, totalNaoNegociavel: tNN });
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [pedidoId, orcamentoId]);

  const adicionar = async () => {
    if (!form.nome.trim()) return toast.error("Nome obrigatório");
    const valor = Number(String(form.valor_venda).replace(",", "."));
    if (Number.isNaN(valor) || valor < 0) return toast.error("Valor inválido");
    const payload: any = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      valor_venda: valor,
      negociavel: form.negociavel,
      pedido_id: pedidoId || null,
      orcamento_id: orcamentoId || null,
    };
    const { error } = await supabase.from("pedido_itens_avulsos").insert(payload);
    if (error) return toast.error(error.message);
    setForm({ nome: "", descricao: "", valor_venda: "0", negociavel: true });
    setOpen(false);
    load();
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("pedido_itens_avulsos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="surface-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2"><Package className="w-4 h-4" /> Itens avulsos</h3>
        {!readOnly && (
          <Button size="sm" onClick={() => setOpen(true)} disabled={!pedidoId && !orcamentoId}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar item
          </Button>
        )}
      </div>
      {itens.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4">Nenhum item avulso.</div>
      ) : (
        <ul className="divide-y">
          {itens.map((i) => (
            <li key={i.id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">{i.nome}</div>
                {i.descricao && <div className="text-xs text-muted-foreground">{i.descricao}</div>}
                <div className="text-[11px] mt-0.5">
                  {i.negociavel ? (
                    <span className="text-blue-600">Negociável (recebe desconto)</span>
                  ) : (
                    <span className="text-amber-600 font-medium">NÃO negociável (sem desconto)</span>
                  )}
                </div>
              </div>
              <div className="text-sm font-semibold">{fmtBrl(Number(i.valor_venda))}</div>
              {!readOnly && (
                <Button size="icon" variant="ghost" onClick={() => remover(i.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo item avulso</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do item *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div>
              <Label>Valor de venda</Label>
              <Input type="number" step="0.01" value={form.valor_venda} onChange={(e) => setForm({ ...form, valor_venda: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.negociavel} onCheckedChange={(c) => setForm({ ...form, negociavel: !!c })} />
              <span className="text-sm">Item negociável (recebe desconto na calculadora)</span>
            </label>
            {!form.negociavel && (
              <div className="text-xs p-2 bg-amber-50 border border-amber-200 rounded text-amber-800">
                Este item ficará separado e somará ao total APÓS os descontos dos itens negociáveis.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={adicionar}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
