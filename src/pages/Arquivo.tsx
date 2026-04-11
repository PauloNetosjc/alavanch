import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, Archive, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuoteDetailSheet } from '@/components/quotes/QuoteDetailSheet';
import { OrderDetailSheet } from '@/components/orders/OrderDetailSheet';
import type { Tables } from '@/integrations/supabase/types';

interface QuoteWithClient extends Tables<'quotes'> {
  clients: { name: string; phone: string | null } | null;
}

interface OrderWithRelations extends Tables<'orders'> {
  clients: { name: string; phone: string | null } | null;
  stores: { name: string } | null;
}

const ARCHIVED_QUOTE_STATUSES = ['declinado', 'arquivado'];
const ARCHIVED_ORDER_STATUSES = ['cancelado', 'arquivado', 'concluido'];

export default function Arquivo() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<QuoteWithClient[]>([]);
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Quote detail
  const [detailQuoteId, setDetailQuoteId] = useState<string | null>(null);
  const [detailQuoteOpen, setDetailQuoteOpen] = useState(false);

  // Order detail
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detailOrderOpen, setDetailOrderOpen] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin')
        .then(({ data }) => setIsAdmin((data?.length ?? 0) > 0));
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [quotesRes, ordersRes] = await Promise.all([
      supabase.from('quotes').select('*, clients(name, phone)').in('status', ARCHIVED_QUOTE_STATUSES).order('updated_at', { ascending: false }),
      supabase.from('orders').select('*, clients(name, phone), stores(name)').in('assembly_status', ARCHIVED_ORDER_STATUSES).order('updated_at', { ascending: false }),
    ]);
    setQuotes((quotesRes.data as QuoteWithClient[]) ?? []);
    setOrders((ordersRes.data as OrderWithRelations[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const fmt = (v: number | null | undefined) =>
    v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d.includes('T') ? d : d + 'T00:00').toLocaleDateString('pt-BR') : '—';

  const filterBySearch = <T extends { code?: string; clients?: { name: string; phone: string | null } | null }>(items: T[]) => {
    if (!search.trim()) return items;
    const s = search.toLowerCase();
    return items.filter(i =>
      (i as any).code?.toLowerCase().includes(s) ||
      i.clients?.name?.toLowerCase().includes(s) ||
      i.clients?.phone?.includes(s)
    );
  };

  const filteredDeclinados = filterBySearch(quotes.filter(q => q.status === 'declinado'));
  const filteredArquivadosQ = filterBySearch(quotes.filter(q => q.status === 'arquivado'));
  const filteredCancelados = filterBySearch(orders.filter(o => o.assembly_status === 'cancelado'));
  const filteredArquivadosO = filterBySearch(orders.filter(o => o.assembly_status === 'arquivado'));
  const filteredConcluidos = filterBySearch(orders.filter(o => o.assembly_status === 'concluido'));

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      declinado: 'Declinado', arquivado: 'Arquivado',
      cancelado: 'Cancelado', concluido: 'Concluído',
    };
    return map[status] ?? status;
  };

  const handleEditQuote = () => {};
  const handleOpenCalc = () => {};

  const QuoteTable = ({ items }: { items: QuoteWithClient[] }) => (
    <Card className="border-border/60">
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Archive className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum item encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(q => (
                  <TableRow key={q.id} className="cursor-pointer" onClick={() => { setDetailQuoteId(q.id); setDetailQuoteOpen(true); }}>
                    <TableCell className="font-mono text-xs">{q.code}</TableCell>
                    <TableCell className="font-medium">{q.clients?.name ?? '—'}</TableCell>
                    <TableCell>{fmt(q.final_value ?? q.total_value)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{statusLabel(q.status)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(q.updated_at)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setDetailQuoteId(q.id); setDetailQuoteOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const OrderTable = ({ items }: { items: OrderWithRelations[] }) => (
    <Card className="border-border/60">
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Archive className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum item encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor Final</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(o => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => { setDetailOrderId(o.id); setDetailOrderOpen(true); }}>
                    <TableCell className="font-mono text-xs">{o.code}</TableCell>
                    <TableCell className="font-medium">{o.clients?.name ?? '—'}</TableCell>
                    <TableCell>{fmt(o.final_value)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{statusLabel(o.assembly_status ?? '')}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(o.updated_at)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setDetailOrderId(o.id); setDetailOrderOpen(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Arquivo</h1>
        <p className="text-sm text-muted-foreground mt-1">Orçamentos e pedidos arquivados, declinados, cancelados ou concluídos</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código, cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Tabs defaultValue="declinado">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="declinado" className="text-xs gap-1.5">
              Orç. Declinados <Badge variant="secondary" className="h-4 px-1 text-[10px]">{filteredDeclinados.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="arquivado_q" className="text-xs gap-1.5">
              Orç. Arquivados <Badge variant="secondary" className="h-4 px-1 text-[10px]">{filteredArquivadosQ.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="cancelado" className="text-xs gap-1.5">
              Ped. Cancelados <Badge variant="secondary" className="h-4 px-1 text-[10px]">{filteredCancelados.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="arquivado_o" className="text-xs gap-1.5">
              Ped. Arquivados <Badge variant="secondary" className="h-4 px-1 text-[10px]">{filteredArquivadosO.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="concluido" className="text-xs gap-1.5">
              Ped. Concluídos <Badge variant="secondary" className="h-4 px-1 text-[10px]">{filteredConcluidos.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="declinado" className="mt-4"><QuoteTable items={filteredDeclinados} /></TabsContent>
          <TabsContent value="arquivado_q" className="mt-4"><QuoteTable items={filteredArquivadosQ} /></TabsContent>
          <TabsContent value="cancelado" className="mt-4"><OrderTable items={filteredCancelados} /></TabsContent>
          <TabsContent value="arquivado_o" className="mt-4"><OrderTable items={filteredArquivadosO} /></TabsContent>
          <TabsContent value="concluido" className="mt-4"><OrderTable items={filteredConcluidos} /></TabsContent>
        </Tabs>
      )}

      <QuoteDetailSheet
        open={detailQuoteOpen}
        onOpenChange={setDetailQuoteOpen}
        quoteId={detailQuoteId}
        onEdit={handleEditQuote}
        onOpenCalc={handleOpenCalc}
        onRefresh={fetchData}
      />

      <OrderDetailSheet
        open={detailOrderOpen}
        onOpenChange={setDetailOrderOpen}
        orderId={detailOrderId}
        isAdmin={isAdmin}
        onOrderDeleted={fetchData}
        onOrderUpdated={fetchData}
      />
    </div>
  );
}
