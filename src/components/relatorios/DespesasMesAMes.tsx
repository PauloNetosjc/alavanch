import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { BRL } from "@/lib/financeiro";
import type { LancEnriched } from "@/lib/relatoriosFinanceiros";
import { monthKey, monthLabel, totalize } from "@/lib/relatoriosFinanceiros";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  lancs: LancEnriched[]; // já apenas despesas
}

export default function DespesasMesAMes({ lancs }: Props) {
  const [expMes, setExpMes] = useState<Record<string, boolean>>({});
  const [expMesCat, setExpMesCat] = useState<Record<string, boolean>>({});

  const meses = useMemo(() => {
    const map = new Map<string, LancEnriched[]>();
    for (const l of lancs) {
      const k = monthKey(l.data_vencimento);
      const arr = map.get(k) || [];
      arr.push(l);
      map.set(k, arr);
    }
    const arr = Array.from(map.entries()).map(([k, rows]) => ({ key: k, label: monthLabel(k), rows, totals: totalize(rows) }));
    arr.sort((a, b) => a.key.localeCompare(b.key));
    const grand = arr.reduce((s, m) => s + m.totals.total, 0) || 1;
    return arr.map((m) => ({ ...m, pct: (m.totals.total / grand) * 100 }));
  }, [lancs]);

  const chart = meses.map((m) => ({
    name: m.label,
    Pago: Math.round(m.totals.pago),
    Pendente: Math.round(m.totals.pendente),
    Vencido: Math.round(m.totals.vencido),
  }));

  if (!meses.length) return <div className="text-sm text-muted-foreground py-8 text-center">Sem dados.</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-3">
        <div className="text-xs font-semibold mb-2">Despesas previstas — mês a mês (por status)</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chart}>
            <XAxis dataKey="name" fontSize={10} />
            <YAxis fontSize={10} />
            <Tooltip formatter={(v: any) => BRL(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="Pago" stackId="a" fill="#16a34a" />
            <Bar dataKey="Pendente" stackId="a" fill="#f59e0b" />
            <Bar dataKey="Vencido" stackId="a" fill="#dc2626" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left p-2 w-8"></th>
              <th className="text-left p-2">Mês</th>
              <th className="text-right p-2">Previsto</th>
              <th className="text-right p-2">Pago</th>
              <th className="text-right p-2">Pendente</th>
              <th className="text-right p-2">Vencido</th>
              <th className="text-right p-2">%</th>
              <th className="text-right p-2">Qtd</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => {
              // categorias dentro do mês
              const catMap = new Map<string, LancEnriched[]>();
              for (const l of m.rows) {
                const k = l.parentCategoriaId || "_";
                const a = catMap.get(k) || [];
                a.push(l);
                catMap.set(k, a);
              }
              const cats = Array.from(catMap.entries()).map(([k, rows]) => ({
                key: k, label: rows[0].categoriaNome, rows, totals: totalize(rows),
              })).sort((a, b) => b.totals.total - a.totals.total);
              return (
                <>
                  <tr key={m.key} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setExpMes((s) => ({ ...s, [m.key]: !s[m.key] }))}>
                    <td className="p-2">{expMes[m.key] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</td>
                    <td className="p-2 font-medium">{m.label}</td>
                    <td className="p-2 text-right font-semibold text-rose-700">{BRL(m.totals.total)}</td>
                    <td className="p-2 text-right">{BRL(m.totals.pago)}</td>
                    <td className="p-2 text-right">{BRL(m.totals.pendente)}</td>
                    <td className="p-2 text-right text-rose-600">{BRL(m.totals.vencido)}</td>
                    <td className="p-2 text-right">{m.pct.toFixed(1)}%</td>
                    <td className="p-2 text-right">{m.totals.qtd}</td>
                  </tr>
                  {expMes[m.key] && cats.map((c) => {
                    const ckey = `${m.key}__${c.key}`;
                    return (
                      <>
                        <tr key={ckey} className="border-t bg-muted/10 cursor-pointer" onClick={() => setExpMesCat((s) => ({ ...s, [ckey]: !s[ckey] }))}>
                          <td className="p-2 pl-6">{expMesCat[ckey] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</td>
                          <td className="p-2 pl-2 text-[11px]">↳ {c.label}</td>
                          <td className="p-2 text-right">{BRL(c.totals.total)}</td>
                          <td className="p-2 text-right">{BRL(c.totals.pago)}</td>
                          <td className="p-2 text-right">{BRL(c.totals.pendente)}</td>
                          <td className="p-2 text-right text-rose-600">{BRL(c.totals.vencido)}</td>
                          <td className="p-2 text-right">—</td>
                          <td className="p-2 text-right">{c.totals.qtd}</td>
                        </tr>
                        {expMesCat[ckey] && c.rows.map((l) => (
                          <tr key={l.id} className="border-t bg-background/40">
                            <td></td>
                            <td className="p-1.5 pl-10 text-[11px]">
                              {l.data_vencimento ? new Date(l.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                              {" · "}
                              {l.descricao || "—"}
                              {l.entidade_nome && <span className="text-muted-foreground"> — {l.entidade_nome}</span>}
                            </td>
                            <td className="p-1.5 text-right text-[11px]">{BRL(Number(l.valor))}</td>
                            <td colSpan={5} className="p-1.5 text-[11px] text-muted-foreground">
                              {l.centroCustoNome} · {l.contaNome} · {l.statusDerivado}
                            </td>
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
