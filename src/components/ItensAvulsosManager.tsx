import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus, Package } from "lucide-react";
import { toast } from "sonner";

type ItemAvulso = {
  id: string;
  nome: string;
  descricao: string | null;
  valor_venda: number;
  quantidade: number | null;
  negociavel: boolean;
  produto_id: string | null;
};

type Produto = {
  id: string;
  descricao: string;
  codigo_interno: string | null;
  preco_venda: number;
  preco_custo: number;
};

interface Props {
  pedidoId?: string;
  orcamentoId?: string;
  onChange?: (totals: { totalNegociavel: number; totalNaoNegociavel: number }) => void;
  readOnly?: boolean;
}

const fmtBrl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export function ItensAvulsosManager({ pedidoId, orcamentoId, onChange, readOnly = false }: Props) {
  const [itens, setItens] = useState<ItemAvulso[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    produto_id: "" as string | "",
    nome: "",
    descricao: "",
    valor_venda: "0",
    quantidade: "1",
    negociavel: true,
  });

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

  const loadProdutos = async () => {
    const { data } = await supabase
      .from("produtos")
      .select("id, descricao, codigo_interno, preco_venda, preco_custo")
      .eq("ativo", true)
      .order("descricao");
    setProdutos((data as any) ?? []);
  };

  const notify = (list: ItemAvulso[]) => {
    if (!onChange) return;
    const tNeg = list.filter((i) => i.negociavel).reduce((s, i) => s + Number(i.valor_venda) * Number(i.quantidade ?? 1), 0);
    const tNN = list.filter((i) => !i.negociavel).reduce((s, i) => s + Number(i.valor_venda) * Number(i.quantidade ?? 1), 0);
    onChange({ totalNegociavel: tNeg, totalNaoNegociavel: tNN });
  };

  useEffect(() => { load(); loadProdutos(); /* eslint-disable-next-line */ }, [pedidoId, orcamentoId]);

  const onSelectProduto = (id: string) => {
    const p = produtos.find((x) => x.id === id);
    if (!p) { setForm({ ...form, produto_id: "" }); return; }
    setForm({
      ...form,
      produto_id: id,
      nome: p.descricao,
      valor_venda: String(p.preco_venda ?? 0),
    });
  };

  const adicionar = async () => {
    if (!form.nome.trim()) return toast.error("Nome obrigatório");
    const valor = Number(String(form.valor_venda).replace(",", "."));
    const qtd = Number(String(form.quantidade).replace(",", "."));
    if (Number.isNaN(valor) || valor < 0) return toast.error("Valor inválido");
    if (Number.isNaN(qtd) || qtd <= 0) return toast.error("Quantidade inválida");
    const prod = form.produto_id ? produtos.find((p) => p.id === form.produto_id) : null;
    const payload: any = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      valor_venda: valor,
      quantidade: qtd,
      preco_custo_unit: prod ? Number(prod.preco_custo ?? 0) : 0,
      produto_id: form.produto_id || null,
      negociavel: form.negociavel,
      pedido_id: pedidoId || null,
      orcamento_id: orcamentoId || null,
    };
    const { error } = await supabase.from("pedido_itens_avulsos").insert(payload);
    if (error) return toast.error(error.message);
    setForm({ produto_id: "", nome: "", descricao: "", valor_venda: "0", quantidade: "1", negociavel: true });
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
          {itens.map((i) => {
            const qtd = Number(i.quantidade ?? 1);
            const subtotal = Number(i.valor_venda) * qtd;
            return (
              <li key={i.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{i.nome}</div>
                  {i.descricao && <div className="text-xs text-muted-foreground">{i.descricao}</div>}
                  <div className="text-[11px] mt-0.5 flex gap-2">
                    <span className="text-muted-foreground">{qtd} × {fmtBrl(Number(i.valor_venda))}</span>
                    {i.negociavel ? (
                      <span className="text-blue-600">Negociável</span>
                    ) : (
                      <span className="text-amber-600 font-medium">NÃO negociável</span>
                    )}
                    {i.produto_id && <span className="text-emerald-700">• Produto cadastrado</span>}
                  </div>
                </div>
                <div className="text-sm font-semibold">{fmtBrl(subtotal)}</div>
                {!readOnly && (
                  <Button size="icon" variant="ghost" onClick={() => remover(i.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo item avulso</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Produto cadastrado (opcional)</Label>
              <Select value={form.produto_id || "__manual"} onValueChange={(v) => onSelectProduto(v === "__manual" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione um produto ou deixe manual" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual">— Item manual (sem vínculo) —</SelectItem>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.descricao}{p.codigo_interno ? ` (${p.codigo_interno})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">Vincular ao produto cadastrado permite incluir esse item no relatório Curva ABC.</p>
            </div>
            <div>
              <Label>Nome do item *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantidade</Label>
                <Input type="number" step="0.01" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
              </div>
              <div>
                <Label>Valor unitário de venda</Label>
                <Input type="number" step="0.01" value={form.valor_venda} onChange={(e) => setForm({ ...form, valor_venda: e.target.value })} />
              </div>
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
