import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#64748b"];

export default function Relatorios() {
  const [periodo, setPeriodo] = useState<"30" | "90" | "365">("90");
  const [orcs, setOrcs] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [ocorr, setOcorr] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - parseInt(periodo));
      const sinceISO = since.toISOString();

      const [{ data: o }, { data: p }, { data: oc }] = await Promise.all([
        supabase.from("orcamentos").select("total, status, created_at").gte("created_at", sinceISO),
        supabase.from("pedidos").select("valor_total, status, created_at").gte("created_at", sinceISO),
        supabase.from("ocorrencias").select("tipo, status, created_at").gte("created_at", sinceISO),
      ]);
      setOrcs(o || []); setPedidos(p || []); setOcorr(oc || []);
      setLoading(false);
    })();
  }, [periodo]);

  const kpi = useMemo(() => {
    const tot = orcs.reduce((s, o) => s + Number(o.total || 0), 0);
    const aprov = orcs.filter((o) => o.status === "aprovado" || o.status === "fechado");
    const totAprov = aprov.reduce((s, o) => s + Number(o.total || 0), 0);
    const conv = orcs.length ? (aprov.length / orcs.length) * 100 : 0;
    const ticket = aprov.length ? totAprov / aprov.length : 0;
    return { tot, totAprov, conv, ticket, qtd: orcs.length };
  }, [orcs]);

  // série diária
  const serie = useMemo(() => {
    const map = new Map<string, number>();
    orcs.forEach((o) => {
      const d = new Date(o.created_at).toISOString().slice(0, 10);
      map.set(d, (map.get(d) || 0) + Number(o.total || 0));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, valor]) => ({ data: data.slice(5), valor }));
  }, [orcs]);

  // status pedidos
  const statusPedidos = useMemo(() => {
    const map = new Map<string, number>();
    pedidos.forEach((p) => map.set(p.status, (map.get(p.status) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [pedidos]);

  // tipos ocorrências
  const tiposOcorr = useMemo(() => {
    const map = new Map<string, number>();
    ocorr.forEach((o) => map.set(o.tipo, (map.get(o.tipo) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [ocorr]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1>Relatórios</h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            Visão consolidada de vendas, operações e ocorrências.
          </p>
        </div>
        <Select value={periodo} onValueChange={(v: any) => setPeriodo(v)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="surface-card p-4">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Volume Orçado</div>
          <div className="text-[20px] font-medium mt-1">{fmtBRL(kpi.tot)}</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Vendas Fechadas</div>
          <div className="text-[20px] font-medium mt-1 text-emerald-500">{fmtBRL(kpi.totAprov)}</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Conversão</div>
          <div className="text-[20px] font-medium mt-1">{kpi.conv.toFixed(1)}%</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Ticket Médio</div>
          <div className="text-[20px] font-medium mt-1">{fmtBRL(kpi.ticket)}</div>
        </div>
      </div>

      {loading ? (
        <div className="surface-card p-12 text-center text-[12px] text-muted-foreground">Carregando…</div>
      ) : (
        <>
          <div className="surface-card p-4">
            <div className="text-[12px] font-medium mb-3">Volume orçado por dia</div>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="data" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                  <Line type="monotone" dataKey="valor" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="surface-card p-4">
              <div className="text-[12px] font-medium mb-3">Pedidos por Status</div>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={statusPedidos}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="surface-card p-4">
              <div className="text-[12px] font-medium mb-3">Tipos de Ocorrência</div>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={tiposOcorr} dataKey="value" nameKey="name" outerRadius={80} label>
                      {tiposOcorr.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
