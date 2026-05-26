import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BRL } from "@/lib/financeiro";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

type Lanc = {
  tipo: string;
  valor: number | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string | null;
};

const PRAZOS = [7, 15, 30, 60] as const;
type Prazo = typeof PRAZOS[number];

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fmtDM(d: string) {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

export default function FluxoCaixaDashboard() {
  const [prazo, setPrazo] = useState<Prazo>(25 as any);
  const [saldoAtual, setSaldoAtual] = useState(0);
  const [lancs, setLancs] = useState<Lanc[]>([]);

  useEffect(() => { setPrazo(15); }, []);

  useEffect(() => {
    (async () => {
      const [{ data: contas }, { data: lf }] = await Promise.all([
        supabase.from("contas_bancarias").select("saldo_inicial,ativo"),
        supabase.from("lancamentos_financeiros").select("tipo,valor,data_vencimento,data_pagamento,status").limit(5000),
      ]);
      const movs = (lf as Lanc[]) || [];
      // Saldo atual = saldos iniciais + liquidados
      const inicial = (contas || []).filter((c: any) => c.ativo !== false)
        .reduce((s: number, c: any) => s + Number(c.saldo_inicial || 0), 0);
      const liquido = movs
        .filter((l) => ["pago", "recebido", "conciliado"].includes(l.status || ""))
        .reduce((s, l) => s + (l.tipo === "entrada" ? Number(l.valor || 0) : -Number(l.valor || 0)), 0);
      setSaldoAtual(inicial + liquido);
      setLancs(movs);
    })();
  }, []);

  const data = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dias: { date: string; entradas: number; saidas: number; net: number; saldo: number }[] = [];
    const pendentes = lancs.filter((l) => !["pago", "recebido", "conciliado", "cancelado"].includes(l.status || ""));
    let saldo = saldoAtual;
    for (let i = 0; i <= prazo; i++) {
      const d = new Date(hoje); d.setDate(hoje.getDate() + i);
      const k = ymd(d);
      let entradas = 0, saidas = 0;
      pendentes.forEach((l) => {
        if (l.data_vencimento !== k) return;
        const v = Number(l.valor || 0);
        if (l.tipo === "entrada") entradas += v; else saidas += v;
      });
      const net = entradas - saidas;
      saldo += net;
      dias.push({ date: k, entradas, saidas: -saidas, net, saldo });
    }
    return dias;
  }, [lancs, saldoAtual, prazo]);

  const totalEntradas = data.reduce((s, d) => s + d.entradas, 0);
  const totalSaidas = data.reduce((s, d) => s + Math.abs(d.saidas), 0);
  const saldoFinal = data.length ? data[data.length - 1].saldo : saldoAtual;

  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Fluxo de Caixa Previsto</h2>
            <p className="text-sm text-muted-foreground">
              Simulação do encontro entre contas a receber e a pagar nos próximos {prazo} dias
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo Atual</div>
            <div className="text-xl font-bold">{BRL(saldoAtual)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo em {prazo}d</div>
            <div className={`text-xl font-bold ${saldoFinal >= saldoAtual ? "text-emerald-600" : "text-rose-600"}`}>
              {BRL(saldoFinal)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5">
        <div className="rounded-lg border bg-emerald-500/5 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Entradas Previstas</div>
          <div className="text-lg font-semibold text-emerald-700">{BRL(totalEntradas)}</div>
        </div>
        <div className="rounded-lg border bg-rose-500/5 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saídas Previstas</div>
          <div className="text-lg font-semibold text-rose-700">{BRL(totalSaidas)}</div>
        </div>
        <div className="rounded-lg border bg-muted/40 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Resultado Líquido</div>
          <div className={`text-lg font-semibold ${totalEntradas - totalSaidas >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {BRL(totalEntradas - totalSaidas)}
          </div>
        </div>
      </div>

      <div className="mt-6 h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDM} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={(v) => BRL(Number(v))} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={100} />
            <Tooltip
              formatter={(value: any, name: any) => [BRL(Math.abs(Number(value))), name]}
              labelFormatter={(l) => new Date(l + "T00:00").toLocaleDateString("pt-BR")}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
            <Bar dataKey="entradas" name="Entradas" fill="hsl(142 70% 60%)" fillOpacity={0.5} radius={[4, 4, 0, 0]} />
            <Bar dataKey="saidas" name="Saídas" fill="hsl(0 70% 60%)" fillOpacity={0.5} radius={[0, 0, 4, 4]} />
            <Line
              type="monotone" dataKey="saldo" name="Saldo Acumulado"
              stroke="hsl(var(--primary))" strokeWidth={2.5}
              dot={{ r: 3, fill: "hsl(var(--primary))" }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground mr-2">Prazo de simulação:</span>
        {PRAZOS.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={prazo === p ? "default" : "outline"}
            onClick={() => setPrazo(p)}
          >
            {p} dias
          </Button>
        ))}
      </div>
    </div>
  );
}
