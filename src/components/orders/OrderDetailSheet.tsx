import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Eye, FileText, CheckSquare, Wrench, Factory, Truck,
  DollarSign, AlertTriangle, Calendar as CalendarIcon, User, Store, CreditCard, Loader2,
  Package, Upload, RotateCcw, Clock, Paperclip, Tag, MessageSquare,
  Phone, Mail, MapPin, Hash, ArrowRightLeft, Trash2, Pencil, History,
  CheckCircle2, Archive, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { maskPhone, maskCpf } from '@/lib/masks';
import type { Tables as DbTables } from '@/integrations/supabase/types';
import PromobImportDialog from '@/components/orders/PromobImportDialog';

interface OrderWithRelations extends DbTables<'orders'> {
  clients: { name: string; phone: string | null; email: string | null; cpf: string | null; delivery_address: string | null; billing_address: string | null; birth_date: string | null; notes: string | null } | null;
  stores: { name: string } | null;
}

interface PipelineStage {
  id: string;
  pipeline_type: string;
  name: string;
  display_order: number;
  color: string;
  is_initial: boolean;
  is_final: boolean;
}

const PIPELINE_FIELDS: Record<string, 'contract_status' | 'revision_status' | 'assembly_status' | 'financial_status' | 'post_assembly_status' | 'production_status' | 'delivery_status'> = {
  contrato: 'contract_status',
  revisao: 'revision_status',
  producao: 'production_status',
  entrega: 'delivery_status',
  montagem: 'assembly_status',
  financeiro: 'financial_status',
  pos_montagem: 'post_assembly_status',
};

const PIPELINE_ICONS: Record<string, React.ReactNode> = {
  contrato: <FileText className="h-4 w-4" />,
  revisao: <CheckSquare className="h-4 w-4" />,
  producao: <Factory className="h-4 w-4" />,
  entrega: <Truck className="h-4 w-4" />,
  montagem: <Wrench className="h-4 w-4" />,
  financeiro: <DollarSign className="h-4 w-4" />,
  pos_montagem: <Wrench className="h-4 w-4" />,
};

const PIPELINE_LABELS: Record<string, string> = {
  contrato: 'Contrato',
  revisao: 'Revisão',
  producao: 'Produção',
  entrega: 'Entrega',
  montagem: 'Montagem',
  financeiro: 'Financeiro',
  pos_montagem: 'Pós-montagem',
};

const OCCURRENCE_STATUS_OPTIONS = [
  { value: 'sem_ocorrencias', label: 'Sem ocorrências' },
  { value: 'com_ocorrencias', label: 'Com ocorrências' },
];

// Map tab names to pipeline metadata fields for filtering timeline
const TAB_PIPELINE_MAP: Record<string, string[]> = {
  contrato: ['contrato', 'contract_status'],
  revisao: ['revisao', 'revision_status'],
  producao: ['producao', 'production_status'],
  entrega: ['entrega', 'delivery_status'],
  montagem: ['montagem', 'assembly_status'],
  financeiro: ['financeiro', 'financial_status'],
  'pos-montagem': ['pos_montagem', 'post_assembly_status'],
};

interface OrderDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  isAdmin: boolean;
  onOrderDeleted?: () => void;
  onOrderUpdated?: () => void;
}

