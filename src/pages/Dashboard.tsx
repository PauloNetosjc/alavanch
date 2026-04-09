import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Users, ShoppingCart, FileSignature,
  DollarSign, Wrench, AlertTriangle, TrendingUp, TrendingDown,
  ArrowUpRight, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const PIPELINE_COLORS = [
  'hsl(200, 70%, 50%)', // novo_lead
  'hsl(152, 35%, 28%)', // em_atendimento
  'hsl(240, 50%, 60%)', // em_elaboracao
  'hsl(38, 92%, 50%)', // enviado
  'hsl(25, 70%, 50%)', // em_negociacao
  'hsl(0, 0%, 55%)',   // acomp
  'hsl(145, 60%, 45%)', // fechado
  'hsl(0, 72%, 51%)',  // declinado
];

const PIPELINE_LABELS: Record<string, string> = {
  novo_lead: 'Novo Lead',
  em_atendimento: 'Atendimento',
  em_elaboracao: 'Elaboração',
  enviado: 'Enviado',
  em_negociacao: 'Negociação',
  acomp_7d: 'Acomp 7d',
  acomp_15d: 'Acomp 15d',
  acomp_30d: 'Acomp 30d',
  '30d_plus': '30d+',
  fechado: 'Fechado',
  declinado: 'Declinado',
  arquivado: 'Arquivado',
};

interface KPI {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: string;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [pipelineData, setPipelineData] = useState<{ name: string; count: number }[]>([]);
  const [revenueData, setRevenueData] = useState<{ month: string; valor: number }[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<{ code: string; client: string; value: number; status: string }[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);

    const [quotesRes, ordersRes, contractsRes, occurrencesRes, financialRes] = await Promise.all([
      supabase.from('quotes').select('id, status, final_value, total_value, code, created_at, clients(name)'),
      supabase.from('orders').select('id, final_value, contract_status, revision_status, assembly_status, financial_status, occurrence_status, created_at'),
      supabase.from('contracts').select('id, status'),
      supabase.from('occurrences').select('id, status'),
      supabase.from('financial_entries').select('id, value, type, status, due_date, paid_date'),
    ]);

    const quotes = quotesRes.data ?? [];
    const orders = ordersRes.data ?? [];
    const contractsList = contractsRes.data ?? [];
    const occurrencesList = occurrencesRes.data ?? [];
    const financial = financialRes.data ?? [];

    // KPIs
    const openQuotes = quotes.filter(q => !['fechado', 'declinado', 'arquivado'].includes(q.status)).length;
    const closedQuotes = quotes.filter(q => q.status === 'fechado').length;
    const closeRate = quotes.length > 0 ? Math.round((closedQuotes / quotes.length) * 100) : 0;
    const activeOrders = orders.length;
    const pendingContracts = contractsList.filter(c => c.status !== 'assinado').length;
    const openOccurrences = occurrencesList.filter(o => o.status === 'aberta').length;

    // Revenue this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthRevenue = financial
      .filter(f => f.type === 'receita' && f.status === 'pago' && f.paid_date && f.paid_date >= monthStart)
      .reduce((sum, f) => sum + (f.value ?? 0), 0);

    // Revenue pending
    const pendingRevenue = financial
      .filter(f => f.type === 'receita' && f.status !== 'pago')
      .reduce((sum, f) => sum + (f.value ?? 0), 0);

    // Total order value
    const totalOrderValue = orders.reduce((sum, o) => sum + (o.final_value ?? 0), 0);

    setKpis([
      { label: 'Orçamentos abertos', value: String(openQuotes), icon: FileText, color: 'text-primary' },
      { label: 'Taxa de fechamento', value: `${closeRate}%`, icon: TrendingUp, color: 'text-emerald-600' },
      { label: 'Pedidos ativos', value: String(activeOrders), icon: ShoppingCart, color: 'text-primary' },
      { label: 'Valor total pedidos', value: fmtCompact(totalOrderValue), icon: DollarSign, color: 'text-emerald-600' },
      { label: 'Contratos pendentes', value: String(pendingContracts), icon: FileSignature, color: 'text-amber-600' },
      { label: 'Ocorrências abertas', value: String(openOccurrences), icon: AlertTriangle, color: 'text-amber-600' },
      { label: 'Recebido (mês)', value: fmtCompact(monthRevenue), icon: TrendingUp, color: 'text-emerald-600' },
      { label: 'A receber', value: fmtCompact(pendingRevenue), icon: DollarSign, color: 'text-primary' },
    ]);

    // Pipeline
    const statusCount: Record<string, number> = {};
    quotes.forEach(q => { statusCount[q.status] = (statusCount[q.status] ?? 0) + 1; });
    const pipeline = Object.entries(PIPELINE_LABELS)
      .map(([key, name]) => ({ name, count: statusCount[key] ?? 0 }))
      .filter(p => p.count > 0);
    setPipelineData(pipeline);

    // Revenue by month (last 6 months from orders)
    const monthsMap: Record<string, number> = {};
    orders.forEach(o => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap[key] = (monthsMap[key] ?? 0) + (o.final_value ?? 0);
    });
    const sortedMonths = Object.entries(monthsMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
    setRevenueData(sortedMonths.map(([m, v]) => ({
      month: new Date(m + '-01T00:00').toLocaleDateString('pt-BR', { month: 'short' }),
      valor: v,
    })));

    // Recent quotes
    const recent = quotes
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map(q => ({
        code: q.code,
        client: (q as any).clients?.name ?? '—',
        value: q.final_value ?? q.total_value ?? 0,
        status: PIPELINE_LABELS[q.status] ?? q.status,
      }));
    setRecentQuotes(recent);

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral do sistema Forest Decor</p>
        </div>
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do sistema Forest Decor</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((stat) => (
          <Card key={stat.label} className="border-border/60 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold font-body">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Faturamento por mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de faturamento ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => fmtCompact(v)} />
                  <Tooltip
                    formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="valor" fill="hsl(152, 35%, 28%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pipeline */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Pipeline de orçamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pipelineData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum orçamento no pipeline.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pipelineData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="name"
                    label={({ name, count }) => `${name}: ${count}`}
                    labelLine={false}
                  >
                    {pipelineData.map((_, index) => (
                      <Cell key={index} fill={PIPELINE_COLORS[index % PIPELINE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent quotes */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Orçamentos recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentQuotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum orçamento recente.</p>
          ) : (
            <div className="space-y-2">
              {recentQuotes.map((q, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{q.code}</span>
                    <span className="text-sm font-medium">{q.client}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{q.value > 0 ? `R$ ${q.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—'}</span>
                    <Badge variant="outline" className="text-[10px]">{q.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function fmtCompact(v: number): string {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
}
