import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

interface Stats {
  totalClientes: number;
  totalLeads: number;
  leadsAbertos: number;
  totalOrcamentos: number;
  totalPedidos: number;
  faturamentoMes: number;
  porStatus: { status: string; total: number }[];
  porDia: { dia: string; valor: number }[];
}

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(n);

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const [clientesQ, leadsQ, leadsAbertosQ, orcamentosQ, pedidosQ, pedidosMesQ, orcamentosStatusQ] = await Promise.all([
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("id", { count: "exact", head: true }).neq("status", "convertido").neq("status", "perdido"),
        supabase.from("orcamentos").select("id", { count: "exact", head: true }),
        supabase.from("pedidos").select("id", { count: "exact", head: true }),
        supabase.from("pedidos").select("valor_total, created_at").gte("created_at", inicioMes.toISOString()),
        supabase.from("orcamentos").select("status"),
      ]);

      const faturamentoMes = (pedidosMesQ.data ?? []).reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);

      const statusMap: Record<string, number> = {};
      (orcamentosStatusQ.data ?? []).forEach((o) => {
        statusMap[o.status] = (statusMap[o.status] ?? 0) + 1;
      });
      const porStatus = Object.entries(statusMap).map(([status, total]) => ({ status, total }));

      // Faturamento por dia (últimos 14 dias)
      const dias: Record<string, number> = {};
      const hoje = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(hoje);
        d.setDate(hoje.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dias[key] = 0;
      }
      (pedidosMesQ.data ?? []).forEach((p) => {
        const key = new Date(p.created_at).toISOString().slice(0, 10);
        if (key in dias) dias[key] += Number(p.valor_total) || 0;
      });
      const porDia = Object.entries(dias).map(([dia, valor]) => ({
        dia: dia.slice(8, 10) + "/" + dia.slice(5, 7),
        valor,
      }));

      setStats({
        totalClientes: clientesQ.count ?? 0,
        totalLeads: leadsQ.count ?? 0,
        leadsAbertos: leadsAbertosQ.count ?? 0,
        totalOrcamentos: orcamentosQ.count ?? 0,
        totalPedidos: pedidosQ.count ?? 0,
        faturamentoMes,
        porStatus,
        porDia,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader icon={LayoutDashboard} iconVariant="blue" title="Dashboard" subtitle="Visão geral do sistema" />
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <PageHeader icon={LayoutDashboard} iconVariant="blue" title="Dashboard" subtitle="Visão geral do sistema" />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <KpiCard label="Clientes" value={stats.totalClientes} hint="cadastrados" />
        <KpiCard label="Leads abertos" value={stats.leadsAbertos} hint={`${stats.totalLeads} no total`} />
        <KpiCard label="Orçamentos" value={stats.totalOrcamentos} hint="emitidos" />
        <KpiCard label="Faturamento (mês)" value={fmtBrl(stats.faturamentoMes)} hint={`${stats.totalPedidos} pedidos`} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="surface-card col-span-2">
          <div className="kpi-label mb-3">Faturamento — últimos 14 dias</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.porDia}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "0.5px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(v: number) => fmtBrl(v)}
                />
                <Area type="monotone" dataKey="valor" stroke="hsl(var(--accent))" strokeWidth={1.5} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card">
          <div className="kpi-label mb-3">Orçamentos por status</div>
          <div className="h-64">
            {stats.porStatus.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground">
                Sem dados
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.porStatus} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="status" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "0.5px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
