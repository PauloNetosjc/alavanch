import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths, parseISO, isWithinInterval, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp, TrendingDown, Plus, Search, CheckCircle2, AlertTriangle,
  Landmark, ArrowUpRight, ArrowDownRight, BarChart3, Filter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, Line
} from 'recharts';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import type { Tables } from '@/integrations/supabase/types';

type FinancialEntry = Tables<'financial_entries'>;
type BankAccount = Tables<'bank_accounts'>;
type FinancialCategory = Tables<'financial_categories'>;

const fmt = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string | null | undefined) =>
  d ? format(parseISO(d), 'dd/MM/yyyy') : '—';

const statusMap: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-warning/20 text-warning border-warning/30' },
  pago: { label: 'Pago', color: 'bg-success/20 text-success border-success/30' },
  vencido: { label: 'Vencido', color: 'bg-destructive/20 text-destructive border-destructive/30' },
  cancelado: { label: 'Cancelado', color: 'bg-muted text-muted-foreground border-border' },
};

const paymentMethods = [
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cheque', label: 'Cheque' },
];

// ─── Entry Form Dialog with Installment Support ───
function EntryFormDialog({
  open, onClose, type, accounts, categories, entry,
}: {
  open: boolean;
  onClose: (saved?: boolean) => void;
  type: 'receita' | 'despesa';
  accounts: BankAccount[];
  categories: FinancialCategory[];
  entry?: FinancialEntry | null;
}) {
  const [form, setForm] = useState({
    description: '', value: '', due_date: '', payment_method: '',
    bank_account_id: '', category_id: '',
  });
  const [parcelado, setParcelado] = useState(false);
  const [numParcelas, setNumParcelas] = useState('2');
  const [intervaloDias, setIntervaloDias] = useState('30');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setForm({
        description: entry.description ?? '', value: String(entry.value ?? ''),
        due_date: entry.due_date ?? '', payment_method: entry.payment_method ?? '',
        bank_account_id: entry.bank_account_id ?? '', category_id: entry.category_id ?? '',
      });
      setParcelado(false);
    } else {
      setForm({ description: '', value: '', due_date: '', payment_method: '', bank_account_id: '', category_id: '' });
      setParcelado(false);
      setNumParcelas('2');
      setIntervaloDias('30');
    }
  }, [entry, open]);

  const filteredCategories = categories.filter(c => c.type === type);
  const totalValue = parseFloat(form.value) || 0;
  const parcelas = parseInt(numParcelas) || 2;
  const valorParcela = totalValue / parcelas;

  const save = async () => {
    if (!form.description || !form.value || !form.due_date) {
      toast.error('Preencha os campos obrigatórios'); return;
    }
    setSaving(true);

    try {
      if (entry) {
        // Update single entry
        const { error } = await supabase.from('financial_entries').update({
          type, description: form.description, value: parseFloat(form.value),
          due_date: form.due_date, payment_method: form.payment_method || null,
          bank_account_id: form.bank_account_id || null, category_id: form.category_id || null,
        }).eq('id', entry.id);
        if (error) throw error;
        toast.success('Lançamento atualizado');
      } else if (parcelado && parcelas > 1) {
        // Generate installments
        const baseDate = parseISO(form.due_date);
        const intervalo = parseInt(intervaloDias) || 30;
        const entries = Array.from({ length: parcelas }, (_, i) => ({
          type, description: `${form.description} (${i + 1}/${parcelas})`,
          value: Math.round(valorParcela * 100) / 100,
          due_date: format(addDays(baseDate, i * intervalo), 'yyyy-MM-dd'),
          payment_method: form.payment_method || null,
          bank_account_id: form.bank_account_id || null,
          category_id: form.category_id || null,
          installment_number: i + 1, status: 'pendente',
        }));
        // Adjust last installment for rounding
        const sum = entries.reduce((s, e) => s + e.value, 0);
        const diff = Math.round((totalValue - sum) * 100) / 100;
        if (diff !== 0) entries[entries.length - 1].value += diff;

        const { error } = await supabase.from('financial_entries').insert(entries);
        if (error) throw error;
        toast.success(`${parcelas} parcelas criadas com sucesso`);
      } else {
        const { error } = await supabase.from('financial_entries').insert({
          type, description: form.description, value: parseFloat(form.value),
          due_date: form.due_date, payment_method: form.payment_method || null,
          bank_account_id: form.bank_account_id || null, category_id: form.category_id || null,
          status: 'pendente',
        });
        if (error) throw error;
        toast.success('Lançamento criado');
      }
      onClose(true);
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? 'Editar' : 'Novo'} {type === 'receita' ? 'Receita' : 'Despesa'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div><Label>Descrição *</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Valor Total (R$) *</Label><Input type="number" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></div>
            <div><Label>Vencimento *</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta Bancária</Label>
              <Select value={form.bank_account_id} onValueChange={v => setForm(f => ({ ...f, bank_account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Installment toggle */}
          {!entry && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Parcelado</Label>
                <Switch checked={parcelado} onCheckedChange={setParcelado} />
              </div>
              {parcelado && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Nº de Parcelas</Label><Input type="number" min="2" max="60" value={numParcelas} onChange={e => setNumParcelas(e.target.value)} /></div>
                  <div><Label className="text-xs">Intervalo (dias)</Label><Input type="number" min="1" value={intervaloDias} onChange={e => setIntervaloDias(e.target.value)} /></div>
                  {totalValue > 0 && (
                    <div className="col-span-2 bg-muted/50 rounded p-2 text-sm">
                      <span className="text-muted-foreground">{parcelas}x de </span>
                      <span className="font-mono font-semibold">{fmt(valorParcela)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Salvando…' : parcelado && !entry ? `Gerar ${parcelas} parcelas` : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Entries Table ───
function EntriesTable({
  entries, type, onEdit, onMarkPaid, search, statusFilter, dateFrom, dateTo,
}: {
  entries: FinancialEntry[]; type: 'receita' | 'despesa';
  onEdit: (e: FinancialEntry) => void; onMarkPaid: (e: FinancialEntry) => void;
  search: string; statusFilter: string;
  dateFrom?: Date; dateTo?: Date;
}) {
  const filtered = entries.filter(e => {
    if (e.type !== type) return false;
    if (statusFilter && statusFilter !== 'todos' && e.status !== statusFilter) return false;
    if (search && !e.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && e.due_date) {
      const d = parseISO(e.due_date);
      if (d < dateFrom) return false;
    }
    if (dateTo && e.due_date) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (parseISO(e.due_date) > end) return false;
    }
    return true;
  });

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Descrição</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</TableCell></TableRow>
          )}
          {filtered.map(e => {
            const st = statusMap[e.status ?? 'pendente'] ?? statusMap.pendente;
            return (
              <TableRow key={e.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onEdit(e)}>
                <TableCell className="font-medium">{e.description}</TableCell>
                <TableCell className="text-right font-mono">{fmt(e.value)}</TableCell>
                <TableCell>{fmtDate(e.due_date)}</TableCell>
                <TableCell className="capitalize">{e.payment_method?.replace('_', ' ') ?? '—'}</TableCell>
                <TableCell><Badge variant="outline" className={st.color}>{st.label}</Badge></TableCell>
                <TableCell className="text-right">
                  {e.status === 'pendente' && (
                    <Button size="sm" variant="ghost" className="text-success" onClick={(ev) => { ev.stopPropagation(); onMarkPaid(e); }}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Baixar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Main Page ───
export default function Financeiro() {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<'receita' | 'despesa'>('receita');
  const [editEntry, setEditEntry] = useState<FinancialEntry | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const fetchAll = async () => {
    setLoading(true);
    const [r1, r2, r3] = await Promise.all([
      supabase.from('financial_entries').select('*').order('due_date', { ascending: false }),
      supabase.from('bank_accounts').select('*').order('name'),
      supabase.from('financial_categories').select('*').order('name'),
    ]);
    setEntries(r1.data ?? []);
    setAccounts(r2.data ?? []);
    setCategories(r3.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const markPaid = async (e: FinancialEntry) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { error } = await supabase.from('financial_entries').update({
      status: 'pago', paid_date: today, paid_value: e.value,
    }).eq('id', e.id);
    if (error) { toast.error('Erro ao baixar'); return; }
    toast.success('Lançamento baixado');
    fetchAll();
  };

  const openNew = (type: 'receita' | 'despesa') => { setFormType(type); setEditEntry(null); setFormOpen(true); };
  const openEdit = (e: FinancialEntry) => { setFormType(e.type as 'receita' | 'despesa'); setEditEntry(e); setFormOpen(true); };
  const handleFormClose = (saved?: boolean) => { setFormOpen(false); setEditEntry(null); if (saved) fetchAll(); };

  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const kpis = useMemo(() => {
    const receitas = entries.filter(e => e.type === 'receita');
    const despesas = entries.filter(e => e.type === 'despesa');
    const aReceber = receitas.filter(e => e.status === 'pendente').reduce((s, e) => s + (e.value ?? 0), 0);
    const aPagar = despesas.filter(e => e.status === 'pendente').reduce((s, e) => s + (e.value ?? 0), 0);
    const recebido = receitas.filter(e => e.status === 'pago' && e.paid_date && isWithinInterval(parseISO(e.paid_date), { start: monthStart, end: monthEnd }))
      .reduce((s, e) => s + (e.paid_value ?? e.value ?? 0), 0);
    const pago = despesas.filter(e => e.status === 'pago' && e.paid_date && isWithinInterval(parseISO(e.paid_date), { start: monthStart, end: monthEnd }))
      .reduce((s, e) => s + (e.paid_value ?? e.value ?? 0), 0);
    const vencidas = entries.filter(e => e.status === 'pendente' && e.due_date && parseISO(e.due_date) < today).length;
    const saldoBancos = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
    return { aReceber, aPagar, recebido, pago, vencidas, saldoBancos, projetado: saldoBancos + aReceber - aPagar };
  }, [entries, accounts, monthStart, monthEnd, today]);

  const cashFlowData = useMemo(() => {
    const months = eachMonthOfInterval({ start: subMonths(today, 5), end: addMonths(today, 2) });
    return months.map(m => {
      const ms = startOfMonth(m); const me = endOfMonth(m);
      const label = format(m, 'MMM/yy', { locale: ptBR });
      const receitasMes = entries.filter(e => e.type === 'receita' && e.due_date && isWithinInterval(parseISO(e.due_date), { start: ms, end: me }))
        .reduce((s, e) => s + (e.value ?? 0), 0);
      const despesasMes = entries.filter(e => e.type === 'despesa' && e.due_date && isWithinInterval(parseISO(e.due_date), { start: ms, end: me }))
        .reduce((s, e) => s + (e.value ?? 0), 0);
      return { label, receitas: receitasMes, despesas: despesasMes, saldo: receitasMes - despesasMes };
    });
  }, [entries, today]);

  const bankData = useMemo(() => {
    return accounts.map(acc => {
      const accEntries = entries.filter(e => e.bank_account_id === acc.id);
      const pendentes = accEntries.filter(e => e.status === 'pendente');
      const receitasPend = pendentes.filter(e => e.type === 'receita').reduce((s, e) => s + (e.value ?? 0), 0);
      const despesasPend = pendentes.filter(e => e.type === 'despesa').reduce((s, e) => s + (e.value ?? 0), 0);
      return { ...acc, pendentes: pendentes.length, receitasPendentes: receitasPend, despesasPendentes: despesasPend, saldoProjetado: (acc.balance ?? 0) + receitasPend - despesasPend };
    });
  }, [accounts, entries]);

  const kpiCards = [
    { label: 'Saldo Bancos', value: fmt(kpis.saldoBancos), icon: Landmark, color: 'text-muted-foreground' },
    { label: 'A Receber', value: fmt(kpis.aReceber), icon: ArrowUpRight, color: 'text-success' },
    { label: 'A Pagar', value: fmt(kpis.aPagar), icon: ArrowDownRight, color: 'text-destructive' },
    { label: 'Saldo Projetado', value: fmt(kpis.projetado), icon: TrendingUp, color: 'text-primary' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle financeiro e fluxo de caixa</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openNew('despesa')}><TrendingDown className="h-4 w-4 mr-2" /> Nova Despesa</Button>
          <Button onClick={() => openNew('receita')}><Plus className="h-4 w-4 mr-2" /> Nova Receita</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(c => (
          <Card key={c.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent><div className="text-2xl font-semibold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      {kpis.vencidas > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">{kpis.vencidas} lançamento(s) vencido(s)!</span>
        </div>
      )}

      <Tabs defaultValue="receber" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="receber">Contas a Receber</TabsTrigger>
          <TabsTrigger value="pagar">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
        </TabsList>

        <div className="flex gap-3 mt-4 mb-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar lançamento…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="receber">
          <EntriesTable entries={entries} type="receita" onEdit={openEdit} onMarkPaid={markPaid} search={search} statusFilter={statusFilter} />
        </TabsContent>
        <TabsContent value="pagar">
          <EntriesTable entries={entries} type="despesa" onEdit={openEdit} onMarkPaid={markPaid} search={search} statusFilter={statusFilter} />
        </TabsContent>

        <TabsContent value="conciliacao">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {bankData.length === 0 && (
              <Card className="col-span-full border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Landmark className="h-10 w-10 mb-3" />
                  <p>Nenhuma conta bancária cadastrada</p>
                  <p className="text-xs mt-1">Cadastre contas em Configurações</p>
                </CardContent>
              </Card>
            )}
            {bankData.map(b => (
              <Card key={b.id} className="border-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{b.name}</CardTitle>
                    <Badge variant="outline" className={b.active ? 'bg-success/10 text-success border-success/30 text-xs' : 'text-xs'}>{b.active ? 'Ativa' : 'Inativa'}</Badge>
                  </div>
                  {b.bank && <p className="text-xs text-muted-foreground">{b.bank} {b.agency && `| Ag: ${b.agency}`} {b.account_number && `| CC: ${b.account_number}`}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Saldo Atual</span><span className="font-mono font-semibold">{fmt(b.balance)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground flex items-center gap-1"><ArrowUpRight className="h-3 w-3 text-success" /> A Receber</span><span className="font-mono text-success">{fmt(b.receitasPendentes)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground flex items-center gap-1"><ArrowDownRight className="h-3 w-3 text-destructive" /> A Pagar</span><span className="font-mono text-destructive">{fmt(b.despesasPendentes)}</span></div>
                  <div className="border-t border-border pt-2 flex justify-between text-sm font-medium">
                    <span>Saldo Projetado</span>
                    <span className={`font-mono ${b.saldoProjetado >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(b.saldoProjetado)}</span>
                  </div>
                  {b.pendentes > 0 && <p className="text-xs text-muted-foreground">{b.pendentes} lançamento(s) pendente(s)</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="fluxo">
          <div className="grid gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-border/60"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Recebido este mês</CardTitle></CardHeader><CardContent><span className="text-xl font-semibold text-success">{fmt(kpis.recebido)}</span></CardContent></Card>
              <Card className="border-border/60"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Pago este mês</CardTitle></CardHeader><CardContent><span className="text-xl font-semibold text-destructive">{fmt(kpis.pago)}</span></CardContent></Card>
              <Card className="border-border/60"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Resultado do mês</CardTitle></CardHeader><CardContent><span className={`text-xl font-semibold ${kpis.recebido - kpis.pago >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(kpis.recebido - kpis.pago)}</span></CardContent></Card>
            </div>
            <Card className="border-border/60">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Fluxo de Caixa — 8 Meses</CardTitle></CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashFlowData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={(value: number) => fmt(value)} />
                      <Legend />
                      <Bar dataKey="receitas" name="Receitas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <EntryFormDialog open={formOpen} onClose={handleFormClose} type={formType} accounts={accounts} categories={categories} entry={editEntry} />
    </div>
  );
}
