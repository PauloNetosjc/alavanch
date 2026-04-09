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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, ShoppingCart, Eye, FileText, CheckSquare, Wrench,
  DollarSign, AlertTriangle, Calendar, User, Store, CreditCard, Loader2,
  Package, Upload, RotateCcw, Clock, Paperclip, Tag, MessageSquare,
  Phone, Mail, MapPin, Hash, ArrowRightLeft, Info,
} from 'lucide-react';
import { maskPhone, maskCpf } from '@/lib/masks';
import type { Tables as DbTables } from '@/integrations/supabase/types';
import PromobImportDialog from '@/components/orders/PromobImportDialog';

interface OrderWithRelations extends DbTables<'orders'> {
  clients: { name: string; phone: string | null; email: string | null; cpf: string | null; delivery_address: string | null; billing_address: string | null; birth_date: string | null; notes: string | null } | null;
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
  const [envItems, setEnvItems] = useState<Record<string, DbTables<'order_items'>[]>>({});
  const [imports, setImports] = useState<DbTables<'promob_imports'>[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<DbTables<'timeline_events'>[]>([]);
  const [attachments, setAttachments] = useState<DbTables<'attachments'>[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTargetEnvId, setImportTargetEnvId] = useState<string | null>(null);
  const [expandedEnv, setExpandedEnv] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, clients(name, phone, email, cpf, delivery_address, billing_address, birth_date, notes), stores(name)')
      .order('created_at', { ascending: false });
    setOrders((data as OrderWithRelations[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const openDetail = async (order: OrderWithRelations) => {
    setSelectedOrder(order);
    setDetailOpen(true);
    setDetailLoading(true);
    setExpandedEnv(null);

    const [contractsRes, financialRes, occurrencesRes, envsRes, importsRes, timelineRes, attachmentsRes] = await Promise.all([
      supabase.from('contracts').select('*').eq('order_id', order.id).order('created_at', { ascending: false }),
      supabase.from('financial_entries').select('*').eq('order_id', order.id).order('due_date'),
      supabase.from('occurrences').select('*').eq('order_id', order.id).order('created_at', { ascending: false }),
      supabase.from('order_environments').select('*').eq('order_id', order.id).order('name'),
      supabase.from('promob_imports').select('*').eq('order_id', order.id).order('created_at', { ascending: false }),
      supabase.from('timeline_events').select('*').eq('entity_id', order.id).eq('entity_type', 'order').order('created_at', { ascending: false }),
      supabase.from('attachments').select('*').eq('entity_id', order.id).eq('entity_type', 'order').order('created_at', { ascending: false }),
    ]);
    setContracts(contractsRes.data ?? []);
    setFinancialEntries(financialRes.data ?? []);
    setOccurrences(occurrencesRes.data ?? []);
    const envs = envsRes.data ?? [];
    setEnvironments(envs);
    setImports(importsRes.data ?? []);
    setTimelineEvents(timelineRes.data ?? []);
    setAttachments(attachmentsRes.data ?? []);

    if (envs.length > 0) {
      const envIds = envs.map(e => e.id);
      const { data: items } = await supabase.from('order_items').select('*').in('environment_id', envIds).order('index_num');
      const grouped: Record<string, DbTables<'order_items'>[]> = {};
      (items ?? []).forEach(it => {
        if (!grouped[it.environment_id]) grouped[it.environment_id] = [];
        grouped[it.environment_id].push(it);
      });
      setEnvItems(grouped);
    } else {
      setEnvItems({});
    }

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

  const fmtDateTime = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  const filteredOrders = orders.filter(o => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return o.code.toLowerCase().includes(s) || o.clients?.name?.toLowerCase().includes(s) || o.clients?.phone?.includes(s);
  });

  // Alerts / pendencies for Resumo tab
  const getAlerts = () => {
    if (!selectedOrder) return [];
    const alerts: { text: string; severity: 'warning' | 'error' }[] = [];
    if (selectedOrder.contract_status === 'pendente') alerts.push({ text: 'Contrato pendente', severity: 'warning' });
    if (selectedOrder.revision_status === 'pendente') alerts.push({ text: 'Revisão pendente', severity: 'warning' });
    if (selectedOrder.financial_status === 'pendente') alerts.push({ text: 'Financeiro pendente', severity: 'warning' });
    if (selectedOrder.assembly_status === 'pendente') alerts.push({ text: 'Montagem pendente', severity: 'warning' });
    if (selectedOrder.occurrence_status === 'com_ocorrencias') alerts.push({ text: 'Existem ocorrências abertas', severity: 'error' });
    if (!selectedOrder.factory_send_date) alerts.push({ text: 'Data de envio à fábrica não definida', severity: 'warning' });
    return alerts;
  };

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
        <SheetContent className="w-full sm:max-w-3xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-3">
            <SheetTitle className="font-display flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {selectedOrder?.code ?? 'Pedido'}
              <span className="text-sm font-normal text-muted-foreground ml-2">Visão 360°</span>
            </SheetTitle>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12 flex-1"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : selectedOrder ? (
            <ScrollArea className="flex-1 px-6 pb-6">
              {/* Status cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <StatusSelect icon={<FileText className="h-4 w-4" />} label="Contrato" value={selectedOrder.contract_status ?? 'pendente'} options={STATUS_OPTIONS} onChange={v => handleStatusChange('contract_status', v)} />
                <StatusSelect icon={<CheckSquare className="h-4 w-4" />} label="Revisão" value={selectedOrder.revision_status ?? 'pendente'} options={STATUS_OPTIONS} onChange={v => handleStatusChange('revision_status', v)} />
                <StatusSelect icon={<Wrench className="h-4 w-4" />} label="Montagem" value={selectedOrder.assembly_status ?? 'pendente'} options={STATUS_OPTIONS} onChange={v => handleStatusChange('assembly_status', v)} />
                <StatusSelect icon={<DollarSign className="h-4 w-4" />} label="Financeiro" value={selectedOrder.financial_status ?? 'pendente'} options={STATUS_OPTIONS} onChange={v => handleStatusChange('financial_status', v)} />
                <StatusSelect icon={<Wrench className="h-4 w-4" />} label="Pós-montagem" value={selectedOrder.post_assembly_status ?? 'pendente'} options={STATUS_OPTIONS} onChange={v => handleStatusChange('post_assembly_status', v)} />
                <StatusSelect icon={<AlertTriangle className="h-4 w-4" />} label="Ocorrências" value={selectedOrder.occurrence_status ?? 'sem_ocorrencias'} options={OCCURRENCE_STATUS_OPTIONS} onChange={v => handleStatusChange('occurrence_status', v)} />
              </div>

              <Tabs defaultValue="resumo">
                <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
                  <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
                  <TabsTrigger value="cliente" className="text-xs">Cliente</TabsTrigger>
                  <TabsTrigger value="ambientes" className="text-xs">Ambientes</TabsTrigger>
                  <TabsTrigger value="contrato" className="text-xs">Contrato</TabsTrigger>
                  <TabsTrigger value="financeiro" className="text-xs">Financeiro</TabsTrigger>
                  <TabsTrigger value="revisao" className="text-xs">Revisão</TabsTrigger>
                  <TabsTrigger value="montagem" className="text-xs">Montagem</TabsTrigger>
                  <TabsTrigger value="pos-montagem" className="text-xs">Pós-montagem</TabsTrigger>
                  <TabsTrigger value="ocorrencias" className="text-xs">Ocorrências</TabsTrigger>
                  <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
                  <TabsTrigger value="anexos" className="text-xs">Anexos</TabsTrigger>
                </TabsList>

                {/* ====== RESUMO ====== */}
                <TabsContent value="resumo" className="space-y-4 mt-4">
                  {/* Alerts */}
                  {getAlerts().length > 0 && (
                    <div className="space-y-1.5">
                      {getAlerts().map((a, i) => (
                        <div key={i} className={`flex items-center gap-2 text-xs rounded-md px-3 py-2 ${a.severity === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'}`}>
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                          {a.text}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <InfoItem icon={Hash} label="Código" value={selectedOrder.code} mono />
                    <InfoItem icon={User} label="Cliente" value={selectedOrder.clients?.name} />
                    <InfoItem icon={Store} label="Loja" value={selectedOrder.stores?.name} />
                    <InfoItem icon={User} label="Vendedor" value={selectedOrder.seller_id ? 'Vinculado' : '—'} />
                    <InfoItem icon={Calendar} label="Data do pedido" value={fmtDate(selectedOrder.order_date)} />
                    <InfoItem icon={Calendar} label="Envio fábrica" value={fmtDate(selectedOrder.factory_send_date)} />
                  </div>

                  <Separator />

                  {/* Values */}
                  <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
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

                  {/* Tags */}
                  {selectedOrder.tags && selectedOrder.tags.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Tags</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedOrder.tags.map((t, i) => <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>)}
                      </div>
                    </div>
                  )}

                  {/* Internal comments */}
                  {selectedOrder.internal_comments && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Comentários internos</span>
                      <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{selectedOrder.internal_comments}</p>
                    </div>
                  )}

                  {selectedOrder.snapshot && (
                    <div className="text-xs text-muted-foreground bg-muted/20 rounded p-2 flex items-center gap-1.5">
                      <ArrowRightLeft className="h-3 w-3" />
                      Convertido do orçamento <span className="font-mono font-medium">{(selectedOrder.snapshot as Record<string, unknown>).quote_code as string}</span>
                      {' em '}
                      {fmtDate((selectedOrder.snapshot as Record<string, unknown>).converted_at as string)}
                    </div>
                  )}
                </TabsContent>

                {/* ====== CLIENTE ====== */}
                <TabsContent value="cliente" className="space-y-4 mt-4">
                  {selectedOrder.clients ? (
                    <>
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados pessoais</h3>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                          <InfoItem icon={User} label="Nome" value={selectedOrder.clients.name} />
                          <InfoItem icon={Hash} label="CPF" value={selectedOrder.clients.cpf ? maskCpf(selectedOrder.clients.cpf) : null} />
                          <InfoItem icon={Calendar} label="Nascimento" value={fmtDate(selectedOrder.clients.birth_date)} />
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato</h3>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                          <InfoItem icon={Phone} label="Telefone" value={selectedOrder.clients.phone ? maskPhone(selectedOrder.clients.phone) : null} />
                          <InfoItem icon={Mail} label="E-mail" value={selectedOrder.clients.email} />
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereços</h3>
                        <div className="space-y-3 text-sm">
                          <InfoItem icon={MapPin} label="Endereço de entrega" value={selectedOrder.clients.delivery_address} />
                          <InfoItem icon={MapPin} label="Endereço de cobrança" value={selectedOrder.clients.billing_address} />
                        </div>
                      </div>

                      {selectedOrder.clients.notes && (
                        <>
                          <Separator />
                          <div className="space-y-1">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações</h3>
                            <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{selectedOrder.clients.notes}</p>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <EmptyTab icon={<User className="h-8 w-8" />} text="Dados do cliente não disponíveis." />
                  )}
                </TabsContent>

                {/* ====== AMBIENTES ====== */}
                <TabsContent value="ambientes" className="mt-4 space-y-3">
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => { setImportTargetEnvId(null); setImportDialogOpen(true); }}>
                      <Upload className="h-4 w-4 mr-1" /> Importar arquivo Promob
                    </Button>
                  </div>

                  {environments.length === 0 ? (
                    <EmptyTab icon={<Package className="h-8 w-8" />} text="Nenhum ambiente cadastrado. Importe um arquivo Promob para começar." />
                  ) : (
                    <div className="space-y-2">
                      {environments.map(env => {
                        const items = envItems[env.id] ?? [];
                        const isExpanded = expandedEnv === env.id;
                        const envImport = imports.find(imp => imp.environment_id === env.id);
                        return (
                          <Card key={env.id} className="border-border/60">
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedEnv(isExpanded ? null : env.id)}>
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-medium">{env.name}</span>
                                  <Badge variant="secondary" className="text-[10px]">{items.length} itens</Badge>
                                  {envImport && <span className="text-[10px] text-muted-foreground">• {fmtDate(envImport.created_at)}</span>}
                                </div>
                                <span className="text-sm font-semibold text-primary">{fmt(env.value)}</span>
                              </div>

                              {isExpanded && (
                                <div className="space-y-2 pt-2">
                                  <div className="flex gap-2 flex-wrap">
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setImportTargetEnvId(env.id); setImportDialogOpen(true); }}>
                                      <RotateCcw className="h-3 w-3 mr-1" /> Reimportar
                                    </Button>
                                    {envImport?.raw_content && (
                                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => {
                                        e.stopPropagation();
                                        const blob = new Blob([envImport.raw_content!], { type: 'text/plain' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `promob_${env.name.replace(/\s+/g, '_')}.txt`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                      }}>
                                        <FileText className="h-3 w-3 mr-1" /> Baixar TXT
                                      </Button>
                                    )}
                                  </div>

                                  {envImport && (
                                    <div className="text-xs text-muted-foreground bg-muted/20 rounded px-2 py-1">
                                      Versão {envImport.version} • Importado em {fmtDate(envImport.created_at)}
                                      {envImport.project_id && <> • Projeto: <span className="font-mono">{envImport.project_id}</span></>}
                                    </div>
                                  )}

                                  {items.length > 0 ? (
                                    <div className="overflow-x-auto max-h-[250px] overflow-y-auto border rounded">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="text-xs w-[40px]">#</TableHead>
                                            <TableHead className="text-xs w-[40px]">Qtd</TableHead>
                                            <TableHead className="text-xs">Descrição</TableHead>
                                            <TableHead className="text-xs w-[100px]">Medidas</TableHead>
                                            <TableHead className="text-xs w-[80px]">Custo</TableHead>
                                            <TableHead className="text-xs w-[80px]">Acab.</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {items.map(it => (
                                            <TableRow key={it.id}>
                                              <TableCell className="text-xs">{it.index_num}</TableCell>
                                              <TableCell className="text-xs">{it.quantity}</TableCell>
                                              <TableCell className="text-xs font-medium">{it.description}</TableCell>
                                              <TableCell className="text-xs text-muted-foreground">
                                                {[it.width, it.height, it.depth].filter(Boolean).join(' × ') || '—'}
                                              </TableCell>
                                              <TableCell className="text-xs">{fmt(it.cost)}</TableCell>
                                              <TableCell className="text-xs text-muted-foreground">{it.finish || '—'}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground text-center py-2">Nenhum item neste ambiente.</p>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {imports.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico de importações</h4>
                      {imports.map(imp => (
                        <div key={imp.id} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-xs font-medium">Versão {imp.version} — {imp.client_name || 'Sem cliente'}</p>
                            <p className="text-[10px] text-muted-foreground">{fmtDate(imp.created_at)} • Projeto: {imp.project_id || '—'}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{imp.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ====== CONTRATO ====== */}
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
                            {c.signature_link && <p className="text-xs text-muted-foreground">Link: <span className="font-mono">{c.signature_link}</span></p>}
                            {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ====== FINANCEIRO ====== */}
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
                            {f.paid_date && <p className="text-xs text-muted-foreground">Pago em: {fmtDate(f.paid_date)}</p>}
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${f.type === 'receita' ? 'text-emerald-600' : 'text-destructive'}`}>
                              {f.type === 'receita' ? '+' : '-'}{fmt(f.value)}
                            </p>
                            {getStatusBadge(f.status)}
                          </div>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex justify-between text-sm font-semibold px-3">
                        <span>Total</span>
                        <span className="text-primary">{fmt(financialEntries.reduce((s, f) => s + (f.type === 'receita' ? Number(f.value) : -Number(f.value)), 0))}</span>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ====== REVISÃO ====== */}
                <TabsContent value="revisao" className="mt-4 space-y-4">
                  <StatusSelect icon={<CheckSquare className="h-4 w-4" />} label="Status da Revisão" value={selectedOrder.revision_status ?? 'pendente'} options={STATUS_OPTIONS} onChange={v => handleStatusChange('revision_status', v)} />
                  <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-2">
                    <p className="text-muted-foreground">Acompanhe aqui o status da revisão técnica do pedido.</p>
                    <p className="text-xs text-muted-foreground">Use o controle acima para atualizar o status conforme o progresso da revisão.</p>
                  </div>
                </TabsContent>

                {/* ====== MONTAGEM ====== */}
                <TabsContent value="montagem" className="mt-4 space-y-4">
                  <StatusSelect icon={<Wrench className="h-4 w-4" />} label="Status da Montagem" value={selectedOrder.assembly_status ?? 'pendente'} options={STATUS_OPTIONS} onChange={v => handleStatusChange('assembly_status', v)} />
                  <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-2">
                    <p className="text-muted-foreground">Acompanhe aqui o status da montagem do pedido.</p>
                    {selectedOrder.factory_send_date && (
                      <p className="text-xs">Data de envio à fábrica: <span className="font-medium">{fmtDate(selectedOrder.factory_send_date)}</span></p>
                    )}
                  </div>
                </TabsContent>

                {/* ====== PÓS-MONTAGEM ====== */}
                <TabsContent value="pos-montagem" className="mt-4 space-y-4">
                  <StatusSelect icon={<Wrench className="h-4 w-4" />} label="Status Pós-montagem" value={selectedOrder.post_assembly_status ?? 'pendente'} options={STATUS_OPTIONS} onChange={v => handleStatusChange('post_assembly_status', v)} />
                  <div className="bg-muted/30 rounded-lg p-4 text-sm">
                    <p className="text-muted-foreground">Acompanhe aqui o status da pós-montagem e vistoria final.</p>
                  </div>
                </TabsContent>

                {/* ====== OCORRÊNCIAS ====== */}
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
                                <Badge variant="outline" className={`text-[10px] ${occ.priority === 'alta' || occ.priority === 'urgente' ? 'border-destructive text-destructive' : ''}`}>{occ.priority}</Badge>
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

                {/* ====== TIMELINE ====== */}
                <TabsContent value="timeline" className="mt-4">
                  {timelineEvents.length === 0 ? (
                    <EmptyTab icon={<Clock className="h-8 w-8" />} text="Nenhum evento registrado na timeline." />
                  ) : (
                    <div className="relative pl-6 space-y-4">
                      {/* Vertical line */}
                      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
                      {timelineEvents.map(ev => (
                        <div key={ev.id} className="relative">
                          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          </div>
                          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">{ev.event_type}</span>
                              <span className="text-[10px] text-muted-foreground">{fmtDateTime(ev.created_at)}</span>
                            </div>
                            {ev.description && <p className="text-sm text-muted-foreground">{ev.description}</p>}
                            {ev.user_id && <p className="text-[10px] text-muted-foreground">Por: {ev.user_id.slice(0, 8)}...</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ====== ANEXOS ====== */}
                <TabsContent value="anexos" className="mt-4">
                  {attachments.length === 0 ? (
                    <EmptyTab icon={<Paperclip className="h-8 w-8" />} text="Nenhum anexo vinculado a este pedido." />
                  ) : (
                    <div className="space-y-2">
                      {attachments.map(a => (
                        <div key={a.id} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{a.file_name}</p>
                              <p className="text-[10px] text-muted-foreground">{a.file_type} {a.file_size ? `• ${(a.file_size / 1024).toFixed(1)} KB` : ''} • {fmtDate(a.created_at)}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                            <a href={a.file_url} target="_blank" rel="noopener noreferrer">Abrir</a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </ScrollArea>
          ) : null}
        </SheetContent>
      </Sheet>

      {selectedOrder && (
        <PromobImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          orderId={selectedOrder.id}
          existingEnvironmentId={importTargetEnvId}
          onImportComplete={() => { if (selectedOrder) openDetail(selectedOrder); }}
        />
      )}
    </div>
  );
}

/* ── Helper components ── */

function InfoItem({ icon: Icon, label, value, mono }: { icon: React.ElementType; label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <span className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</span>
      <p className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
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
