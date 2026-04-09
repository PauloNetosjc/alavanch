import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  FileSignature, Plus, Search, Eye, Loader2, Send, Download,
  CheckCircle, Clock, FileText, PenTool,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface ContractWithOrder extends Tables<'contracts'> {
  orders: { code: string; clients: { name: string } | null } | null;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  rascunho: { label: 'Rascunho', icon: <FileText className="h-3.5 w-3.5" />, color: 'bg-muted text-muted-foreground' },
  enviado: { label: 'Enviado', icon: <Send className="h-3.5 w-3.5" />, color: 'bg-blue-100 text-blue-800 border-blue-300' },
  assinado: { label: 'Assinado', icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  pendente: { label: 'Pendente', icon: <Clock className="h-3.5 w-3.5" />, color: 'bg-amber-100 text-amber-800 border-amber-300' },
};

export default function Contratos() {
  const [search, setSearch] = useState('');
  const [contracts, setContracts] = useState<ContractWithOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractWithOrder | null>(null);
  const [orders, setOrders] = useState<{ id: string; code: string; client_name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formOrderId, setFormOrderId] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formFooter, setFormFooter] = useState('');

  const fetchContracts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contracts')
      .select('*, orders(code, clients(name))')
      .order('created_at', { ascending: false });
    setContracts((data as ContractWithOrder[]) ?? []);
    setLoading(false);
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, code, clients(name)')
      .order('code', { ascending: false });
    setOrders((data ?? []).map((o: any) => ({
      id: o.id,
      code: o.code,
      client_name: o.clients?.name ?? '—',
    })));
  };

  useEffect(() => { fetchContracts(); }, []);

  const openForm = () => {
    setFormOrderId('');
    setFormContent('');
    setFormNotes('');
    setFormFooter('');
    fetchOrders();
    setFormOpen(true);
  };

  const handleCreate = async () => {
    if (!formOrderId) { toast.error('Selecione um pedido'); return; }
    setSaving(true);
    try {
      const order = orders.find(o => o.id === formOrderId);
      const { error } = await supabase.from('contracts').insert({
        order_id: formOrderId,
        content: formContent || null,
        notes: formNotes || null,
        footer_notes: formFooter || null,
        status: 'rascunho',
      });
      if (error) throw error;

      // Update order contract_status
      await supabase.from('orders').update({ contract_status: 'em_andamento' }).eq('id', formOrderId);

      toast.success('Contrato criado');
      setFormOpen(false);
      fetchContracts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar contrato');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (contract: ContractWithOrder, newStatus: string) => {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'enviado') updates.sent_at = new Date().toISOString();
    if (newStatus === 'assinado') updates.signed_at = new Date().toISOString();

    const { error } = await supabase.from('contracts').update(updates).eq('id', contract.id);
    if (error) {
      toast.error('Erro ao atualizar');
    } else {
      toast.success(`Status atualizado para ${statusConfig[newStatus]?.label ?? newStatus}`);
      // Update order contract_status
      if (newStatus === 'assinado') {
        await supabase.from('orders').update({ contract_status: 'concluido' }).eq('id', contract.order_id);
      }
      fetchContracts();
      if (selectedContract?.id === contract.id) {
        setSelectedContract({ ...contract, ...updates } as ContractWithOrder);
      }
    }
  };

  const generateSignatureLink = async (contract: ContractWithOrder) => {
    const token = crypto.randomUUID();
    const link = `${window.location.origin}/assinar/${token}`;
    const { error } = await supabase.from('contracts').update({ signature_link: link }).eq('id', contract.id);
    if (error) {
      toast.error('Erro ao gerar link');
    } else {
      navigator.clipboard.writeText(link);
      toast.success('Link de assinatura copiado para a área de transferência');
      fetchContracts();
    }
  };

  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d.includes('T') ? d : d + 'T00:00').toLocaleDateString('pt-BR') : '—';

  const filtered = contracts.filter(c => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return c.orders?.code?.toLowerCase().includes(s) || c.orders?.clients?.name?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">Geração, envio e gestão de contratos</p>
        </div>
        <Button onClick={openForm}><Plus className="h-4 w-4 mr-2" /> Novo Contrato</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por pedido, cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary" className="text-xs">{filtered.length} contrato{filtered.length !== 1 ? 's' : ''}</Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileSignature className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum contrato cadastrado.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Enviado</TableHead>
                    <TableHead>Assinado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => {
                    const sc = statusConfig[c.status] ?? statusConfig.rascunho;
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => { setSelectedContract(c); setDetailOpen(true); }}>
                        <TableCell className="font-mono text-xs">{c.orders?.code ?? '—'}</TableCell>
                        <TableCell className="font-medium">{c.orders?.clients?.name ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] gap-1 ${sc.color}`}>
                            {sc.icon} {sc.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">v{c.version}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(c.sent_at)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(c.signed_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelectedContract(c); setDetailOpen(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Pedido *</Label>
              <Select value={formOrderId} onValueChange={setFormOrderId}>
                <SelectTrigger><SelectValue placeholder="Selecione o pedido" /></SelectTrigger>
                <SelectContent>
                  {orders.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.code} — {o.client_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Conteúdo do contrato</Label>
              <Textarea rows={8} value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="Termos e condições do contrato..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Observações internas</Label>
                <Textarea rows={3} value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Notas..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rodapé</Label>
                <Textarea rows={3} value={formFooter} onChange={e => setFormFooter(e.target.value)} placeholder="Texto de rodapé..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar contrato
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              Contrato — {selectedContract?.orders?.code}
            </SheetTitle>
          </SheetHeader>
          {selectedContract && (
            <div className="space-y-5 mt-4">
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const sc = statusConfig[selectedContract.status] ?? statusConfig.rascunho;
                  return <Badge variant="outline" className={`gap-1 ${sc.color}`}>{sc.icon} {sc.label}</Badge>;
                })()}
                <span className="text-xs text-muted-foreground">v{selectedContract.version}</span>
              </div>

              <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium">{selectedContract.orders?.clients?.name ?? '—'}</p>
                <p className="text-muted-foreground">Pedido: {selectedContract.orders?.code}</p>
              </div>

              {selectedContract.content && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">Conteúdo</h3>
                  <div className="text-sm bg-muted/20 rounded-lg p-3 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                    {selectedContract.content}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Enviado</span>
                  <p className="font-medium">{fmtDate(selectedContract.sent_at)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Assinado</span>
                  <p className="font-medium">{fmtDate(selectedContract.signed_at)}</p>
                </div>
              </div>

              {selectedContract.signature_link && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">Link de assinatura</h3>
                  <div className="bg-muted/20 rounded p-2 text-xs font-mono break-all">{selectedContract.signature_link}</div>
                </div>
              )}

              {selectedContract.notes && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase">Observações</h3>
                  <p className="text-sm text-muted-foreground">{selectedContract.notes}</p>
                </div>
              )}

              <Separator />

              {/* Actions */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase">Ações</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedContract.status === 'rascunho' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedContract, 'enviado')}>
                        <Send className="h-3.5 w-3.5 mr-1.5" /> Marcar como enviado
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => generateSignatureLink(selectedContract)}>
                        <PenTool className="h-3.5 w-3.5 mr-1.5" /> Gerar link de assinatura
                      </Button>
                    </>
                  )}
                  {selectedContract.status === 'enviado' && (
                    <Button size="sm" onClick={() => handleStatusChange(selectedContract, 'assinado')}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Marcar como assinado
                    </Button>
                  )}
                  <Select value={selectedContract.status} onValueChange={v => handleStatusChange(selectedContract, v)}>
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="enviado">Enviado</SelectItem>
                      <SelectItem value="assinado">Assinado</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
