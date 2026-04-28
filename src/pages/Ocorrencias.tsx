import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, AlertTriangle, Eye, Pencil, Trash2, CheckCircle2 } from 'lucide-react';

type Occ = {
  id: string;
  code: string | null;
  order_id: string;
  client_id: string;
  type: string;
  priority: string | null;
  description: string | null;
  status: string;
  solution: string | null;
  deadline: string | null;
  opened_at: string;
  closed_at: string | null;
};

const TYPES = ['Defeito', 'Avaria de transporte', 'Atraso', 'Reclamação', 'Garantia', 'Retrabalho', 'Outros'];
const PRIORITIES = [
  { v: 'baixa', l: 'Baixa' }, { v: 'media', l: 'Média' }, { v: 'alta', l: 'Alta' }, { v: 'urgente', l: 'Urgente' },
];
const STATUSES = [
  { v: 'aberta', l: 'Aberta' }, { v: 'em_analise', l: 'Em análise' }, { v: 'resolvida', l: 'Resolvida' }, { v: 'cancelada', l: 'Cancelada' },
];

export default function Ocorrencias() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [list, setList] = useState<Occ[]>([]);
  const [orders, setOrders] = useState<{ id: string; code: string; client_id: string; clients: { name: string } | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('abertas');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Occ | null>(null);
  const [form, setForm] = useState({
    order_id: '', type: TYPES[0], priority: 'media', description: '', status: 'aberta', solution: '', deadline: '',
  });

  useEffect(() => {
    if (!user) return;
    supabase.from('user_roles').select('role').eq('user_id', user.id).then(({ data }) => {
      setIsAdmin(data?.some(r => r.role === 'admin') ?? false);
    });
  }, [user]);

  const load = async () => {
    setLoading(true);
    const [occRes, ordRes] = await Promise.all([
      supabase.from('occurrences').select('*').order('opened_at', { ascending: false }),
      supabase.from('orders').select('id, code, client_id, clients(name)').order('order_date', { ascending: false }).limit(500),
    ]);
    setList((occRes.data as any) ?? []);
    setOrders((ordRes.data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ order_id: '', type: TYPES[0], priority: 'media', description: '', status: 'aberta', solution: '', deadline: '' });
    setOpen(true);
  };
  const openEdit = (o: Occ) => {
    setEditing(o);
    setForm({
      order_id: o.order_id, type: o.type, priority: o.priority ?? 'media',
      description: o.description ?? '', status: o.status, solution: o.solution ?? '',
      deadline: o.deadline ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.order_id) { toast.error('Selecione um pedido'); return; }
    const order = orders.find(o => o.id === form.order_id);
    if (!order) { toast.error('Pedido inválido'); return; }
    const payload: any = {
      order_id: form.order_id,
      client_id: order.client_id,
      type: form.type,
      priority: form.priority,
      description: form.description || null,
      status: form.status,
      solution: form.solution || null,
      deadline: form.deadline || null,
    };
    if (form.status === 'resolvida' || form.status === 'cancelada') {
      payload.closed_at = new Date().toISOString();
    }
    if (editing) {
      const { error } = await supabase.from('occurrences').update(payload).eq('id', editing.id);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Ocorrência atualizada');
    } else {
      const { data, error } = await supabase.from('occurrences').insert(payload).select().single();
      if (error) { toast.error('Erro ao criar: ' + error.message); return; }
      toast.success(`Ocorrência ${data.code ?? ''} criada`);
      await supabase.from('orders').update({ occurrence_status: 'com_ocorrencias' } as any).eq('id', form.order_id);
      await supabase.from('timeline_events').insert({
        entity_type: 'order', entity_id: form.order_id, event_type: 'occurrence_created',
        description: `Ocorrência aberta: ${form.type}`, user_id: user?.id,
      });
    }
    setOpen(false);
    load();
  };

  const remove = async (o: Occ) => {
    if (!confirm('Excluir esta ocorrência?')) return;
    const { error } = await supabase.from('occurrences').delete().eq('id', o.id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Excluída');
    load();
  };

  const quickResolve = async (o: Occ) => {
    const { error } = await supabase.from('occurrences').update({
      status: 'resolvida', closed_at: new Date().toISOString(),
    } as any).eq('id', o.id);
    if (error) { toast.error('Erro'); return; }
    toast.success('Marcada como resolvida');
    load();
  };

  const filtered = list.filter(o => {
    if (search) {
      const s = search.toLowerCase();
      if (!o.code?.toLowerCase().includes(s) && !o.description?.toLowerCase().includes(s) && !o.type.toLowerCase().includes(s)) return false;
    }
    if (tab === 'abertas') return o.status === 'aberta' || o.status === 'em_analise';
    if (tab === 'resolvidas') return o.status === 'resolvida';
    if (tab === 'canceladas') return o.status === 'cancelada';
    return true;
  });

  const orderLabel = (id: string) => {
    const o = orders.find(x => x.id === id);
    return o ? `${o.code} — ${o.clients?.name ?? ''}` : '—';
  };

  const priorityBadge = (p: string | null) => {
    const cls = p === 'urgente' ? 'border-destructive text-destructive bg-destructive/5'
      : p === 'alta' ? 'border-amber-500 text-amber-700 bg-amber-50'
      : p === 'baixa' ? 'border-muted-foreground/30 text-muted-foreground' : '';
    return <Badge variant="outline" className={`text-[10px] ${cls}`}>{p ?? '—'}</Badge>;
  };

  const statusBadge = (s: string) => {
    const cls = s === 'aberta' ? 'border-blue-500 text-blue-700 bg-blue-50'
      : s === 'em_analise' ? 'border-amber-500 text-amber-700 bg-amber-50'
      : s === 'resolvida' ? 'border-green-600 text-green-700 bg-green-50'
      : 'text-muted-foreground';
    return <Badge variant="outline" className={`text-[10px] ${cls}`}>{STATUSES.find(x => x.v === s)?.l ?? s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Ocorrências</h1>
          <p className="text-sm text-muted-foreground mt-1">Registro e acompanhamento de ocorrências</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nova Ocorrência</Button>
      </div>

      <div className="flex items-center gap-3">
        <Input placeholder="Buscar por código, tipo ou descrição..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="abertas">Abertas ({list.filter(o => o.status === 'aberta' || o.status === 'em_analise').length})</TabsTrigger>
          <TabsTrigger value="resolvidas">Resolvidas ({list.filter(o => o.status === 'resolvida').length})</TabsTrigger>
          <TabsTrigger value="canceladas">Canceladas ({list.filter(o => o.status === 'cancelada').length})</TabsTrigger>
          <TabsTrigger value="todas">Todas ({list.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="py-12 text-center text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma ocorrência encontrada.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(o => (
                <Card key={o.id} className="border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-semibold text-primary">{o.code ?? '—'}</span>
                          <Badge variant="outline" className="text-[10px]">{o.type}</Badge>
                          {priorityBadge(o.priority)}
                          {statusBadge(o.status)}
                        </div>
                        <p className="text-sm font-medium">{orderLabel(o.order_id)}</p>
                        {o.description && <p className="text-sm text-muted-foreground line-clamp-2">{o.description}</p>}
                        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                          <span>Aberta: {format(parseISO(o.opened_at), 'dd/MM/yyyy')}</span>
                          {o.deadline && <span>Prazo: {format(parseISO(o.deadline), 'dd/MM/yyyy')}</span>}
                          {o.closed_at && <span>Fechada: {format(parseISO(o.closed_at), 'dd/MM/yyyy')}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(o.status === 'aberta' || o.status === 'em_analise') && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => quickResolve(o)} title="Resolver">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(o)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => remove(o)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${editing.code ?? 'ocorrência'}` : 'Nova ocorrência'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Pedido</label>
              <Select value={form.order_id} onValueChange={v => setForm(f => ({ ...f, order_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione um pedido" /></SelectTrigger>
                <SelectContent>
                  {orders.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.code} — {o.clients?.name ?? '—'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prioridade</label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prazo</label>
              <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
              <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Solução</label>
              <Textarea rows={2} value={form.solution} onChange={e => setForm(f => ({ ...f, solution: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
