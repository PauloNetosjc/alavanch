import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, TrendingUp, Users, Activity, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

const COLORS = ['hsl(var(--primary))', '#a78b5f', '#7a5c3b', '#3f5b3b', '#c0a36c', '#5a7a4f'];

const fmt = (v: number) => `R$ ${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function Relatorios() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [o, q, fe, oc, cl, fc] = await Promise.all([
        supabase.from('orders').select('id, code, client_id, final_value, total_cost, order_date, assembly_status, delivery_status, production_status, contract_status'),
        supabase.from('quotes').select('id, status, final_value, created_at'),
        supabase.from('financial_entries').select('id, type, value, paid_value, paid_date, due_date, status, category_id'),
        supabase.from('occurrences').select('id, status, opened_at, closed_at, priority, type'),
        supabase.from('clients').select('id, name'),
        supabase.from('financial_categories').select('id, name, type'),
      ]);
      setOrders(o.data ?? []);
      setQuotes(q.data ?? []);
      setEntries(fe.data ?? []);
      setOccurrences(oc.data ?? []);
      setClients(cl.data ?? []);
      setCategories(fc.data ?? []);
      setLoading(false);
    })();
  }, []);

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients]);
  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories]);

  // ── Vendas
  const salesByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => {
      if (!o.order_date) return;
      const k = o.order_date.slice(0, 7);
      map[k] = (map[k] ?? 0) + Number(o.final_value ?? 0);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([month, value]) => ({ month, value }));
  }, [orders]);

  const conversionRate = useMemo(() => {
    const total = quotes.length;
    const won = quotes.filter(q => q.status === 'fechado' || q.status === 'ganho').length;
    return total ? Math.round((won / total) * 100) : 0;
  }, [quotes]);

  const ticketMedio = useMemo(() => {
    const valid = orders.filter(o => Number(o.final_value) > 0);
    if (!valid.length) return 0;
    return valid.reduce((s, o) => s + Number(o.final_value), 0) / valid.length;
  }, [orders]);

  // ── Operacional
  const occurrencesByStatus = useMemo(() => {
    const m: Record<string, number> = {};
    occurrences.forEach(o => { m[o.status] = (m[o.status] ?? 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [occurrences]);

  const avgResolutionDays = useMemo(() => {
    const closed = occurrences.filter(o => o.closed_at && o.opened_at);
    if (!closed.length) return 0;
    const total = closed.reduce((s, o) =>
      s + (new Date(o.closed_at).getTime() - new Date(o.opened_at).getTime()) / 86400000, 0);
    return Math.round((total / closed.length) * 10) / 10;
  }, [occurrences]);

  const ordersByStage = useMemo(() => {
    const m: Record<string, number> = {};
    orders.forEach(o => {
      const s = o.assembly_status ?? 'pendente';
      m[s] = (m[s] ?? 0) + 1;
    });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [orders]);

  // ── DRE
  const dre = useMemo(() => {
    const receitas = entries.filter(e => e.type === 'receita' && e.status === 'pago')
      .reduce((s, e) => s + Number(e.paid_value ?? e.value ?? 0), 0);
    const despesas = entries.filter(e => e.type === 'despesa' && e.status === 'pago')
      .reduce((s, e) => s + Number(e.paid_value ?? e.value ?? 0), 0);
    const aReceber = entries.filter(e => e.type === 'receita' && e.status !== 'pago')
      .reduce((s, e) => s + Number(e.value ?? 0), 0);
    const aPagar = entries.filter(e => e.type === 'despesa' && e.status !== 'pago')
      .reduce((s, e) => s + Number(e.value ?? 0), 0);
    return { receitas, despesas, lucro: receitas - despesas, aReceber, aPagar };
  }, [entries]);

  const dreByCategory = useMemo(() => {
    const map: Record<string, { name: string; type: string; total: number }> = {};
    entries.filter(e => e.status === 'pago').forEach(e => {
      const cat = catMap[e.category_id];
      const key = cat?.name ?? 'Sem categoria';
      if (!map[key]) map[key] = { name: key, type: cat?.type ?? e.type, total: 0 };
      map[key].total += Number(e.paid_value ?? e.value ?? 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [entries, catMap]);

  // ── Ranking de clientes
  const ranking = useMemo(() => {
    const m: Record<string, { name: string; total: number; count: number }> = {};
    orders.forEach(o => {
      const name = clientMap[o.client_id] ?? '—';
      if (!m[o.client_id]) m[o.client_id] = { name, total: 0, count: 0 };
      m[o.client_id].total += Number(o.final_value ?? 0);
      m[o.client_id].count += 1;
    });
    return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 20);
  }, [orders, clientMap]);

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground text-sm">Carregando relatórios...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-1">Análises e indicadores gerenciais</p>
      </div>

      <Tabs defaultValue="vendas">
        <TabsList>
          <TabsTrigger value="vendas"><TrendingUp className="h-4 w-4 mr-1.5" />Vendas</TabsTrigger>
          <TabsTrigger value="operacional"><Activity className="h-4 w-4 mr-1.5" />Operacional</TabsTrigger>
          <TabsTrigger value="dre"><FileText className="h-4 w-4 mr-1.5" />DRE</TabsTrigger>
          <TabsTrigger value="ranking"><Users className="h-4 w-4 mr-1.5" />Ranking</TabsTrigger>
        </TabsList>

        {/* VENDAS */}
        <TabsContent value="vendas" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Pedidos totais</div>
              <div className="text-2xl font-semibold mt-1">{orders.length}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Ticket médio</div>
              <div className="text-2xl font-semibold mt-1">{fmt(ticketMedio)}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Conversão de orçamentos</div>
              <div className="text-2xl font-semibold mt-1">{conversionRate}%</div>
            </CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Receita por mês</CardTitle></CardHeader>
            <CardContent>
              {salesByMonth.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-12">Sem dados.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesByMonth}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => fmt(Number(v))} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPERACIONAL */}
        <TabsContent value="operacional" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Ocorrências abertas</div>
              <div className="text-2xl font-semibold mt-1">{occurrences.filter(o => o.status === 'aberta' || o.status === 'em_analise').length}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Tempo médio de resolução</div>
              <div className="text-2xl font-semibold mt-1">{avgResolutionDays} dias</div>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Pedidos ativos</div>
              <div className="text-2xl font-semibold mt-1">{orders.length}</div>
            </CardContent></Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Ocorrências por status</CardTitle></CardHeader>
              <CardContent>
                {occurrencesByStatus.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-12">Sem ocorrências.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={occurrencesByStatus} dataKey="value" nameKey="name" outerRadius={90} label>
                        {occurrencesByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Pedidos por estágio (Montagem)</CardTitle></CardHeader>
              <CardContent>
                {ordersByStage.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-12">Sem dados.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={ordersByStage} layout="vertical">
                      <XAxis type="number" fontSize={11} />
                      <YAxis dataKey="name" type="category" fontSize={11} width={120} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* DRE */}
        <TabsContent value="dre" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card><CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Receitas (pagas)</div>
              <div className="text-xl font-semibold mt-1 text-emerald-600">{fmt(dre.receitas)}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Despesas (pagas)</div>
              <div className="text-xl font-semibold mt-1 text-destructive">{fmt(dre.despesas)}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Lucro</div>
              <div className={`text-xl font-semibold mt-1 ${dre.lucro >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{fmt(dre.lucro)}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">A receber</div>
              <div className="text-xl font-semibold mt-1">{fmt(dre.aReceber)}</div>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">A pagar</div>
              <div className="text-xl font-semibold mt-1">{fmt(dre.aPagar)}</div>
            </CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Por categoria</CardTitle></CardHeader>
            <CardContent>
              {dreByCategory.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-12">Sem lançamentos pagos.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dreByCategory.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-xs uppercase text-muted-foreground">{c.type}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(c.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RANKING */}
        <TabsContent value="ranking" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Top 20 clientes por receita</CardTitle></CardHeader>
            <CardContent>
              {ranking.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-12">Sem pedidos.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-center">Pedidos</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-center">{r.count}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(r.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
