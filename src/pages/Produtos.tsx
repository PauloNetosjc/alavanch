import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const UNIDADES = [
  { value: "kilo", label: "Kilo (kg)" },
  { value: "metro_quadrado", label: "Metro Quadrado (m²)" },
  { value: "metro_linear", label: "Metro Linear (m)" },
  { value: "metro_cubico", label: "Metro Cúbico (m³)" },
  { value: "litro", label: "Litro (L)" },
  { value: "unidade", label: "Unidade (un)" },
] as const;

const schema = z.object({
  descricao: z.string().trim().min(1, "Descrição obrigatória").max(200),
  codigo_barra: z.string().trim().max(60).optional().or(z.literal("")),
  codigo_interno: z.string().trim().max(60).optional().or(z.literal("")),
  unidade_medida: z.enum(["kilo", "metro_quadrado", "metro_linear", "metro_cubico", "litro", "unidade"]),
  quantidade: z.coerce.number().min(0),
  preco_custo: z.coerce.number().min(0),
  preco_venda: z.coerce.number().min(0),
});

type Produto = {
  id: string;
  descricao: string;
  codigo_barra: string | null;
  codigo_interno: string | null;
  unidade_medida: string;
  quantidade: number;
  preco_custo: number;
  preco_venda: number;
};

const empty = {
  descricao: "",
  codigo_barra: "",
  codigo_interno: "",
  unidade_medida: "unidade" as const,
  quantidade: 0,
  preco_custo: 0,
  preco_venda: 0,
};

export default function Produtos() {
  const [items, setItems] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);

  async function load() {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .order("descricao", { ascending: true });
    if (error) return toast.error(error.message);
    setItems((data as any) ?? []);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(p: Produto) {
    setEditing(p);
    setForm({
      descricao: p.descricao,
      codigo_barra: p.codigo_barra ?? "",
      codigo_interno: p.codigo_interno ?? "",
      unidade_medida: p.unidade_medida as any,
      quantidade: Number(p.quantidade),
      preco_custo: Number(p.preco_custo),
      preco_venda: Number(p.preco_venda),
    });
    setOpen(true);
  }

  async function save() {
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    const payload = {
      ...parsed.data,
      codigo_barra: parsed.data.codigo_barra || null,
      codigo_interno: parsed.data.codigo_interno || null,
    };
    const { error } = editing
      ? await supabase.from("produtos").update(payload).eq("id", editing.id)
      : await supabase.from("produtos").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Produto atualizado" : "Produto cadastrado");
    setOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Produto excluído");
    load();
  }

  const filtered = items.filter((p) => {
    const q = busca.toLowerCase();
    return (
      p.descricao.toLowerCase().includes(q) ||
      (p.codigo_barra ?? "").toLowerCase().includes(q) ||
      (p.codigo_interno ?? "").toLowerCase().includes(q)
    );
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);
  const unidadeLabel = (u: string) => UNIDADES.find((x) => x.value === u)?.label ?? u;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Cadastro de Produtos</h1>
          <p className="text-sm text-muted-foreground">Gerencie itens, preços e estoque</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo Produto</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Descrição *</Label>
                <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div>
                <Label>Código de Barras</Label>
                <Input value={form.codigo_barra} onChange={(e) => setForm({ ...form, codigo_barra: e.target.value })} />
              </div>
              <div>
                <Label>Código Interno</Label>
                <Input value={form.codigo_interno} onChange={(e) => setForm({ ...form, codigo_interno: e.target.value })} />
              </div>
              <div>
                <Label>Unidade de Medida *</Label>
                <Select value={form.unidade_medida} onValueChange={(v: any) => setForm({ ...form, unidade_medida: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input type="number" step="0.01" value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Preço de Custo</Label>
                <Input type="number" step="0.01" value={form.preco_custo}
                  onChange={(e) => setForm({ ...form, preco_custo: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Preço de Venda</Label>
                <Input type="number" step="0.01" value={form.preco_venda}
                  onChange={(e) => setForm({ ...form, preco_venda: Number(e.target.value) })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>{editing ? "Salvar" : "Cadastrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        <Input placeholder="Buscar por descrição, código de barras ou código interno..."
          value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-md mb-3" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Cód. Barras</TableHead>
              <TableHead>Cód. Interno</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Venda</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum produto cadastrado.</TableCell></TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.descricao}</TableCell>
                <TableCell>{p.codigo_barra || "-"}</TableCell>
                <TableCell>{p.codigo_interno || "-"}</TableCell>
                <TableCell>{unidadeLabel(p.unidade_medida)}</TableCell>
                <TableCell className="text-right">{Number(p.quantidade).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right">{fmt(p.preco_custo)}</TableCell>
                <TableCell className="text-right">{fmt(p.preco_venda)}</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