export function OrderDetailSheet({ open, onOpenChange, orderId, isAdmin, onOrderDeleted, onOrderUpdated }: OrderDetailSheetProps) {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithRelations | null>(null);
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
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [editingFactoryDate, setEditingFactoryDate] = useState(false);

  // Contract management state
  const [contractTemplates, setContractTemplates] = useState<DbTables<'contract_templates'>[]>([]);
  const [contractFormOpen, setContractFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<DbTables<'contracts'> | null>(null);
  const [contractContent, setContractContent] = useState('');
  const [contractNotes, setContractNotes] = useState('');
  const [contractFooter, setContractFooter] = useState('');
  const [contractSaving, setContractSaving] = useState(false);
  const [viewingContract, setViewingContract] = useState<DbTables<'contracts'> | null>(null);

  const stagesForPipeline = (type: string) => pipelineStages.filter(s => s.pipeline_type === type);
  const stageOptions = (type: string) => stagesForPipeline(type).map(s => ({ value: s.name, label: s.name }));
  const stageColor = (type: string, value: string | null) => {
    const stage = stagesForPipeline(type).find(s => s.name === value);
    return stage?.color ?? '#6b7280';
  };

  const getStatusBadge = (status: string | null, pipelineType?: string) => {
    if (!status) return <Badge variant="outline" className="text-[10px]">—</Badge>;
    const color = pipelineType ? stageColor(pipelineType, status) : '#6b7280';
    return (
      <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: color + '20', color: color, borderColor: color + '40' }}>
        {status}
      </Badge>
    );
  };

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setExpandedEnv(null);
    setEditingNotes(false);
    setEditingFactoryDate(false);

    const [orderRes, stagesRes] = await Promise.all([
      supabase.from('orders').select('*, clients(name, phone, email, cpf, delivery_address, billing_address, birth_date, notes), stores(name)').eq('id', id).single(),
      supabase.from('pipeline_stages').select('*').eq('active', true).order('display_order'),
    ]);

    if (!orderRes.data) { setDetailLoading(false); return; }
    const order = orderRes.data as OrderWithRelations;
    setSelectedOrder(order);
    setNotesValue(order.internal_comments ?? '');
    setPipelineStages((stagesRes.data as PipelineStage[]) ?? []);

    const [contractsRes, financialRes, occurrencesRes, envsRes, importsRes, timelineRes, attachmentsRes, templatesRes] = await Promise.all([
      supabase.from('contracts').select('*').eq('order_id', id).order('created_at', { ascending: false }),
      supabase.from('financial_entries').select('*').eq('order_id', id).order('due_date'),
      supabase.from('occurrences').select('*').eq('order_id', id).order('created_at', { ascending: false }),
      supabase.from('order_environments').select('*').eq('order_id', id).order('name'),
      supabase.from('promob_imports').select('*').eq('order_id', id).order('created_at', { ascending: false }),
      supabase.from('timeline_events').select('*').eq('entity_id', id).eq('entity_type', 'order').order('created_at', { ascending: false }),
      supabase.from('attachments').select('*').eq('entity_id', id).eq('entity_type', 'order').order('created_at', { ascending: false }),
      supabase.from('contract_templates').select('*').eq('active', true).order('name'),
    ]);
    setContracts(contractsRes.data ?? []);
    setContractTemplates(templatesRes.data ?? []);
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
  }, []);

  useEffect(() => {
    if (open && orderId) {
      loadDetail(orderId);
    }
    if (!open) {
      setSelectedOrder(null);
    }
  }, [open, orderId, loadDetail]);

  const handleStatusChange = async (field: 'contract_status' | 'revision_status' | 'assembly_status' | 'financial_status' | 'post_assembly_status' | 'production_status' | 'delivery_status' | 'occurrence_status', value: string) => {
    if (!selectedOrder || !isAdmin) return;
    const prev = selectedOrder[field];
    setSelectedOrder({ ...selectedOrder, [field]: value } as OrderWithRelations);

    const updateObj: Record<string, string> = {};
    updateObj[field] = value;
    const { error } = await supabase.from('orders').update(updateObj as any).eq('id', selectedOrder.id);
    if (error) {
      toast.error('Erro ao atualizar status');
      setSelectedOrder({ ...selectedOrder, [field]: prev } as OrderWithRelations);
    } else {
      toast.success('Status atualizado');
      onOrderUpdated?.();
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedOrder || !isAdmin) return;
    const { error } = await supabase.from('orders').update({ internal_comments: notesValue } as any).eq('id', selectedOrder.id);
    if (error) {
      toast.error('Erro ao salvar observações');
    } else {
      setSelectedOrder({ ...selectedOrder, internal_comments: notesValue } as OrderWithRelations);
      setEditingNotes(false);
      toast.success('Observações salvas');
      // Log timeline
      await supabase.from('timeline_events').insert({
        entity_type: 'order',
        entity_id: selectedOrder.id,
        event_type: 'notes_updated',
        description: 'Observações internas atualizadas',
      });
    }
  };

  const handleFactoryDateChange = async (date: Date | undefined) => {
    if (!selectedOrder || !isAdmin || !date) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const prev = selectedOrder.factory_send_date;
    setSelectedOrder({ ...selectedOrder, factory_send_date: dateStr } as OrderWithRelations);
    setEditingFactoryDate(false);

    const { error } = await supabase.from('orders').update({ factory_send_date: dateStr } as any).eq('id', selectedOrder.id);
    if (error) {
      toast.error('Erro ao atualizar data');
      setSelectedOrder({ ...selectedOrder, factory_send_date: prev } as OrderWithRelations);
    } else {
      toast.success('Data de envio atualizada');
      onOrderUpdated?.();
      await supabase.from('timeline_events').insert({
        entity_type: 'order',
        entity_id: selectedOrder.id,
        event_type: 'factory_date_changed',
        description: `Data de envio à fábrica alterada para ${fmtDate(dateStr)}`,
      });
    }
  };

  // ─── Contract CRUD ───
  const openNewContract = (templateId?: string) => {
    setEditingContract(null);
    const tpl = templateId ? contractTemplates.find(t => t.id === templateId) : null;
    let content = tpl?.content ?? '';
    if (selectedOrder && content) {
      content = content
        .replace(/\{\{cliente\}\}/gi, selectedOrder.clients?.name ?? '')
        .replace(/\{\{cpf\}\}/gi, selectedOrder.clients?.cpf ?? '')
        .replace(/\{\{valor\}\}/gi, `R$ ${(selectedOrder.final_value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
        .replace(/\{\{data\}\}/gi, selectedOrder.order_date ? new Date(selectedOrder.order_date + 'T00:00').toLocaleDateString('pt-BR') : '')
        .replace(/\{\{codigo\}\}/gi, selectedOrder.code)
        .replace(/\{\{endereco\}\}/gi, selectedOrder.clients?.delivery_address ?? '');
    }
    setContractContent(content);
    setContractNotes('');
    setContractFooter('');
    setContractFormOpen(true);
    setViewingContract(null);
  };

  const openEditContract = (c: DbTables<'contracts'>) => {
    setEditingContract(c);
    setContractContent(c.content ?? '');
    setContractNotes(c.notes ?? '');
    setContractFooter(c.footer_notes ?? '');
    setContractFormOpen(true);
    setViewingContract(null);
  };

  const saveContract = async () => {
    if (!selectedOrder) return;
    setContractSaving(true);
    if (editingContract) {
      const { error } = await supabase.from('contracts').update({
        content: contractContent, notes: contractNotes, footer_notes: contractFooter,
      } as any).eq('id', editingContract.id);
      if (error) toast.error('Erro ao atualizar contrato');
      else {
        toast.success('Contrato atualizado');
        await supabase.from('timeline_events').insert({ entity_type: 'order', entity_id: selectedOrder.id, event_type: 'contract_updated', description: `Contrato v${editingContract.version} atualizado`, metadata: { pipeline: 'contrato' } });
      }
    } else {
      const nextVersion = contracts.length > 0 ? Math.max(...contracts.map(c => c.version ?? 1)) + 1 : 1;
      const { error } = await supabase.from('contracts').insert({
        order_id: selectedOrder.id, store_id: selectedOrder.store_id, version: nextVersion,
        content: contractContent, notes: contractNotes, footer_notes: contractFooter, status: 'rascunho',
      });
      if (error) toast.error('Erro ao criar contrato');
      else {
        toast.success('Contrato criado');
        await supabase.from('timeline_events').insert({ entity_type: 'order', entity_id: selectedOrder.id, event_type: 'contract_created', description: `Contrato v${nextVersion} criado`, metadata: { pipeline: 'contrato' } });
      }
    }
    setContractSaving(false);
    setContractFormOpen(false);
    const { data } = await supabase.from('contracts').select('*').eq('order_id', selectedOrder.id).order('created_at', { ascending: false });
    setContracts(data ?? []);
  };

  const updateContractStatus = async (contract: DbTables<'contracts'>, newStatus: string) => {
    if (!selectedOrder) return;
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === 'enviado') updates.sent_at = new Date().toISOString();
    if (newStatus === 'assinado') updates.signed_at = new Date().toISOString();
    const { error } = await supabase.from('contracts').update(updates as any).eq('id', contract.id);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    toast.success(`Status: ${newStatus}`);
    await supabase.from('timeline_events').insert({ entity_type: 'order', entity_id: selectedOrder.id, event_type: 'contract_status_changed', description: `Contrato v${contract.version}: ${contract.status} → ${newStatus}`, metadata: { pipeline: 'contrato' } });
    const { data } = await supabase.from('contracts').select('*').eq('order_id', selectedOrder.id).order('created_at', { ascending: false });
    setContracts(data ?? []);
  };

  const generateSignatureLink = async (contract: DbTables<'contracts'>) => {
    const link = `${window.location.origin}/assinar/${contract.id}`;
    const { error } = await supabase.from('contracts').update({ signature_link: link } as any).eq('id', contract.id);
    if (error) { toast.error('Erro ao gerar link'); return; }
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
    const { data } = await supabase.from('contracts').select('*').eq('order_id', selectedOrder!.id).order('created_at', { ascending: false });
    setContracts(data ?? []);
  };

  const sendContractByEmail = (contract: DbTables<'contracts'>) => {
    if (!selectedOrder?.clients?.email) { toast.error('Cliente sem e-mail cadastrado'); return; }
    const subject = encodeURIComponent(`Contrato - Pedido ${selectedOrder.code}`);
    const body = encodeURIComponent(`Olá ${selectedOrder.clients.name},\n\nSegue o contrato referente ao pedido ${selectedOrder.code}.\n\n${contract.signature_link ? `Link para assinatura: ${contract.signature_link}` : ''}\n\nAtenciosamente.`);
    window.open(`mailto:${selectedOrder.clients.email}?subject=${subject}&body=${body}`);
  };

  const deleteContract = async (contract: DbTables<'contracts'>) => {
    if (!selectedOrder || !confirm('Excluir este contrato?')) return;
    const { error } = await supabase.from('contracts').delete().eq('id', contract.id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Contrato excluído');
    await supabase.from('timeline_events').insert({ entity_type: 'order', entity_id: selectedOrder.id, event_type: 'contract_deleted', description: `Contrato v${contract.version} excluído`, metadata: { pipeline: 'contrato' } });
    setContracts(prev => prev.filter(c => c.id !== contract.id));
    if (viewingContract?.id === contract.id) setViewingContract(null);
  };

  const fmt = (v: number | null | undefined) =>
    v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d.includes('T') ? d : d + 'T00:00').toLocaleDateString('pt-BR') : '—';

  const fmtDateTime = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

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

  // Filter timeline events for a specific tab
  const getTabTimeline = (tabKey: string) => {
    const mapping = TAB_PIPELINE_MAP[tabKey];
    if (!mapping) return [];
    return timelineEvents.filter(ev => {
      const meta = ev.metadata as Record<string, unknown> | null;
      if (!meta) return false;
      return mapping.includes(meta.pipeline as string) || mapping.includes(meta.field as string);
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-3xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-3">
            <div className="flex items-center justify-between">
              <SheetTitle className="font-display flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {selectedOrder?.code ?? 'Pedido'}
                <span className="text-sm font-normal text-muted-foreground ml-2">Visão 360°</span>
              </SheetTitle>
              {isAdmin && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={async () => {
                  if (!selectedOrder || !confirm('Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.')) return;
                  const { error } = await supabase.from('orders').delete().eq('id', selectedOrder.id);
                  if (error) { toast.error('Erro ao excluir pedido'); return; }
                  toast.success('Pedido excluído');
                  onOpenChange(false);
                  onOrderDeleted?.();
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12 flex-1"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : selectedOrder ? (
            <ScrollArea className="flex-1 px-6 pb-6">
              {/* Status cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {['contrato', 'revisao', 'montagem', 'financeiro', 'pos_montagem'].map(pt => {
                  const field = PIPELINE_FIELDS[pt];
                  const value = selectedOrder[field] ?? stagesForPipeline(pt).find(s => s.is_initial)?.name ?? 'Pendente';
                  return (
                    <StatusSelect
                      key={pt}
                      icon={PIPELINE_ICONS[pt]}
                      label={PIPELINE_LABELS[pt]}
                      value={value}
                      options={stageOptions(pt)}
                      onChange={v => handleStatusChange(field, v)}
                      color={stageColor(pt, value)}
                      disabled={!isAdmin}
                    />
                  );
                })}
                <StatusSelect icon={<AlertTriangle className="h-4 w-4" />} label="Ocorrências" value={selectedOrder.occurrence_status ?? 'sem_ocorrencias'} options={OCCURRENCE_STATUS_OPTIONS} onChange={v => handleStatusChange('occurrence_status', v)} disabled={!isAdmin} />
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
                    <InfoItem icon={CalendarIcon} label="Data do pedido" value={fmtDate(selectedOrder.order_date)} />
                    {/* Editable factory date */}
                    <div className="space-y-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" /> Envio fábrica
                        {isAdmin && (
                          <button onClick={() => setEditingFactoryDate(!editingFactoryDate)} className="ml-1 text-primary hover:text-primary/80">
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                      {editingFactoryDate && isAdmin ? (
                        <Popover open={editingFactoryDate} onOpenChange={setEditingFactoryDate}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("h-8 text-xs w-full justify-start", !selectedOrder.factory_send_date && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-3 w-3" />
                              {selectedOrder.factory_send_date ? fmtDate(selectedOrder.factory_send_date) : 'Selecionar data'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedOrder.factory_send_date ? new Date(selectedOrder.factory_send_date + 'T00:00') : undefined}
                              onSelect={handleFactoryDateChange}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <p className="text-sm font-medium">{fmtDate(selectedOrder.factory_send_date)}</p>
                      )}
                    </div>
                  </div>

                  <Separator />

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

                  {selectedOrder.tags && selectedOrder.tags.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Tags</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedOrder.tags.map((t, i) => <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>)}
                      </div>
                    </div>
                  )}

                  {/* Internal notes - admin editable */}
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Observações internas
                      {isAdmin && !editingNotes && (
                        <button onClick={() => { setNotesValue(selectedOrder.internal_comments ?? ''); setEditingNotes(true); }} className="ml-1 text-primary hover:text-primary/80">
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                    {editingNotes && isAdmin ? (
                      <div className="space-y-2">
                        <Textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={3} placeholder="Adicionar observações internas..." />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveNotes}>Salvar</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">
                        {selectedOrder.internal_comments || 'Nenhuma observação.'}
                      </p>
                    )}
                  </div>

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
                          <InfoItem icon={CalendarIcon} label="Nascimento" value={fmtDate(selectedOrder.clients.birth_date)} />
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
                  {isAdmin && (
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => { setImportTargetEnvId(null); setImportDialogOpen(true); }}>
                        <Upload className="h-4 w-4 mr-1" /> Importar arquivo Promob
                      </Button>
                    </div>
                  )}

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
                                  {isAdmin && (
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
                                  )}

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
                <TabsContent value="contrato" className="mt-4 space-y-4">
                  <StatusSelect icon={<FileText className="h-4 w-4" />} label="Status do Contrato" value={selectedOrder.contract_status ?? 'Pendente'} options={stageOptions('contrato')} onChange={v => handleStatusChange('contract_status', v)} color={stageColor('contrato', selectedOrder.contract_status)} disabled={!isAdmin} />

                  {/* Contract form */}
                  {contractFormOpen ? (
                    <Card className="border-border/60">
                      <CardContent className="p-4 space-y-3">
                        <h4 className="text-sm font-semibold">{editingContract ? `Editar Contrato v${editingContract.version}` : 'Novo Contrato'}</h4>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground block mb-1">Conteúdo do contrato</label>
                          <Textarea value={contractContent} onChange={e => setContractContent(e.target.value)} rows={12} className="font-mono text-xs" placeholder="Digite o conteúdo do contrato..." />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Observações internas</label>
                            <Textarea value={contractNotes} onChange={e => setContractNotes(e.target.value)} rows={3} className="text-xs" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Notas de rodapé</label>
                            <Textarea value={contractFooter} onChange={e => setContractFooter(e.target.value)} rows={3} className="text-xs" />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setContractFormOpen(false)}>Cancelar</Button>
                          <Button size="sm" onClick={saveContract} disabled={contractSaving}>
                            {contractSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            Salvar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex items-center gap-2">
                      {contractTemplates.length > 0 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Novo Contrato</Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="start">
                            <button className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted" onClick={() => openNewContract()}>Em branco</button>
                            <Separator className="my-1" />
                            <p className="text-[10px] text-muted-foreground px-3 py-1 uppercase tracking-wider">Templates</p>
                            {contractTemplates.map(t => (
                              <button key={t.id} className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted" onClick={() => openNewContract(t.id)}>{t.name}</button>
                            ))}
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => openNewContract()}><Plus className="h-3.5 w-3.5 mr-1" />Novo Contrato</Button>
                      )}
                    </div>
                  )}

                  {/* Viewing contract content */}
                  {viewingContract && (
                    <Card className="border-primary/30 bg-primary/5">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Contrato v{viewingContract.version} — Conteúdo</h4>
                          <Button variant="ghost" size="sm" onClick={() => setViewingContract(null)}>Fechar</Button>
                        </div>
                        <div className="bg-background rounded-lg p-4 border text-sm whitespace-pre-wrap font-mono text-xs max-h-96 overflow-y-auto">
                          {viewingContract.content || <span className="text-muted-foreground italic">Sem conteúdo</span>}
                        </div>
                        {viewingContract.footer_notes && (
                          <div className="border-t pt-2 text-xs text-muted-foreground whitespace-pre-wrap">{viewingContract.footer_notes}</div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Contract list */}
                  {contracts.length === 0 && !contractFormOpen ? (
                    <EmptyTab icon={<FileText className="h-8 w-8" />} text="Nenhum contrato vinculado. Crie um usando o botão acima." />
                  ) : (
                    <div className="space-y-3">
                      {contracts.map(c => (
                        <Card key={c.id} className={`border-border/60 ${viewingContract?.id === c.id ? 'ring-2 ring-primary/30' : ''}`}>
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Contrato v{c.version}</span>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(c.status)}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {c.sent_at && <span>Enviado: {fmtDate(c.sent_at)}</span>}
                              {c.signed_at && <span>Assinado: {fmtDate(c.signed_at)}</span>}
                              {c.signature_link && <span>Link: <span className="font-mono text-[10px]">{c.signature_link.slice(0, 40)}...</span></span>}
                            </div>
                            {c.notes && <p className="text-xs text-muted-foreground bg-muted/20 rounded p-2">{c.notes}</p>}
                            <div className="flex flex-wrap items-center gap-1 pt-1">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setViewingContract(viewingContract?.id === c.id ? null : c)}>
                                <Eye className="h-3 w-3 mr-1" />{viewingContract?.id === c.id ? 'Ocultar' : 'Visualizar'}
                              </Button>
                              {isAdmin && c.status === 'rascunho' && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditContract(c)}>
                                  <Pencil className="h-3 w-3 mr-1" />Editar
                                </Button>
                              )}
                              {isAdmin && c.status === 'rascunho' && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateContractStatus(c, 'enviado')}>
                                  <Mail className="h-3 w-3 mr-1" />Marcar Enviado
                                </Button>
                              )}
                              {isAdmin && c.status === 'enviado' && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateContractStatus(c, 'assinado')}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />Marcar Assinado
                                </Button>
                              )}
                              {!c.signature_link && isAdmin && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => generateSignatureLink(c)}>
                                  <Hash className="h-3 w-3 mr-1" />Gerar Link
                                </Button>
                              )}
                              {c.signature_link && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(c.signature_link!); toast.success('Link copiado'); }}>
                                  <Hash className="h-3 w-3 mr-1" />Copiar Link
                                </Button>
                              )}
                              {selectedOrder.clients?.email && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => sendContractByEmail(c)}>
                                  <Mail className="h-3 w-3 mr-1" />Enviar e-mail
                                </Button>
                              )}
                              {isAdmin && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => deleteContract(c)}>
                                  <Trash2 className="h-3 w-3 mr-1" />Excluir
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  <TabTimelineSection events={getTabTimeline('contrato')} fmtDateTime={fmtDateTime} />
                </TabsContent>

                {/* ====== FINANCEIRO ====== */}
                <TabsContent value="financeiro" className="mt-4 space-y-4">
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
                  <TabTimelineSection events={getTabTimeline('financeiro')} fmtDateTime={fmtDateTime} />
                </TabsContent>

                {/* ====== REVISÃO ====== */}
                <TabsContent value="revisao" className="mt-4 space-y-4">
                  <StatusSelect icon={<CheckSquare className="h-4 w-4" />} label="Status da Revisão" value={selectedOrder.revision_status ?? 'Pendente'} options={stageOptions('revisao')} onChange={v => handleStatusChange('revision_status', v)} color={stageColor('revisao', selectedOrder.revision_status)} disabled={!isAdmin} />
                  <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-2">
                    <p className="text-muted-foreground">Acompanhe aqui o status da revisão técnica do pedido.</p>
                    <p className="text-xs text-muted-foreground">Use o controle acima para atualizar o status conforme o progresso da revisão.</p>
                  </div>
                  <TabTimelineSection events={getTabTimeline('revisao')} fmtDateTime={fmtDateTime} />
                </TabsContent>

                {/* ====== MONTAGEM ====== */}
                <TabsContent value="montagem" className="mt-4 space-y-4">
                  <StatusSelect icon={<Wrench className="h-4 w-4" />} label="Status da Montagem" value={selectedOrder.assembly_status ?? 'Pendente'} options={stageOptions('montagem')} onChange={v => handleStatusChange('assembly_status', v)} color={stageColor('montagem', selectedOrder.assembly_status)} disabled={!isAdmin} />
                  <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-2">
                    <p className="text-muted-foreground">Acompanhe aqui o status da montagem do pedido.</p>
                    {selectedOrder.factory_send_date && (
                      <p className="text-xs">Data de envio à fábrica: <span className="font-medium">{fmtDate(selectedOrder.factory_send_date)}</span></p>
                    )}
                  </div>
                  <TabTimelineSection events={getTabTimeline('montagem')} fmtDateTime={fmtDateTime} />
                </TabsContent>

                {/* ====== PÓS-MONTAGEM ====== */}
                <TabsContent value="pos-montagem" className="mt-4 space-y-4">
                  <StatusSelect icon={<Wrench className="h-4 w-4" />} label="Status Pós-montagem" value={selectedOrder.post_assembly_status ?? 'Pendente'} options={stageOptions('pos_montagem')} onChange={v => handleStatusChange('post_assembly_status', v)} color={stageColor('pos_montagem', selectedOrder.post_assembly_status)} disabled={!isAdmin} />
                  <div className="bg-muted/30 rounded-lg p-4 text-sm">
                    <p className="text-muted-foreground">Acompanhe aqui o status da pós-montagem e vistoria final.</p>
                  </div>
                  <TabTimelineSection events={getTabTimeline('pos-montagem')} fmtDateTime={fmtDateTime} />
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

              {/* ====== ACTION BUTTONS ====== */}
              {isAdmin && selectedOrder.assembly_status !== 'concluido' && selectedOrder.assembly_status !== 'cancelado' && selectedOrder.assembly_status !== 'arquivado' && (
                <div className="mt-6 pt-4 border-t border-border/60 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações do Pedido</h4>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      // Check if all pipeline stages are at final stage
                      const pipelineTypes = ['contrato', 'revisao', 'montagem', 'financeiro', 'pos_montagem'] as const;
                      const allComplete = pipelineTypes.every(pt => {
                        const field = PIPELINE_FIELDS[pt];
                        const currentStatus = selectedOrder[field];
                        const finalStage = stagesForPipeline(pt).find(s => s.is_final);
                        return finalStage ? currentStatus === finalStage.name : false;
                      });

                      const handleAction = async (action: 'concluido' | 'arquivado' | 'cancelado') => {
                        const labels: Record<string, string> = { concluido: 'concluir', arquivado: 'arquivar', cancelado: 'cancelar' };
                        if (!confirm(`Tem certeza que deseja ${labels[action]} este pedido?`)) return;
                        const { error } = await supabase.from('orders').update({ assembly_status: action } as any).eq('id', selectedOrder.id);
                        if (error) { toast.error('Erro ao atualizar pedido'); return; }
                        await supabase.from('timeline_events').insert({
                          entity_type: 'order',
                          entity_id: selectedOrder.id,
                          event_type: 'order_' + action,
                          description: `Pedido ${action === 'concluido' ? 'concluído' : action === 'arquivado' ? 'arquivado' : 'cancelado'}`,
                          metadata: { pipeline: 'montagem', field: 'assembly_status' },
                        });
                        toast.success(`Pedido ${action === 'concluido' ? 'concluído' : action === 'arquivado' ? 'arquivado' : 'cancelado'} com sucesso`);
                        onOpenChange(false);
                        onOrderUpdated?.();
                      };

                      return (
                        <>
                          <Button
                            size="sm"
                            className="gap-1.5"
                            disabled={!allComplete}
                            onClick={() => handleAction('concluido')}
                            title={!allComplete ? 'Todas as etapas precisam estar concluídas' : 'Concluir pedido'}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Concluir Pedido
                          </Button>
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAction('arquivado')}>
                            <Archive className="h-4 w-4" />
                            Arquivar
                          </Button>
                          <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => handleAction('cancelado')}>
                            <XCircle className="h-4 w-4" />
                            Cancelar Pedido
                          </Button>
                          {!allComplete && (
                            <p className="w-full text-xs text-muted-foreground">
                              Para concluir o pedido, todas as etapas (contrato, revisão, montagem, financeiro e pós-montagem) precisam estar no estágio final.
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
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
          onImportComplete={() => { if (selectedOrder) loadDetail(selectedOrder.id); }}
        />
      )}
    </>
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

function StatusSelect({ icon, label, value, options, onChange, color, disabled }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  color?: string;
  disabled?: boolean;
}) {
  const bgStyle = color ? { backgroundColor: color + '15', borderColor: color + '40' } : {};
  return (
    <div className="rounded-lg border p-3 space-y-2" style={bgStyle}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      {disabled ? (
        <div className="h-7 flex items-center text-xs font-medium px-2 bg-background/80 rounded border border-border/40">
          {value}
        </div>
      ) : (
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
      )}
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

function TabTimelineSection({ events, fmtDateTime }: { events: DbTables<'timeline_events'>[]; fmtDateTime: (d: string | null | undefined) => string }) {
  if (events.length === 0) return null;
  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <History className="h-3.5 w-3.5" /> Histórico de alterações
      </div>
      <div className="relative pl-5 space-y-2">
        <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
        {events.map(ev => (
          <div key={ev.id} className="relative">
            <div className="absolute -left-5 top-1.5 w-3 h-3 rounded-full bg-primary/10 border border-primary flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-primary" />
            </div>
            <div className="bg-muted/20 rounded px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{ev.description}</p>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{fmtDateTime(ev.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
