import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertTriangle, Calendar, Clock, Eye, Radar as RadarIcon } from 'lucide-react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { OrderDetailSheet } from '@/components/orders/OrderDetailSheet';
import { useAuth } from '@/contexts/AuthContext';

interface OrderRow {
  id: string;
  code: string;
  order_date: string;
  factory_send_date: string | null;
  assembly_date: string | null;
  inspection_date: string | null;
  contract_status: string | null;
  revision_status: string | null;
  production_status: string | null;
  delivery_status: string | null;
  assembly_status: string | null;
  post_assembly_status: string | null;
  financial_status: string | null;
  clients: { name: string } | null;
}

interface Item {
  order: OrderRow;
  label: string;
  date: string;
  daysLeft: number;
  type: 'fabrica' | 'montagem' | 'vistoria';
}

function urgencyOf(daysLeft: number) {
  if (daysLeft < 0) return { tone: 'destructive', label: 'Atrasado' };
  if (daysLeft === 0) return { tone: 'destructive', label: 'Hoje' };
  if (daysLeft <= 2) return { tone: 'warning', label: `${daysLeft}d` };
  if (daysLeft <= 7) return { tone: 'info', label: `${daysLeft}d` };
  return { tone: 'muted', label: `${daysLeft}d` };
}

export default function Radar() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_roles').select('role').eq('user_id', user.id).then(({ data }) => {
      setIsAdmin(data?.some(r => r.role === 'admin') ?? false);
    });
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('id, code, order_date, factory_send_date, assembly_date, inspection_date, contract_status, revision_status, production_status, delivery_status, assembly_status, post_assembly_status, financial_status, clients(name)')
      .not('assembly_status', 'in', '(concluido,cancelado,arquivado)');
    setOrders((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const today = new Date();
  const items: Item[] = [];
  orders.forEach(o => {
    if (o.factory_send_date) {
      items.push({ order: o, type: 'fabrica', label: 'Envio à fábrica', date: o.factory_send_date, daysLeft: differenceInCalendarDays(parseISO(o.factory_send_date), today) });
    }
    if (o.assembly_date) {
      items.push({ order: o, type: 'montagem', label: 'Montagem', date: o.assembly_date, daysLeft: differenceInCalendarDays(parseISO(o.assembly_date), today) });
    }
    if (o.inspection_date) {
      items.push({ order: o, type: 'vistoria', label: 'Vistoria', date: o.inspection_date, daysLeft: differenceInCalendarDays(parseISO(o.inspection_date), today) });
    }
  });
  items.sort((a, b) => a.daysLeft - b.daysLeft);

  const atrasados = items.filter(i => i.daysLeft < 0);
  const hoje = items.filter(i => i.daysLeft === 0);
  const semana = items.filter(i => i.daysLeft > 0 && i.daysLeft <= 7);
  const futuros = items.filter(i => i.daysLeft > 7);

  const openOrder = (id: string) => { setSelectedOrderId(id); setSheetOpen(true); };

  const renderList = (list: Item[], emptyMsg: string) => {
    if (list.length === 0) {
      return (
        <Card className="border-border/60">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{emptyMsg}</p>
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="space-y-2">
        {list.map((it, i) => {
          const u = urgencyOf(it.daysLeft);
          const toneClass = u.tone === 'destructive' ? 'border-destructive/50 bg-destructive/5'
            : u.tone === 'warning' ? 'border-amber-400/50 bg-amber-50/50'
            : u.tone === 'info' ? 'border-blue-400/50 bg-blue-50/30'
            : 'border-border/60';
          const badgeVariant: any = u.tone === 'destructive' ? 'destructive' : u.tone === 'warning' ? 'default' : 'outline';
          return (
            <Card key={`${it.order.id}-${it.type}-${i}`} className={toneClass}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-background border shrink-0">
                    <span className="text-[10px] uppercase text-muted-foreground">{format(parseISO(it.date), 'MMM')}</span>
                    <span className="text-lg font-bold">{format(parseISO(it.date), 'dd')}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{it.order.clients?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{it.order.code}</span> • {it.label}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={badgeVariant} className="text-[10px]">
                    <Clock className="h-3 w-3 mr-1" /> {u.label}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => openOrder(it.order.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground flex items-center gap-2">
            <RadarIcon className="h-6 w-6 text-primary" /> Radar de Prazos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe envios à fábrica, montagens e vistorias por urgência.</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Atrasados</p>
            <p className="text-2xl font-bold text-destructive">{atrasados.length}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-400/40 bg-amber-50/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Hoje</p>
            <p className="text-2xl font-bold text-amber-700">{hoje.length}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-400/40 bg-blue-50/30">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Próx. 7 dias</p>
            <p className="text-2xl font-bold text-blue-700">{semana.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Futuros</p>
            <p className="text-2xl font-bold">{futuros.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="todos">
        <TabsList>
          <TabsTrigger value="todos">Todos ({items.length})</TabsTrigger>
          <TabsTrigger value="atrasados">Atrasados ({atrasados.length})</TabsTrigger>
          <TabsTrigger value="hoje">Hoje ({hoje.length})</TabsTrigger>
          <TabsTrigger value="semana">7 dias ({semana.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="todos" className="mt-4">
          {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : renderList(items, 'Nenhum prazo cadastrado nos pedidos ativos.')}
        </TabsContent>
        <TabsContent value="atrasados" className="mt-4">{renderList(atrasados, 'Nenhum prazo atrasado.')}</TabsContent>
        <TabsContent value="hoje" className="mt-4">{renderList(hoje, 'Nenhum prazo para hoje.')}</TabsContent>
        <TabsContent value="semana" className="mt-4">{renderList(semana, 'Nenhum prazo nos próximos 7 dias.')}</TabsContent>
      </Tabs>

      <OrderDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        orderId={selectedOrderId}
        isAdmin={isAdmin}
        onOrderUpdated={load}
      />
    </div>
  );
}
