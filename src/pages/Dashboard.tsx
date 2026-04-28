import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText, ShoppingCart, FileSignature,
  DollarSign, Wrench, AlertTriangle, TrendingUp,
  Loader2, Users, Target, BarChart3, ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const PIPELINE_COLORS = [
  'hsl(200, 70%, 50%)', 'hsl(152, 35%, 28%)', 'hsl(240, 50%, 60%)',
  'hsl(38, 92%, 50%)', 'hsl(25, 70%, 50%)', 'hsl(0, 0%, 55%)',
  'hsl(145, 60%, 45%)', 'hsl(0, 72%, 51%)',
];

const PIPELINE_LABELS: Record<string, string> = {
  novo_lead: 'Novo Lead', em_atendimento: 'Atendimento', em_elaboracao: 'Elaboração',
  enviado: 'Enviado', em_negociacao: 'Negociação', acomp_7d: 'Acomp 7d',
  acomp_15d: 'Acomp 15d', acomp_30d: 'Acomp 30d', '30d_plus': '30d+',
  fechado: 'Fechado', declinado: 'Declinado', arquivado: 'Arquivado',
};

interface KPI {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [pipelineData, setPipelineData] = useState<{ name: string; count: number }[]>([]);
  const [revenueData, setRevenueData] = useState<{ month: string; valor: number }[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<{ code: string; client: string; value: number; status: string }[]>([]);
  const [sellerRanking, setSellerRanking] = useState<{ name: string; total: number; count: number }[]>([]);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setLoading(true);

    const [quotesRes, ordersRes, contractsRes, occurrencesRes, financialRes, profilesRes, approvalsRes] = await Promise.all([
      supabase.from('quotes').select('id, status, final_value, total_value, code, created_at, seller_id, approval_status, clients(name)'),
      supabase.from('orders').select('id, final_value, created_at, contract_status, snapshot'),
      supabase.from('contracts').select('id, status'),
      supabase.from('occurrences').select('id, status'),
      supabase.from('financial_entries').select('id, value, type, status, due_date, paid_date, order_id'),
      supabase.from('profiles').select('user_id, full_name'),
      supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('approval_status', 'aguardando'),
    ]);

    const quotes = quotesRes.data ?? [];
    const orders = ordersRes.data ?? [];
    const contractsList = contractsRes.data ?? [];
    const occurrencesList = occurrencesRes.data ?? [];
    const financial = financialRes.data ?? [];
    const profiles = profilesRes.data ?? [];

    const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name ?? 'Sem nome']));
    setPendingApprovals(approvalsRes.count ?? 0);

    // KPI calculations
    const openQuotes = quotes.filter(q => !['fechado', 'declinado', 'arquivado'].includes(q.status)).length;
    const closedQuotes = quotes.filter(q => q.status === 'fechado').length;
    const conversionRate = quotes.length > 0 ? Math.round((closedQuotes / quotes.length) * 100) : 0;
    // Active orders = not archived/cancelled (orders table has no status field, so use snapshot/contract)
    const activeOrders = orders.length;
    // Contratos pendentes = contracts in 'pendente' status OR orders whose contract_status indicates pending
    const pendingContracts = contractsList.filter(c => c.status === 'pendente' || c.status === 'rascunho').length
      + orders.filter(o => o.contract_status && ['pendente', 'aguardando', 'em_elaboracao'].includes(o.contract_status as string)).length;
    const openOccurrences = occurrencesList.filter(o => o.status === 'aberta').length;

    // Revenue this month: sum final_value from orders created this month (excluding cancelled/archived)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRevenue = orders
      .filter(o => new Date(o.created_at) >= monthStart)
      .reduce((s, o) => s + (o.final_value ?? 0), 0);

    // Average ticket (closed quotes with value)
    const closedWithValue = quotes.filter(q => q.status === 'fechado' && (q.final_value ?? 0) > 0);
    const avgTicket = closedWithValue.length > 0
      ? closedWithValue.reduce((s, q) => s + (q.final_value ?? 0), 0) / closedWithValue.length
      : 0;

    // A Receber: parcelas pendentes (status pendente) de pedidos ativos
    const activeOrderIds = new Set(orders.map(o => o.id));
    const pendingRevenue = financial
      .filter(f => f.type === 'receita' && f.status === 'pendente' && (!f.order_id || activeOrderIds.has(f.order_id)))
      .reduce((s, f) => s + (f.value ?? 0), 0);

    const totalOrderValue = orders.reduce((s, o) => s + (o.final_value ?? 0), 0);

    setKpis([
      { label: 'Receita mensal', value: fmtCompact(monthRevenue), icon: DollarSign, color: 'text-emerald-600' },
      { label: 'Ticket médio', value: fmtCompact(avgTicket), icon: BarChart3, color: 'text-primary' },
      { label: 'Taxa de conversão', value: `${conversionRate}%`, icon: Target, color: 'text-emerald-600' },
      { label: 'Orçamentos abertos', value: String(openQuotes), icon: FileText, color: 'text-primary' },
      { label: 'Pedidos ativos', value: String(activeOrders), icon: ShoppingCart, color: 'text-primary' },
      { label: 'Valor total pedidos', value: fmtCompact(totalOrderValue), icon: DollarSign, color: 'text-emerald-600' },
      { label: 'Contratos pendentes', value: String(pendingContracts), icon: FileSignature, color: 'text-amber-600' },
      { label: 'A receber', value: fmtCompact(pendingRevenue), icon: TrendingUp, color: 'text-primary' },
    ]);

    // Pipeline
    const statusCount: Record<string, number> = {};
    quotes.forEach(q => { statusCount[q.status] = (statusCount[q.status] ?? 0) + 1; });
    setPipelineData(
      Object.entries(PIPELINE_LABELS).map(([k, n]) => ({ name: n, count: statusCount[k] ?? 0 })).filter(p => p.count > 0)
    );

    // Revenue by month (last 6)
    const monthsMap: Record<string, number> = {};
    orders.forEach(o => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap[key] = (monthsMap[key] ?? 0) + (o.final_value ?? 0);
    });
    setRevenueData(
      Object.entries(monthsMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
        .map(([m, v]) => ({ month: new Date(m + '-01T00:00').toLocaleDateString('pt-BR', { month: 'short' }), valor: v }))
    );

    // Seller ranking (from closed quotes)
    const sellerMap: Record<string, { total: number; count: number }> = {};
    quotes.filter(q => q.status === 'fechado' && q.seller_id).forEach(q => {
      const sid = q.seller_id!;
      if (!sellerMap[sid]) sellerMap[sid] = { total: 0, count: 0 };
      sellerMap[sid].total += (q.final_value ?? 0);
      sellerMap[sid].count += 1;
    });
    const ranking = Object.entries(sellerMap)
      .map(([uid, v]) => ({ name: profileMap.get(uid) ?? uid.slice(0, 8), ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    setSellerRanking(ranking);

    // Recent quotes
    setRecentQuotes(
      quotes.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)
        .map(q => ({
          code: q.code,
          client: (q as any).clients?.name ?? '—',
          value: q.final_value ?? q.total_value ?? 0,
          status: PIPELINE_LABELS[q.status] ?? q.status,
        }))
    );

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

      {pendingApprovals > 0 && (
        <Card className="border-purple-300 bg-purple-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-purple-700" />
              <div>
                <p className="text-sm font-medium text-purple-900">
                  {pendingApprovals} orçamento{pendingApprovals > 1 ? 's' : ''} aguardando aprovação de desconto
                </p>
                <p className="text-xs text-purple-700/80">Revise e libere a conversão em pedido em Administração → Aprovações.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="border-purple-400 text-purple-800 hover:bg-purple-100" onClick={() => navigate('/administracao')}>
              Revisar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(stat => (
          <Card key={stat.label} className="border-border/60 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold font-body">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="valor" fill="hsl(152, 35%, 28%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

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
                  <Pie data={pipelineData} cx="50%" cy="50%" innerRadius={50} outerRadius={90}
                    paddingAngle={3} dataKey="count" nameKey="name"
                    label={({ name, count }) => `${name}: ${count}`} labelLine={false}>
                    {pipelineData.map((_, i) => <Cell key={i} fill={PIPELINE_COLORS[i % PIPELINE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seller ranking + Recent quotes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Ranking de vendedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sellerRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados de vendedores ainda.</p>
            ) : (
              <div className="space-y-3">
                {sellerRanking.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                      <span className="text-sm font-medium">{s.name}</span>
                      <Badge variant="outline" className="text-[10px]">{s.count} vendas</Badge>
                    </div>
                    <span className="text-sm font-mono font-medium">{fmtCompact(s.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
    </div>
  );
}

function fmtCompact(v: number): string {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
}
