import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { maskPhone } from '@/lib/masks';
import type { Tables } from '@/integrations/supabase/types';

interface PipelineStage {
  id: string;
  name: string;
  display_order: number;
  color: string;
  is_initial: boolean;
  is_final: boolean;
  active: boolean;
}

interface OrderCard {
  id: string;
  code: string;
  client_name: string;
  client_phone: string | null;
  final_value: number | null;
  status: string; // The current stage name for this pipeline
  order_date: string;
}

interface DepartmentKanbanProps {
  pipelineType: string; // 'contrato', 'revisao', 'montagem', 'financeiro', 'pos_montagem'
  statusField: 'contract_status' | 'revision_status' | 'assembly_status' | 'financial_status' | 'post_assembly_status';
  title: string;
  subtitle: string;
}

export function DepartmentKanban({ pipelineType, statusField, title, subtitle }: DepartmentKanbanProps) {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

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

  // Map old status values to stage names for backward compat
  const resolveStatus = (status: string) => {
    // If status matches a stage name exactly, use it
    if (stages.find(s => s.name.toLowerCase() === status.toLowerCase())) return status;
    // Map legacy values
    const legacyMap: Record<string, string> = {
      'pendente': stages.find(s => s.is_initial)?.name ?? stages[0]?.name ?? 'Pendente',
      'em_andamento': stages.find(s => !s.is_initial && !s.is_final)?.name ?? stages[1]?.name ?? 'Em andamento',
      'concluido': stages.find(s => s.is_final)?.name ?? stages[stages.length - 1]?.name ?? 'Concluído',
    };
    return legacyMap[status] ?? stages[0]?.name ?? status;
  };

  const getOrdersInStage = (stageName: string) =>
    orders.filter(o => resolveStatus(o.status) === stageName);

  const handleDrop = async (stageName: string) => {
    if (!draggedId) return;
    setDragOverCol(null);
    setDraggedId(null);

    const order = orders.find(o => o.id === draggedId);
    if (!order || resolveStatus(order.status) === stageName) return;

    // Optimistic update
    setOrders(prev => prev.map(o => o.id === draggedId ? { ...o, status: stageName } : o));

    const updateObj: Record<string, string> = {};
    updateObj[statusField] = stageName;
    const { error } = await supabase.from('orders').update(updateObj as any).eq('id', draggedId);
    if (error) {
      // Rollback
      setOrders(prev => prev.map(o => o.id === draggedId ? { ...o, status: order.status } : o));
    }
  };

  const formatCurrency = (v: number | null) =>
    v ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      {stages.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-sm">Nenhum estágio configurado para este pipeline.</p>
          <p className="text-xs mt-1">Vá em Administração → Pipelines para criar os estágios.</p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map(stage => {
            const items = getOrdersInStage(stage.name);
            const isOver = dragOverCol === stage.name;
            return (
              <div
                key={stage.id}
                className="min-w-[250px] max-w-[250px] flex-shrink-0"
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(stage.name); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => handleDrop(stage.name)}
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stage.name}</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">{items.length}</Badge>
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
                        className={`bg-card border border-border/60 rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${draggedId === o.id ? 'opacity-50' : ''}`}
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
    </div>
  );
}
