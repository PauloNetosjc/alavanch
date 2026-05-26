import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Criterio = "faturamento" | "quantidade" | "lucro";

type Row = {
  produto_id: string;
  descricao: string;
  codigo_interno: string | null;
  qtd: number;
  faturamento: number;
  lucro: number;
};

type Calc = Row & {
  valor: number;
  perc: number;
  acum: number;
  classe: "A" | "B" | "C";
};

const fmtBrl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n || 0);

function daysAgo(d: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().slice(0, 10);
}

export default function CurvaABC() {
  const [criterio, setCriterio] = useState<Criterio>("faturamento");
  const [dataIni, setDataIni] = useState(daysAgo(90));
  const [dataFim, setDataFim] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  async function carregar() {
    setLoading(true);
    try {
      // 1) itens avulsos com produto_id no período (via pedido criado no período)
      const { data: itens, error } = await supabase
        .from("pedido_itens_avulsos")
        .select(`
          produto_id, quantidade, valor_venda, preco_custo_unit,
          pedido:pedido_id ( id, created_at ),
          produto:produto_id ( id, descricao, codigo_interno )
        `)
        .not("produto_id", "is", null);
      if (error) throw error;

      const ini = new Date(dataIni + "T00:00:00").getTime();
      const fim = new Date(dataFim + "T23:59:59").getTime();
      const agg = new Map<string, Row>();
      for (const it of (itens as any[]) ?? []) {
        if (!it.pedido) continue;
        const t = new Date(it.pedido.created_at).getTime();
        if (t < ini || t > fim) continue;
        const pid = it.produto_id;
        const qtd = Number(it.quantidade ?? 1);
        const fat = Number(it.valor_venda) * qtd;
        const luc = (Number(it.valor_venda) - Number(it.preco_custo_unit ?? 0)) * qtd;
        const cur = agg.get(pid) ?? {
          produto_id: pid,
          descricao: it.produto?.descricao ?? "(sem nome)",
          codigo_interno: it.produto?.codigo_interno ?? null,
          qtd: 0, faturamento: 0, lucro: 0,
        };
        cur.qtd += qtd;
        cur.faturamento += fat;
        cur.lucro += luc;
        agg.set(pid, cur);
      }
      setRows(Array.from(agg.values()));
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, []);

  const calc: Calc[] = useMemo(() => {
    const valorDe = (r: Row) =>
      criterio === "faturamento" ? r.faturamento : criterio === "quantidade" ? r.qtd : r.lucro;
    const ordered = [...rows]
      .map((r) => ({ ...r, valor: valorDe(r) }))
      .filter((r) => r.valor > 0)
      .sort((a, b) => b.valor - a.valor);
    const total = ordered.reduce((s, r) => s + r.valor, 0) || 1;
    let acum = 0;
    return ordered.map((r) => {
      const perc = (r.valor / total) * 100;
      acum += perc;
      const classe: "A" | "B" | "C" = acum <= 80 ? "A" : acum <= 95 ? "B" : "C";
      return { ...r, perc, acum, classe };
    });
  }, [rows, criterio]);

  const totals = useMemo(() => {
    const t = { A: 0, B: 0, C: 0 };
    const cnt = { A: 0, B: 0, C: 0 };
    for (const r of calc) { t[r.classe] += r.valor; cnt[r.classe]++; }
    const total = calc.reduce((s, r) => s + r.valor, 0) || 1;
    return {
      A: { qtd: cnt.A, perc: (t.A / total) * 100 },
      B: { qtd: cnt.B, perc: (t.B / total) * 100 },
      C: { qtd: cnt.C, perc: (t.C / total) * 100 },
      total,
    };
  }, [calc]);

  const chartData = calc.slice(0, 20).map((r) => ({
    name: r.descricao.length > 18 ? r.descricao.slice(0, 18) + "…" : r.descricao,
    valor: Math.round(r.valor * 100) / 100,
    acum: Math.round(r.acum * 10) / 10,
  }));

  const exportCSV = () => {
    const header = ["Posição","Descrição","Cód. Interno","Qtd","Faturamento","Lucro","% Individual","% Acumulado","Classe"];
    const lines = calc.map((r, i) => [
      i + 1, r.descricao, r.codigo_interno ?? "", fmtNum(r.qtd),
      r.faturamento.toFixed(2), r.lucro.toFixed(2),
      r.perc.toFixed(2), r.acum.toFixed(2), r.classe,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    const csv = [header.join(";"), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `curva-abc-${criterio}-${dataIni}-a-${dataFim}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const labelCriterio = criterio === "faturamento" ? "Faturamento" : criterio === "quantidade" ? "Quantidade" : "Lucro";

  const classeBadge = (c: "A" | "B" | "C") => {
    const cls = c === "A" ? "bg-emerald-600 hover:bg-emerald-600" :
                c === "B" ? "bg-amber-500 hover:bg-amber-500" : "bg-slate-400 hover:bg-slate-400";
    return <Badge className={`${cls} text-white`}>{c}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label>Data inicial</Label>
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
          </div>
          <div>
            <Label>Data final</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block">Critério</Label>
            <RadioGroup value={criterio} onValueChange={(v: any) => setCriterio(v)} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="faturamento" /> Faturamento
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="quantidade" /> Quantidade
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="lucro" /> Lucro
              </label>
            </RadioGroup>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={carregar} disabled={loading}>{loading ? "Carregando..." : "Atualizar"}</Button>
          <Button variant="outline" onClick={exportCSV} disabled={!calc.length}>
            <Download className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(["A","B","C"] as const).map((c) => (
          <Card key={c} className="p-4 flex items-center gap-4">
            <div className="text-4xl font-display">{classeBadge(c)}</div>
            <div>
              <div className="text-2xl font-display">{totals[c].qtd}</div>
              <div className="text-xs text-muted-foreground">produtos · {totals[c].perc.toFixed(1)}% do {labelCriterio.toLowerCase()}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="text-sm font-medium mb-2">Curva de Pareto — top 20 ({labelCriterio})</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={70} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="valor" name={labelCriterio} fill="hsl(var(--primary))" />
              <Line yAxisId="right" type="monotone" dataKey="acum" name="% Acumulado" stroke="#c9a84c" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Cód. Interno</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-right">Lucro</TableHead>
              <TableHead className="text-right">% Indiv.</TableHead>
              <TableHead className="text-right">% Acum.</TableHead>
              <TableHead className="text-center">Classe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calc.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Nenhuma venda de produto cadastrada no período. Vincule produtos aos itens dos pedidos para alimentar o relatório.
                </TableCell>
              </TableRow>
            )}
            {calc.map((r, i) => (
              <TableRow key={r.produto_id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell className="font-medium">{r.descricao}</TableCell>
                <TableCell>{r.codigo_interno || "-"}</TableCell>
                <TableCell className="text-right">{fmtNum(r.qtd)}</TableCell>
                <TableCell className="text-right">{fmtBrl(r.faturamento)}</TableCell>
                <TableCell className="text-right">{fmtBrl(r.lucro)}</TableCell>
                <TableCell className="text-right">{r.perc.toFixed(2)}%</TableCell>
                <TableCell className="text-right">{r.acum.toFixed(2)}%</TableCell>
                <TableCell className="text-center">{classeBadge(r.classe)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
