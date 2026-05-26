import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CurvaABC from "@/components/produtos/CurvaABC";
import { Plus, Pencil, Trash2, FileBarChart2, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  fornecedor_id: z.string().uuid().nullable().optional(),
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
  fornecedor_id: string | null;
};

type Fornecedor = { id: string; nome: string };

const empty = {
  descricao: "",
  codigo_barra: "",
  codigo_interno: "",
  unidade_medida: "unidade" as const,
  quantidade: 0,
  preco_custo: 0,
  preco_venda: 0,
  fornecedor_id: null as string | null,
};

function calcMargem(custo: number, venda: number): number {
  const c = Number(custo) || 0;
  const v = Number(venda) || 0;
  if (c <= 0) return 0;
  return ((v - c) / c) * 100;
}

export default function Produtos() {
  const [items, setItems] = useState<Produto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);
  const [reportOpen, setReportOpen] = useState(false);
  const [rFornecedor, setRFornecedor] = useState<string>("__all");
  const [rOrdem, setROrdem] = useState<"descricao" | "margem_desc" | "margem_asc">("descricao");
  const [rEmFalta, setREmFalta] = useState(false);

  async function load() {
    const [{ data, error }, { data: forn }] = await Promise.all([
      supabase.from("produtos").select("*").order("descricao", { ascending: true }),
      supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    if (error) return toast.error(error.message);
    setItems((data as any) ?? []);
    setFornecedores((forn as any) ?? []);
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
      fornecedor_id: p.fornecedor_id ?? null,
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
      fornecedor_id: parsed.data.fornecedor_id || null,
    };
    const { error } = editing
      ? await supabase.from("produtos").update(payload).eq("id", editing.id)
      : await supabase.from("produtos").insert(payload as any);
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
  const fornecedorNome = (id: string | null) => fornecedores.find((f) => f.id === id)?.nome ?? "—";

  const reportRows = useMemo(() => {
    let rows = [...items];
    if (rFornecedor !== "__all") rows = rows.filter((p) => p.fornecedor_id === rFornecedor);
    if (rEmFalta) rows = rows.filter((p) => Number(p.quantidade) <= 0);
    if (rOrdem === "margem_desc") rows.sort((a, b) => calcMargem(b.preco_custo, b.preco_venda) - calcMargem(a.preco_custo, a.preco_venda));
    else if (rOrdem === "margem_asc") rows.sort((a, b) => calcMargem(a.preco_custo, a.preco_venda) - calcMargem(b.preco_custo, b.preco_venda));
    else rows.sort((a, b) => a.descricao.localeCompare(b.descricao));
    return rows;
  }, [items, rFornecedor, rOrdem, rEmFalta]);

  function reportData() {
    return reportRows.map((p) => ({
      Descrição: p.descricao,
      "Cód. Barras": p.codigo_barra || "-",
      "Cód. Interno": p.codigo_interno || "-",
      Unidade: unidadeLabel(p.unidade_medida),
      Qtd: Number(p.quantidade),
      Custo: Number(p.preco_custo),
      Venda: Number(p.preco_venda),
      "Margem Bruta (%)": calcMargem(p.preco_custo, p.preco_venda).toFixed(2),
    }));
  }

  function exportXlsx() {
    const ws = XLSX.utils.json_to_sheet(reportData());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    XLSX.writeFile(wb, `relatorio-estoque-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Relatório de Estoque", 14, 14);
    doc.setFontSize(10);
    doc.text(new Date().toLocaleString("pt-BR"), 14, 20);
    autoTable(doc, {
      startY: 26,
      head: [["Descrição", "Cód. Barras", "Cód. Interno", "Unidade", "Qtd", "Custo", "Venda", "Margem %"]],
      body: reportRows.map((p) => [
        p.descricao,
        p.codigo_barra || "-",
        p.codigo_interno || "-",
        unidadeLabel(p.unidade_medida),
        Number(p.quantidade).toLocaleString("pt-BR"),
        fmt(p.preco_custo),
        fmt(p.preco_venda),
        calcMargem(p.preco_custo, p.preco_venda).toFixed(2) + "%",
      ]),
      styles: { fontSize: 9 },
    });
    doc.save(`relatorio-estoque-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function printReport() {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = reportRows
      .map(
        (p) => `<tr>
        <td>${p.descricao}</td>
        <td>${p.codigo_barra || "-"}</td>
        <td>${p.codigo_interno || "-"}</td>
        <td>${unidadeLabel(p.unidade_medida)}</td>
        <td style="text-align:right">${Number(p.quantidade).toLocaleString("pt-BR")}</td>
        <td style="text-align:right">${fmt(p.preco_custo)}</td>
        <td style="text-align:right">${fmt(p.preco_venda)}</td>
        <td style="text-align:right">${calcMargem(p.preco_custo, p.preco_venda).toFixed(2)}%</td>
      </tr>`
      )
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Relatório de Estoque</title>
      <style>body{font-family:sans-serif;padding:24px;color:#1A1A1A}h1{font-size:18px;margin:0 0 4px}
      .meta{color:#666;font-size:12px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f5f5f5}</style></head><body>
      <h1>Relatório de Estoque</h1>
      <div class="meta">${new Date().toLocaleString("pt-BR")} — ${reportRows.length} produto(s)</div>
      <table><thead><tr>
        <th>Descrição</th><th>Cód. Barras</th><th>Cód. Interno</th><th>Unidade</th>
        <th>Qtd</th><th>Custo</th><th>Venda</th><th>Margem %</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Cadastro de Produtos</h1>
          <p className="text-sm text-muted-foreground">Gerencie itens, preços e estoque</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReportOpen(true)}>
            <FileBarChart2 className="w-4 h-4 mr-2" /> Relatório de Estoque
          </Button>
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
                  <Label>Fornecedor</Label>
                  <Select
                    value={form.fornecedor_id ?? "__none"}
                    onValueChange={(v) => setForm({ ...form, fornecedor_id: v === "__none" ? null : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Nenhum —</SelectItem>
                      {fornecedores.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
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
                <div className="col-span-2 text-xs text-muted-foreground">
                  Margem bruta: <span className="font-medium text-foreground">{calcMargem(form.preco_custo, form.preco_venda).toFixed(2)}%</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>{editing ? "Salvar" : "Cadastrar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Lista de Produtos</TabsTrigger>
          <TabsTrigger value="abc">Curva ABC</TabsTrigger>
        </TabsList>
        <TabsContent value="lista">
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
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum produto cadastrado.</TableCell></TableRow>
                )}
                {filtered.map((p) => {
                  const m = calcMargem(p.preco_custo, p.preco_venda);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.descricao}</TableCell>
                      <TableCell>{p.codigo_barra || "-"}</TableCell>
                      <TableCell>{p.codigo_interno || "-"}</TableCell>
                      <TableCell>{unidadeLabel(p.unidade_medida)}</TableCell>
                      <TableCell className="text-right">{Number(p.quantidade).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{fmt(p.preco_custo)}</TableCell>
                      <TableCell className="text-right">{fmt(p.preco_venda)}</TableCell>
                      <TableCell className={`text-right ${m < 0 ? "text-destructive" : ""}`}>{m.toFixed(2)}%</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="abc">
          <CurvaABC />
        </TabsContent>
      </Tabs>

      {/* Relatório de Estoque */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Relatório de Estoque</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Fornecedor</Label>
              <Select value={rFornecedor} onValueChange={setRFornecedor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos</SelectItem>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ordenação</Label>
              <Select value={rOrdem} onValueChange={(v: any) => setROrdem(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="descricao">Descrição (A-Z)</SelectItem>
                  <SelectItem value="margem_desc">Margem (maior para menor)</SelectItem>
                  <SelectItem value="margem_asc">Margem (menor para maior)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Filtro adicional</Label>
              <Select value={rEmFalta ? "falta" : "todos"} onValueChange={(v) => setREmFalta(v === "falta")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os produtos</SelectItem>
                  <SelectItem value="falta">Apenas produtos em falta (Qtd ≤ 0)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={exportXlsx}><FileSpreadsheet className="w-4 h-4 mr-2" />Excel</Button>
            <Button variant="outline" size="sm" onClick={exportPdf}><FileText className="w-4 h-4 mr-2" />PDF</Button>
            <Button variant="outline" size="sm" onClick={printReport}><Printer className="w-4 h-4 mr-2" />Imprimir</Button>
            <div className="ml-auto text-sm text-muted-foreground self-center">{reportRows.length} produto(s)</div>
          </div>

          <div className="max-h-[420px] overflow-auto border rounded-md">
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
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportRows.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum produto.</TableCell></TableRow>
                )}
                {reportRows.map((p) => {
                  const m = calcMargem(p.preco_custo, p.preco_venda);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.descricao}</TableCell>
                      <TableCell>{p.codigo_barra || "-"}</TableCell>
                      <TableCell>{p.codigo_interno || "-"}</TableCell>
                      <TableCell>{unidadeLabel(p.unidade_medida)}</TableCell>
                      <TableCell className="text-right">{Number(p.quantidade).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{fmt(p.preco_custo)}</TableCell>
                      <TableCell className="text-right">{fmt(p.preco_venda)}</TableCell>
                      <TableCell className={`text-right ${m < 0 ? "text-destructive" : ""}`}>{m.toFixed(2)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
