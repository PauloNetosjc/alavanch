import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, ShoppingCart, Eye, FileText, CheckSquare, Wrench,
  DollarSign, AlertTriangle, Calendar, User, Store, CreditCard, Loader2,
  Package,
} from 'lucide-react';
import { maskPhone, maskCpf } from '@/lib/masks';
import type { Tables as DbTables } from '@/integrations/supabase/types';
import PromobImportDialog from '@/components/orders/PromobImportDialog';

interface OrderWithRelations extends DbTables<'orders'> {
  clients: { name: string; phone: string | null; email: string | null; cpf: string | null; delivery_address: string | null } | null;
  stores: { name: string } | null;
}

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido', label: 'Concluído' },
];

const OCCURRENCE_STATUS_OPTIONS = [
  { value: 'sem_ocorrencias', label: 'Sem ocorrências' },
  { value: 'com_ocorrencias', label: 'Com ocorrências' },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  em_andamento: { label: 'Em andamento', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  concluido: { label: 'Concluído', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  sem_ocorrencias: { label: 'Sem ocorrências', color: 'bg-muted text-muted-foreground' },
  com_ocorrencias: { label: 'Com ocorrências', color: 'bg-red-100 text-red-800 border-red-300' },
};

const getStatusBadge = (status: string | null) => {
  const s = statusLabels[status ?? 'pendente'] ?? { label: status ?? '—', color: '' };
  return <Badge variant="outline" className={`text-[10px] ${s.color}`}>{s.label}</Badge>;
};

export default function Pedidos() {
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithRelations | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [contracts, setContracts] = useState<DbTables<'contracts'>[]>([]);
  const [financialEntries, setFinancialEntries] = useState<DbTables<'financial_entries'>[]>([]);
  const [occurrences, setOccurrences] = useState<DbTables<'occurrences'>[]>([]);
  const [environments, setEnvironments] = useState<DbTables<'order_environments'>[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, clients(name, phone, email, cpf, delivery_address), stores(name)')
      .order('created_at', { ascending: false });
    setOrders((data as OrderWithRelations[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const openDetail = async (order: OrderWithRelations) => {
    setSelectedOrder(order);
    setDetailOpen(true);
    setDetailLoading(true);

    const [contractsRes, financialRes, occurrencesRes, envsRes] = await Promise.all([
      supabase.from('contracts').select('*').eq('order_id', order.id).order('created_at', { ascending: false }),
      supabase.from('financial_entries').select('*').eq('order_id', order.id).order('due_date'),
      supabase.from('occurrences').select('*').eq('order_id', order.id).order('created_at', { ascending: false }),
      supabase.from('order_environments').select('*').eq('order_id', order.id).order('name'),
    ]);
    setContracts(contractsRes.data ?? []);
    setFinancialEntries(financialRes.data ?? []);
    setOccurrences(occurrencesRes.data ?? []);
    setEnvironments(envsRes.data ?? []);
    setDetailLoading(false);
  };

  const handleStatusChange = async (field: 'contract_status' | 'revision_status' | 'assembly_status' | 'financial_status' | 'post_assembly_status' | 'occurrence_status', value: string) => {
    if (!selectedOrder) return;
    const prev = selectedOrder[field];
    setSelectedOrder({ ...selectedOrder, [field]: value } as OrderWithRelations);
    setOrders(prev2 => prev2.map(o => o.id === selectedOrder.id ? { ...o, [field]: value } as OrderWithRelations : o));

    const updateObj: Record<string, string> = {};
    updateObj[field] = value;
    const { error } = await supabase.from('orders').update(updateObj as any).eq('id', selectedOrder.id);
    if (error) {
      toast.error('Erro ao atualizar status');
      setSelectedOrder({ ...selectedOrder, [field]: prev } as OrderWithRelations);
      setOrders(prev2 => prev2.map(o => o.id === selectedOrder.id ? { ...o, [field]: prev } as OrderWithRelations : o));
    } else {
      toast.success('Status atualizado');
    }
  };

  const fmt = (v: number | null | undefined) =>
    v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d.includes('T') ? d : d + 'T00:00').toLocaleDateString('pt-BR') : '—';

  const filteredOrders = orders.filter(o => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return o.code.toLowerCase().includes(s) || o.clients?.name?.toLowerCase().includes(s) || o.clients?.phone?.includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Pedidos</h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhamento e gestão de pedidos</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código, cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary" className="text-xs">
          {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredOrders.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum pedido encontrado.</p>
            <p className="text-xs mt-1">Converta um orçamento para criar um pedido.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor final</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Revisão</TableHead>
                    <TableHead>Montagem</TableHead>
                    <TableHead>Financeiro</TableHead>
                    <TableHead>Ocorrências</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map(o => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => openDetail(o)}>
                      <TableCell className="font-mono text-xs">{o.code}</TableCell>
                      <TableCell className="font-medium">{o.clients?.name ?? '—'}</TableCell>
                      <TableCell>{fmt(o.final_value)}</TableCell>
                      <TableCell>{getStatusBadge(o.contract_status)}</TableCell>
                      <TableCell>{getStatusBadge(o.revision_status)}</TableCell>
                      <TableCell>{getStatusBadge(o.assembly_status)}</TableCell>
                      <TableCell>{getStatusBadge(o.financial_status)}</TableCell>
                      <TableCell>{getStatusBadge(o.occurrence_status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openDetail(o); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 360° Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {selectedOrder?.code ?? 'Pedido'}
            </SheetTitle>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : selectedOrder ? (
            <div className="mt-4">
              {/* Editable status cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <StatusSelect icon={<FileText className="h-4 w-4" />} label="Contrato" value={selectedOrder.contract_status ?? 'pendente'} options={STATUS_OPTIONS} onChange={v => handleStatusChange('contract_status', v)} />
                <StatusSelect icon={<CheckSquare className="h-4 w-4" />} label="Revisão" value={selectedOrder.revision_status ?? 'pendente'} options={STATUS_OPTIONS} onChange={v => handleStatusChange('revision_status', v)} />
                <StatusSelect icon={<Wrench className="h-4 w-4" />} label="Montagem" value={selectedOrder.assembly_status ?? 'pendente'} options={STATUS_OPTIONS} onChange={v => handleStatusChange('assembly_status', v)} />
                <StatusSelect icon={<DollarSign className="h-4 w-4" />} label="Financeiro" value={selectedOrder.financial_status ?? 'pendente'} options={STATUS_OPTIONS} onChange={v => handleStatusChange('financial_status', v)} />
                <StatusSelect icon={<Wrench className="h-4 w-4" />} label="Pós-montagem" value={selectedOrder.post_assembly_status ?? 'pendente'} options={STATUS_OPTIONS} onChange={v => handleStatusChange('post_assembly_status', v)} />
                <StatusSelect icon={<AlertTriangle className="h-4 w-4" />} label="Ocorrências" value={selectedOrder.occurrence_status ?? 'sem_ocorrencias'} options={OCCURRENCE_STATUS_OPTIONS} onChange={v => handleStatusChange('occurrence_status', v)} />
              </div>

              <Tabs defaultValue="resumo">
                <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
                  <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
                  <TabsTrigger value="contrato" className="text-xs">Contrato</TabsTrigger>
                  <TabsTrigger value="financeiro" className="text-xs">Financeiro</TabsTrigger>
                  <TabsTrigger value="ambientes" className="text-xs">Ambientes</TabsTrigger>
                  <TabsTrigger value="ocorrencias" className="text-xs">Ocorrências</TabsTrigger>
                </TabsList>

                <TabsContent value="resumo" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Cliente
                    </h3>
                    <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-sm">
                      <p className="font-medium">{selectedOrder.clients?.name ?? '—'}</p>
                      {selectedOrder.clients?.phone && <p className="text-muted-foreground">{maskPhone(selectedOrder.clients.phone)}</p>}
                      {selectedOrder.clients?.email && <p className="text-muted-foreground">{selectedOrder.clients.email}</p>}
                      {selectedOrder.clients?.cpf && <p className="text-muted-foreground">CPF: {maskCpf(selectedOrder.clients.cpf)}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedOrder.stores?.name && (
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Store className="h-3 w-3" /> Loja</span>
                        <p className="font-medium">{selectedOrder.stores.name}</p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Data do pedido</span>
                      <p className="font-medium">{fmtDate(selectedOrder.order_date)}</p>
                    </div>
                    {selectedOrder.factory_send_date && (
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Envio fábrica</span>
                        <p className="font-medium">{fmtDate(selectedOrder.factory_send_date)}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5" /> Valores
                    </h3>
                    <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor total</span>
                        <span>{fmt(selectedOrder.total_value)}</span>
                      </div>
                      {(selectedOrder.discount_percent ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Desconto ({selectedOrder.discount_percent}%)</span>
                          <span className="text-destructive">-{fmt(selectedOrder.discount_value)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between font-semibold text-base">
                        <span>Valor final</span>
                        <span className="text-primary">{fmt(selectedOrder.final_value)}</span>
                      </div>
                    </div>
                  </div>

                  {selectedOrder.snapshot && (
                    <div className="text-xs text-muted-foreground bg-muted/20 rounded p-2">
                      Convertido do orçamento <span className="font-mono font-medium">{(selectedOrder.snapshot as Record<string, unknown>).quote_code as string}</span>
                      {' em '}
                      {fmtDate((selectedOrder.snapshot as Record<string, unknown>).converted_at as string)}
                    </div>
                  )}

                  {selectedOrder.internal_comments && (
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase">Comentários internos</h3>
                      <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{selectedOrder.internal_comments}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="contrato" className="mt-4">
                  {contracts.length === 0 ? (
                    <EmptyTab icon={<FileText className="h-8 w-8" />} text="Nenhum contrato vinculado." />
                  ) : (
                    <div className="space-y-3">
                      {contracts.map(c => (
                        <Card key={c.id} className="border-border/60">
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Contrato v{c.version}</span>
                              {getStatusBadge(c.status)}
                            </div>
                            {c.sent_at && <p className="text-xs text-muted-foreground">Enviado: {fmtDate(c.sent_at)}</p>}
                            {c.signed_at && <p className="text-xs text-muted-foreground">Assinado: {fmtDate(c.signed_at)}</p>}
                            {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="financeiro" className="mt-4">
                  {financialEntries.length === 0 ? (
                    <EmptyTab icon={<DollarSign className="h-8 w-8" />} text="Nenhum lançamento financeiro." />
                  ) : (
                    <div className="space-y-2">
                      {financialEntries.map(f => (
                        <div key={f.id} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{f.description ?? `Parcela ${f.installment_number ?? ''}`}</p>
                            <p className="text-xs text-muted-foreground">Vencimento: {fmtDate(f.due_date)}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${f.type === 'receita' ? 'text-emerald-600' : 'text-destructive'}`}>
                              {f.type === 'receita' ? '+' : '-'}{fmt(f.value)}
                            </p>
                            {getStatusBadge(f.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="ambientes" className="mt-4">
                  {environments.length === 0 ? (
                    <EmptyTab icon={<Package className="h-8 w-8" />} text="Nenhum ambiente cadastrado." />
                  ) : (
                    <div className="space-y-2">
                      {environments.map(env => (
                        <Card key={env.id} className="border-border/60">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{env.name}</span>
                              <span className="text-sm text-muted-foreground">{fmt(env.value)}</span>
                            </div>
                            {env.description && <p className="text-xs text-muted-foreground mt-1">{env.description}</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="ocorrencias" className="mt-4">
                  {occurrences.length === 0 ? (
                    <EmptyTab icon={<AlertTriangle className="h-8 w-8" />} text="Nenhuma ocorrência registrada." />
                  ) : (
                    <div className="space-y-3">
                      {occurrences.map(occ => (
                        <Card key={occ.id} className="border-border/60">
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">{occ.type}</Badge>
                                <Badge variant="outline" className={`text-[10px] ${
                                  occ.priority === 'alta' || occ.priority === 'urgente' ? 'border-destructive text-destructive' : ''
                                }`}>{occ.priority}</Badge>
                              </div>
                              {getStatusBadge(occ.status)}
                            </div>
                            {occ.description && <p className="text-sm">{occ.description}</p>}
                            {occ.solution && (
                              <div className="bg-muted/20 rounded p-2">
                                <p className="text-xs font-medium">Solução:</p>
                                <p className="text-xs text-muted-foreground">{occ.solution}</p>
                              </div>
                            )}
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>Aberta: {fmtDate(occ.opened_at)}</span>
                              {occ.closed_at && <span>Fechada: {fmtDate(occ.closed_at)}</span>}
                              {occ.deadline && <span>Prazo: {fmtDate(occ.deadline)}</span>}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatusSelect({ icon, label, value, options, onChange }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const s = statusLabels[value] ?? { label: value, color: '' };
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${s.color || 'bg-muted/30'}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs bg-background/80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmptyTab({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="py-8 text-center text-muted-foreground">
      <div className="mx-auto mb-2 opacity-30">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}
