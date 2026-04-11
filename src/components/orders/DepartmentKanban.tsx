import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { maskPhone } from '@/lib/masks';
import { Plus, Settings2, Trash2, CalendarIcon, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { OrderDetailSheet } from '@/components/orders/OrderDetailSheet';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface PipelineStage {
  id: string;
  name: string;
  display_order: number;
  color: string;
  is_initial: boolean;
  is_final: boolean;
  active: boolean;
  pipeline_type: string;
}

interface OrderCard {
  id: string;
  code: string;
  client_name: string;
  client_phone: string | null;
  final_value: number | null;
  status: string;
  order_date: string;
}

interface DepartmentKanbanProps {
  pipelineType: string;
  statusField: 'contract_status' | 'revision_status' | 'assembly_status' | 'financial_status' | 'post_assembly_status';
  title: string;
  subtitle: string;
}

export function DepartmentKanban({ pipelineType, statusField, title, subtitle }: DepartmentKanbanProps) {
  const { user } = useAuth();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Order detail sheet
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Admin stage management
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [stageForm, setStageForm] = useState({ name: '', display_order: '', color: '#6b7280', is_initial: false, is_final: false });
  const [stageSaving, setStageSaving] = useState(false);

  // Factory send date popup (for revisão final stage)
  const [factoryDateDialogOpen, setFactoryDateDialogOpen] = useState(false);
  const [factoryDate, setFactoryDate] = useState<Date | undefined>(undefined);
  const [pendingFactoryOrderId, setPendingFactoryOrderId] = useState<string | null>(null);
  const [pendingFactoryStageName, setPendingFactoryStageName] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin')
        .then(({ data }) => setIsAdmin((data?.length ?? 0) > 0));
    }
  }, [user]);

  const fetchStages = useCallback(async () => {
    const { data } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_type', pipelineType)
      .eq('active', true)
      .order('display_order');
    setStages((data as PipelineStage[]) ?? []);
  }, [pipelineType]);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, code, ' + statusField + ', final_value, order_date, clients(name, phone)')
      .order('created_at', { ascending: false });
    if (data) {
      setOrders(data.map((o: any) => ({
        id: o.id,
        code: o.code,
        client_name: o.clients?.name ?? '—',
        client_phone: o.clients?.phone ?? null,
        final_value: o.final_value,
        status: o[statusField] ?? 'pendente',
        order_date: o.order_date,
      })));
    }
  }, [statusField]);

  useEffect(() => { fetchStages(); fetchOrders(); }, [fetchStages, fetchOrders]);

  const resolveStatus = (status: string) => {
    if (stages.find(s => s.name.toLowerCase() === status.toLowerCase())) return status;
    const legacyMap: Record<string, string> = {
      'pendente': stages.find(s => s.is_initial)?.name ?? stages[0]?.name ?? 'Pendente',
      'em_andamento': stages.find(s => !s.is_initial && !s.is_final)?.name ?? stages[1]?.name ?? 'Em andamento',
      'concluido': stages.find(s => s.is_final)?.name ?? stages[stages.length - 1]?.name ?? 'Concluído',
    };
    return legacyMap[status] ?? stages[0]?.name ?? status;
  };

  const getOrdersInStage = (stageName: string) =>
    orders.filter(o => resolveStatus(o.status) === stageName);

  const executeMove = async (movedId: string, stageName: string, factorySendDate?: Date) => {
    const order = orders.find(o => o.id === movedId);
    const previousStatus = order ? resolveStatus(order.status) : null;
    if (!order || previousStatus === stageName) return;

    setOrders(prev => prev.map(o => o.id === movedId ? { ...o, status: stageName } : o));
    const updateObj: Record<string, any> = {};
    updateObj[statusField] = stageName;
    if (factorySendDate) {
      updateObj['factory_send_date'] = format(factorySendDate, 'yyyy-MM-dd');
    }
    const { error } = await supabase.from('orders').update(updateObj as any).eq('id', movedId);
    if (error) {
      setOrders(prev => prev.map(o => o.id === movedId ? { ...o, status: order.status } : o));
      return;
    }
    await supabase.from('timeline_events').insert({
      entity_type: 'order',
      entity_id: movedId,
      event_type: 'status_change',
      description: `${title}: movido de "${previousStatus}" para "${stageName}"`,
      user_id: user?.id ?? null,
      metadata: { pipeline: pipelineType, field: statusField, from: previousStatus, to: stageName },
    });
  };

  const handleDrop = async (stageName: string) => {
    if (!draggedId) return;
    setDragOverCol(null);
    const movedId = draggedId;
    setDraggedId(null);

    // Check if this is the revisão pipeline and the target is a final stage
    if (pipelineType === 'revisao') {
      const targetStage = stages.find(s => s.name === stageName);
      if (targetStage?.is_final) {
        setPendingFactoryOrderId(movedId);
        setPendingFactoryStageName(stageName);
        setFactoryDate(undefined);
        setFactoryDateDialogOpen(true);
        return;
      }
    }

    await executeMove(movedId, stageName);
  };

  const handleFactoryDateConfirm = async () => {
    if (!pendingFactoryOrderId || !pendingFactoryStageName) return;
    await executeMove(pendingFactoryOrderId, pendingFactoryStageName, factoryDate || undefined);
    setFactoryDateDialogOpen(false);
    setPendingFactoryOrderId(null);
    setPendingFactoryStageName(null);
    toast.success(factoryDate ? 'Revisão concluída e data de envio à fábrica definida' : 'Revisão concluída');
  };

  const formatCurrency = (v: number | null) =>
    v ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '';

  const openCardDetail = (orderId: string) => {
    setDetailOrderId(orderId);
    setDetailOpen(true);
  };

  // ─── Admin stage CRUD ───
  const openNewStage = () => {
    setEditingStage(null);
    const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.display_order)) + 1 : 0;
    setStageForm({ name: '', display_order: String(maxOrder), color: '#6b7280', is_initial: false, is_final: false });
    setStageDialogOpen(true);
  };

  const openEditStage = (stage: PipelineStage) => {
    setEditingStage(stage);
    setStageForm({
      name: stage.name,
      display_order: String(stage.display_order),
      color: stage.color,
      is_initial: stage.is_initial,
      is_final: stage.is_final,
    });
    setStageDialogOpen(true);
  };

  const saveStage = async () => {
    if (!stageForm.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setStageSaving(true);
    const payload = {
      pipeline_type: pipelineType,
      name: stageForm.name.trim(),
      display_order: parseInt(stageForm.display_order) || 0,
      color: stageForm.color,
      is_initial: stageForm.is_initial,
      is_final: stageForm.is_final,
      active: true,
    };

    const oldName = editingStage?.name;
    const { error } = editingStage
      ? await supabase.from('pipeline_stages').update(payload).eq('id', editingStage.id)
      : await supabase.from('pipeline_stages').insert(payload);
    
    if (error) { toast.error('Erro ao salvar estágio'); setStageSaving(false); return; }

    if (editingStage && oldName && oldName !== stageForm.name.trim()) {
      const updateObj: Record<string, string> = {};
      updateObj[statusField] = stageForm.name.trim();
      await supabase.from('orders').update(updateObj as any).eq(statusField, oldName);
    }

    toast.success(editingStage ? 'Estágio atualizado' : 'Estágio criado');
    setStageDialogOpen(false);
    setStageSaving(false);
    fetchStages();
    fetchOrders();
  };

  const deleteStage = async (stage: PipelineStage) => {
    if (!confirm(`Excluir o estágio "${stage.name}"? Os pedidos neste estágio serão movidos para o primeiro estágio.`)) return;
    
    const firstStage = stages.find(s => s.id !== stage.id && s.is_initial) ?? stages.find(s => s.id !== stage.id);
    if (firstStage) {
      const updateObj: Record<string, string> = {};
      updateObj[statusField] = firstStage.name;
      await supabase.from('orders').update(updateObj as any).eq(statusField, stage.name);
    }

    await supabase.from('pipeline_stages').delete().eq('id', stage.id);
    toast.success('Estágio removido');
    fetchStages();
    fetchOrders();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={openNewStage}>
            <Plus className="h-4 w-4 mr-1" /> Novo Estágio
          </Button>
        )}
      </div>

      {stages.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-sm">Nenhum estágio configurado para este pipeline.</p>
          <p className="text-xs mt-1">
            {isAdmin ? 'Clique em "Novo Estágio" para criar o primeiro.' : 'Vá em Administração → Pipelines para criar os estágios.'}
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map(stage => {
            const items = getOrdersInStage(stage.name);
            const isOver = dragOverCol === stage.name;
            return (
              <div
                key={stage.id}
                className="min-w-[260px] max-w-[260px] flex-shrink-0"
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(stage.name); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => handleDrop(stage.name)}
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stage.name}</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">{items.length}</Badge>
                  {isAdmin && (
                    <div className="flex gap-0.5">
                      <button onClick={() => openEditStage(stage)} className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5" title="Editar estágio">
                        <Settings2 className="h-3 w-3" />
                      </button>
                      <button onClick={() => deleteStage(stage)} className="text-muted-foreground/50 hover:text-destructive transition-colors p-0.5" title="Remover estágio">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className={`space-y-2 min-h-[120px] rounded-lg p-2 transition-colors ${isOver ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/30'}`}>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 text-center py-6">Vazio</p>
                  ) : (
                    items.map(o => (
                      <div
                        key={o.id}
                        draggable
                        onDragStart={() => setDraggedId(o.id)}
                        onClick={() => openCardDetail(o.id)}
                        className={`bg-card border border-border/60 rounded-lg p-3 cursor-pointer active:cursor-grabbing shadow-sm hover:shadow-md hover:border-primary/30 transition-all ${draggedId === o.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-[11px] font-mono text-muted-foreground">{o.code}</span>
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{o.client_name}</p>
                        {o.client_phone && (
                          <p className="text-xs text-muted-foreground mt-0.5">{maskPhone(o.client_phone)}</p>
                        )}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                          {o.final_value ? (
                            <span className="text-xs font-semibold">{formatCurrency(o.final_value)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">Sem valor</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{new Date(o.order_date + 'T00:00').toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order Detail Sheet - opens inline */}
      <OrderDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        orderId={detailOrderId}
        isAdmin={isAdmin}
        onOrderDeleted={() => { fetchOrders(); }}
        onOrderUpdated={() => { fetchOrders(); }}
      />

      {/* Factory Send Date Dialog (revisão final stage) */}
      <Dialog open={factoryDateDialogOpen} onOpenChange={(open) => {
        if (!open) {
          // If user closes without confirming, still move but without date
          if (pendingFactoryOrderId && pendingFactoryStageName) {
            executeMove(pendingFactoryOrderId, pendingFactoryStageName);
            toast.success('Revisão concluída');
          }
          setFactoryDateDialogOpen(false);
          setPendingFactoryOrderId(null);
          setPendingFactoryStageName(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Data de envio à fábrica</DialogTitle>
            <DialogDescription>
              A revisão foi concluída. Informe a data de envio do pedido à fábrica (opcional).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">Data de envio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !factoryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {factoryDate ? format(factoryDate, 'dd/MM/yyyy') : 'Selecione uma data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={factoryDate}
                  onSelect={setFactoryDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (pendingFactoryOrderId && pendingFactoryStageName) {
                executeMove(pendingFactoryOrderId, pendingFactoryStageName);
                toast.success('Revisão concluída');
              }
              setFactoryDateDialogOpen(false);
              setPendingFactoryOrderId(null);
              setPendingFactoryStageName(null);
            }}>Pular</Button>
            <Button onClick={handleFactoryDateConfirm}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Stage Dialog */}
      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStage ? 'Editar Estágio' : 'Novo Estágio'}</DialogTitle>
            <DialogDescription className="sr-only">Gerenciar estágio do pipeline</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={stageForm.name} onChange={e => setStageForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Em andamento" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={stageForm.display_order} onChange={e => setStageForm(f => ({ ...f, display_order: e.target.value }))} />
              </div>
              <div>
                <Label>Cor</Label>
                <Input type="color" value={stageForm.color} onChange={e => setStageForm(f => ({ ...f, color: e.target.value }))} className="h-9" />
              </div>
              <div className="flex flex-col gap-2 pt-5">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={stageForm.is_initial} onChange={e => setStageForm(f => ({ ...f, is_initial: e.target.checked }))} /> Inicial
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={stageForm.is_final} onChange={e => setStageForm(f => ({ ...f, is_final: e.target.checked }))} /> Final
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveStage} disabled={stageSaving}>{stageSaving ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
