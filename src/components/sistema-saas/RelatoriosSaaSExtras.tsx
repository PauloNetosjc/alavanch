import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { brl } from "./saasFinTypes";

type Lanc = {
  id: string;
  tipo: "receita" | "despesa";
  valor: number;
  status: string;
  data_competencia: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  base_cliente_id: string | null;
  sistema_saas_id: string | null;
  categoria_id: string | null;
  centro_custo_id: string | null;
};
type Nome = { id: string; nome: string };

const COLORS = { receita: "#15803d", despesa: "#dc2626", previsto: "#ca8a04" };

function exportXlsx(rows: any[], nome: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 30));
  XLSX.writeFile(wb, `${nome}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function GraficoCard({
  title, rows, dataKey, labelKey, onExport, color = "#15803d",
}: {
  title: string; rows: any[]; dataKey: string; labelKey: string; onExport: () => void; color?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{title}</div>
        <Button variant="outline" size="sm" onClick={onExport} className="gap-1">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Sem dados</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows} layout="vertical" margin={{ left: 30 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey={labelKey} tick={{ fontSize: 10 }} width={120} />
            <Tooltip formatter={(v: number) => brl(v)} />
            <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

export function RelatoriosSaaSExtras() {
  const [loading, setLoading] = useState(true);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [bases, setBases] = useState<Nome[]>([]);
  const [sistemas, setSistemas] = useState<Nome[]>([]);
  const [categorias, setCategorias] = useState<Nome[]>([]);
  const [centros, setCentros] = useState<Nome[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [l, b, s, ca, cc] = await Promise.all([
        supabase.from("saas_lancamentos_financeiros" as any).select("id,tipo,valor,status,data_competencia,data_vencimento,data_pagamento,base_cliente_id,sistema_saas_id,categoria_id,centro_custo_id"),
        supabase.from("bases_clientes" as any).select("id,nome"),
        supabase.from("sistemas_saas" as any).select("id,nome"),
        supabase.from("saas_categorias_financeiras" as any).select("id,nome"),
        supabase.from("saas_centros_custo" as any).select("id,nome"),
      ]);
      setLancs((l.data || []) as any);
      setBases((b.data || []) as any);
      setSistemas((s.data || []) as any);
      setCategorias((ca.data || []) as any);
      setCentros((cc.data || []) as any);
      setLoading(false);
    })();
  }, []);

  const nomeMap = (arr: Nome[]) => Object.fromEntries(arr.map((x) => [x.id, x.nome]));
  const bn = useMemo(() => nomeMap(bases), [bases]);
  const sn = useMemo(() => nomeMap(sistemas), [sistemas]);
  const cn = useMemo(() => nomeMap(categorias), [categorias]);
  const ccn = useMemo(() => nomeMap(centros), [centros]);

  const agrup = (filtro: (l: Lanc) => boolean, key: (l: Lanc) => string) => {
    const m: Record<string, number> = {};
    lancs.filter(filtro).forEach((l) => {
      const k = key(l) || "—";
      m[k] = (m[k] || 0) + Number(l.valor || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };

  const receitaPorBase = useMemo(() =>
    agrup((l) => l.tipo === "receita" && l.status === "pago", (l) => bn[l.base_cliente_id || ""] || "Sem base")
      .map((r) => ({ Base: r.name, Receita: r.value })),
  [lancs, bn]);

  const receitaPorSistema = useMemo(() =>
    agrup((l) => l.tipo === "receita" && l.status === "pago", (l) => sn[l.sistema_saas_id || ""] || "Sem sistema")
      .map((r) => ({ Sistema: r.name, Receita: r.value })),
  [lancs, sn]);

  const receitaPorCategoria = useMemo(() =>
    agrup((l) => l.tipo === "receita", (l) => cn[l.categoria_id || ""] || "Sem categoria")
      .map((r) => ({ Categoria: r.name, Receita: r.value })),
  [lancs, cn]);

  const despesaPorCategoria = useMemo(() =>
    agrup((l) => l.tipo === "despesa", (l) => cn[l.categoria_id || ""] || "Sem categoria")
      .map((r) => ({ Categoria: r.name, Despesa: r.value })),
  [lancs, cn]);

  const despesaPorCentro = useMemo(() =>
    agrup((l) => l.tipo === "despesa", (l) => ccn[l.centro_custo_id || ""] || "Sem centro")
      .map((r) => ({ Centro: r.name, Despesa: r.value })),
  [lancs, ccn]);

  // Resultado mês a mês (receita paga - despesa paga, por mês de pagamento)
  const resultadoMes = useMemo(() => {
    const m: Record<string, { mes: string; receita: number; despesa: number; resultado: number }> = {};
    lancs.forEach((l) => {
      if (!l.data_pagamento || l.status !== "pago") return;
      const k = l.data_pagamento.slice(0, 7);
      if (!m[k]) m[k] = { mes: k, receita: 0, despesa: 0, resultado: 0 };
      if (l.tipo === "receita") m[k].receita += Number(l.valor || 0);
      else m[k].despesa += Number(l.valor || 0);
      m[k].resultado = m[k].receita - m[k].despesa;
    });
    return Object.values(m).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12);
  }, [lancs]);

  // Fluxo previsto x realizado por mês (competência ou vencimento como previsto, pagamento como realizado)
  const fluxoMes = useMemo(() => {
    const m: Record<string, { mes: string; previsto: number; realizado: number }> = {};
    lancs.forEach((l) => {
      const ref = l.data_competencia || l.data_vencimento;
      if (ref && l.status !== "cancelado") {
        const k = ref.slice(0, 7);
        if (!m[k]) m[k] = { mes: k, previsto: 0, realizado: 0 };
        const sign = l.tipo === "receita" ? 1 : -1;
        m[k].previsto += sign * Number(l.valor || 0);
      }
      if (l.data_pagamento && l.status === "pago") {
        const k = l.data_pagamento.slice(0, 7);
        if (!m[k]) m[k] = { mes: k, previsto: 0, realizado: 0 };
        const sign = l.tipo === "receita" ? 1 : -1;
        m[k].realizado += sign * Number(l.valor || 0);
      }
    });
    return Object.values(m).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12);
  }, [lancs]);

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GraficoCard title="Receitas por base" rows={receitaPorBase.slice(0, 15)} dataKey="Receita" labelKey="Base"
          onExport={() => exportXlsx(receitaPorBase, "receitas_por_base")} color={COLORS.receita} />
        <GraficoCard title="Receitas por sistema vendido" rows={receitaPorSistema} dataKey="Receita" labelKey="Sistema"
          onExport={() => exportXlsx(receitaPorSistema, "receitas_por_sistema")} color={COLORS.receita} />
        <GraficoCard title="Receitas por categoria" rows={receitaPorCategoria.slice(0, 15)} dataKey="Receita" labelKey="Categoria"
          onExport={() => exportXlsx(receitaPorCategoria, "receitas_por_categoria")} color={COLORS.receita} />
        <GraficoCard title="Despesas por categoria" rows={despesaPorCategoria.slice(0, 15)} dataKey="Despesa" labelKey="Categoria"
          onExport={() => exportXlsx(despesaPorCategoria, "despesas_por_categoria")} color={COLORS.despesa} />
        <GraficoCard title="Despesas por centro de custo" rows={despesaPorCentro.slice(0, 15)} dataKey="Despesa" labelKey="Centro"
          onExport={() => exportXlsx(despesaPorCentro, "despesas_por_centro")} color={COLORS.despesa} />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Resultado mês a mês (últimos 12 meses)</div>
          <Button variant="outline" size="sm" onClick={() => exportXlsx(resultadoMes, "resultado_mes_a_mes")} className="gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </Button>
        </div>
        {resultadoMes.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">Sem dados</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={resultadoMes}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => brl(v)} /><Legend />
              <Bar dataKey="receita" fill={COLORS.receita} name="Receita" />
              <Bar dataKey="despesa" fill={COLORS.despesa} name="Despesa" />
              <Bar dataKey="resultado" fill="#0c4a6e" name="Resultado" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Fluxo previsto x realizado (últimos 12 meses)</div>
          <Button variant="outline" size="sm" onClick={() => exportXlsx(fluxoMes, "fluxo_previsto_realizado")} className="gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </Button>
        </div>
        {fluxoMes.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">Sem dados</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={fluxoMes}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => brl(v)} /><Legend />
              <Line type="monotone" dataKey="previsto" stroke={COLORS.previsto} name="Previsto" />
              <Line type="monotone" dataKey="realizado" stroke={COLORS.receita} name="Realizado" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
