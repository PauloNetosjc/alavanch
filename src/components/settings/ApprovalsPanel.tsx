import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ShieldAlert, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import {
  convertQuoteToOrder as convertQuoteToOrderHelper,
} from '@/lib/orderConversion';

interface PendingQuote {
  id: string;
  code: string;
  client_id: string | null;
  store_id: string | null;
  seller_id: string | null;
  total_value: number | null;
  discount_percent: number | null;
  discount_value: number | null;
  final_value: number | null;
  npv_value: number | null;
  total_cost: number | null;
  discount_rate_monthly: number | null;
  approval_status: string | null;
  approval_reason: string | null;
  approval_requested_at: string | null;
  interest_percent: number | null;
  surcharge: number | null;
  urgency: string | null;
  origin: string | null;
  focal_point: string | null;
  notes: string | null;
  clients: { name: string } | null;
  seller: { full_name: string | null } | null;
}

const fmt = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ApprovalsPanel() {
  const { user } = useAuth();
  const [list, setList] = useState<PendingQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectQuote, setRejectQuote] = useState<PendingQuote | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('quotes')
      .select(`
        id, code, client_id, store_id, seller_id, total_value, discount_percent, discount_value,
        final_value, npv_value, total_cost, discount_rate_monthly, approval_status, approval_reason,
        approval_requested_at, interest_percent, surcharge, urgency, origin, focal_point, notes,
        clients(name)
      `)
      .eq('approval_status', 'aguardando')
      .order('approval_requested_at', { ascending: false });
    // Fetch seller names separately
    const sellerIds = Array.from(new Set((data ?? []).map(q => q.seller_id).filter(Boolean) as string[]));
    const profileMap = new Map<string, string>();
    if (sellerIds.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', sellerIds);
      profs?.forEach(p => profileMap.set(p.user_id, p.full_name ?? ''));
    }
    setList(((data ?? []) as unknown as PendingQuote[]).map(q => ({
      ...q,
      seller: q.seller_id ? { full_name: profileMap.get(q.seller_id) ?? null } : null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (q: PendingQuote) => {
    setBusy(q.id);
    try {
      // Mark as approved
      await supabase.from('quotes').update({
        approval_status: 'aprovado',
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
      }).eq('id', q.id);

      // Load installments and convert
      const { data: instData } = await supabase.from('quote_installments').select('*').eq('quote_id', q.id).order('number');
      const installments = (instData ?? []).map(i => ({
        number: i.number, value: Number(i.value), due_date: i.due_date, payment_method: i.payment_method,
      }));
      const orderCode = await convertQuoteToOrderHelper(q, installments);
      toast.success(`Aprovado e convertido em pedido ${orderCode}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar');
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!rejectQuote) return;
    setBusy(rejectQuote.id);
    try {
      await supabase.from('quotes').update({
        approval_status: 'rejeitado',
        approval_reason: `${rejectQuote.approval_reason ?? ''} | Motivo da rejeição: ${rejectReason}`,
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
      }).eq('id', rejectQuote.id);
      toast.success('Solicitação rejeitada');
      setRejectQuote(null);
      setRejectReason('');
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-purple-700" />
          Aprovações de Desconto
          {list.length > 0 && <Badge className="bg-purple-600 hover:bg-purple-700">{list.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma solicitação pendente.</p>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Desconto</TableHead>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map(q => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.code}</TableCell>
                    <TableCell>{q.clients?.name ?? '—'}</TableCell>
                    <TableCell>{q.seller?.full_name ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(q.final_value)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                        {Number(q.discount_percent ?? 0).toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {q.approval_requested_at ? format(new Date(q.approval_requested_at), 'dd/MM HH:mm') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="text-success hover:bg-success/10" disabled={busy === q.id} onClick={() => approve(q)}>
                          {busy === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                          Aprovar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" disabled={busy === q.id} onClick={() => { setRejectQuote(q); setRejectReason(''); }}>
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Rejeitar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!rejectQuote} onOpenChange={() => setRejectQuote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Orçamento:</span>{' '}
              <span className="font-mono">{rejectQuote?.code}</span> — {rejectQuote?.clients?.name}
            </div>
            <div>
              <Label>Motivo da rejeição *</Label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explique o motivo para o vendedor…" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectQuote(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={reject} disabled={!rejectReason.trim() || busy === rejectQuote?.id}>
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}