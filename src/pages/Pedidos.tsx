import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Search, ShoppingCart, Eye, Loader2,
} from 'lucide-react';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import type { Tables as DbTables } from '@/integrations/supabase/types';
import { OrderDetailSheet } from '@/components/orders/OrderDetailSheet';

interface OrderWithRelations extends DbTables<'orders'> {
  clients: { name: string; phone: string | null } | null;
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

export default function Pedidos() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);

  useEffect(() => {
    if (user) {
      supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin')
        .then(({ data }) => setIsAdmin((data?.length ?? 0) > 0));
    }
  }, [user]);

  const stagesForPipeline = (type: string) => pipelineStages.filter(s => s.pipeline_type === type);
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

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, clients(name, phone), stores(name)')
      .order('created_at', { ascending: false });
    setOrders((data as OrderWithRelations[]) ?? []);
    setLoading(false);
  };

  const fmt = (v: number | null | undefined) =>
    v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

  useEffect(() => {
    fetchOrders();
    supabase.from('pipeline_stages').select('*').eq('active', true).order('display_order')
      .then(({ data }) => setPipelineStages((data as PipelineStage[]) ?? []));
  }, []);

  // Auto-open order from URL param
  useEffect(() => {
    const orderId = searchParams.get('order');
    if (orderId && orders.length > 0 && !detailOpen) {
      setSelectedOrderId(orderId);
      setDetailOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [orders, searchParams]);

  const ARCHIVED_O = ['cancelado', 'arquivado', 'concluido'];
  const filteredOrders = orders.filter(o => {
    // Hide archived/cancelled/completed from this page
    if (ARCHIVED_O.includes(o.assembly_status ?? '')) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!(o.code.toLowerCase().includes(s) || o.clients?.name?.toLowerCase().includes(s) || o.clients?.phone?.includes(s))) return false;
    }
    if (dateFrom) {
      const d = new Date(o.order_date + 'T00:00');
      if (d < dateFrom) return false;
    }
    if (dateTo) {
      const d = new Date(o.order_date + 'T00:00');
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
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
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
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
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => { setSelectedOrderId(o.id); setDetailOpen(true); }}>
                      <TableCell className="font-mono text-xs">{o.code}</TableCell>
                      <TableCell className="font-medium">{o.clients?.name ?? '—'}</TableCell>
                      <TableCell>{fmt(o.final_value)}</TableCell>
                      <TableCell>{getStatusBadge(o.contract_status, 'contrato')}</TableCell>
                      <TableCell>{getStatusBadge(o.revision_status, 'revisao')}</TableCell>
                      <TableCell>{getStatusBadge(o.assembly_status, 'montagem')}</TableCell>
                      <TableCell>{getStatusBadge(o.financial_status, 'financeiro')}</TableCell>
                      <TableCell>{getStatusBadge(o.occurrence_status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelectedOrderId(o.id); setDetailOpen(true); }}>
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

      <OrderDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        orderId={selectedOrderId}
        isAdmin={isAdmin}
        onOrderDeleted={fetchOrders}
        onOrderUpdated={fetchOrders}
      />
    </div>
  );
}
