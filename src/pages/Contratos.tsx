import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileSignature, Plus, Search, Eye, Loader2, Send, Download,
  CheckCircle, Clock, FileText, PenTool, Mail, Copy, ExternalLink,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface ContractWithOrder extends Tables<'contracts'> {
  orders: { code: string; final_value: number | null; order_date: string; clients: { name: string; email: string | null; phone: string | null; cpf: string | null } | null; stores: { name: string } | null } | null;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  rascunho: { label: 'Rascunho', icon: <FileText className="h-3.5 w-3.5" />, color: 'bg-muted text-muted-foreground' },
  enviado: { label: 'Enviado', icon: <Send className="h-3.5 w-3.5" />, color: 'bg-blue-100 text-blue-800 border-blue-300' },
  assinado: { label: 'Assinado', icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  pendente: { label: 'Pendente', icon: <Clock className="h-3.5 w-3.5" />, color: 'bg-amber-100 text-amber-800 border-amber-300' },
};

const defaultTemplate = (contract: ContractWithOrder) => {
  const client = contract.orders?.clients;
  const order = contract.orders;
  const store = contract.orders?.stores;
  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: ${client?.name ?? '___'}
CPF: ${client?.cpf ?? '___'}
Email: ${client?.email ?? '___'}
Telefone: ${client?.phone ?? '___'}

CONTRATADA: ${store?.name ?? 'Forest Decor'}

PEDIDO: ${order?.code ?? '___'}
DATA: ${order?.order_date ? new Date(order.order_date).toLocaleDateString('pt-BR') : '___'}
VALOR: ${order?.final_value ? (order.final_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '___'}

CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto a prestação de serviços de fabricação e instalação de móveis planejados, conforme especificações do pedido acima referenciado.

CLÁUSULA 2ª - DO PRAZO
O prazo para execução dos serviços será conforme acordado entre as partes.

CLÁUSULA 3ª - DO PAGAMENTO
O pagamento será realizado conforme condições estabelecidas no pedido.

CLÁUSULA 4ª - DAS GARANTIAS
A CONTRATADA oferece garantia dos serviços e materiais conforme legislação vigente.

CLÁUSULA 5ª - DO FORO
Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer dúvidas.

${contract.footer_notes ?? ''}

_____________________________
CONTRATANTE

_____________________________
CONTRATADA`;
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
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [formOrderId, setFormOrderId] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formFooter, setFormFooter] = useState('');

  const fetchContracts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contracts')
      .select('*, orders(code, final_value, order_date, clients(name, email, phone, cpf), stores(name))')
      .order('created_at', { ascending: false });
    setContracts((data as ContractWithOrder[]) ?? []);
    setLoading(false);
  };

  const fetchOrders = async () => {
    const { data } = await supabase.from('orders').select('id, code, clients(name)').order('code', { ascending: false });
    setOrders((data ?? []).map((o: any) => ({ id: o.id, code: o.code, client_name: o.clients?.name ?? '—' })));
  };

  useEffect(() => { fetchContracts(); }, []);

  const openForm = () => {
    setFormOrderId(''); setFormContent(''); setFormNotes(''); setFormFooter('');
    fetchOrders(); setFormOpen(true);
  };

  const handleCreate = async () => {
    if (!formOrderId) { toast.error('Selecione um pedido'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('contracts').insert({
        order_id: formOrderId, content: formContent || null,
        notes: formNotes || null, footer_notes: formFooter || null, status: 'rascunho',
      });
      if (error) throw error;
      await supabase.from('orders').update({ contract_status: 'em_andamento' }).eq('id', formOrderId);
      toast.success('Contrato criado');
      setFormOpen(false); fetchContracts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar contrato');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (contract: ContractWithOrder, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === 'enviado') updates.sent_at = new Date().toISOString();
    if (newStatus === 'assinado') updates.signed_at = new Date().toISOString();
    const { error } = await supabase.from('contracts').update(updates).eq('id', contract.id);
    if (error) { toast.error('Erro ao atualizar'); return; }
    toast.success(`Status atualizado para ${statusConfig[newStatus]?.label ?? newStatus}`);
    if (newStatus === 'assinado') {
      await supabase.from('orders').update({ contract_status: 'concluido' }).eq('id', contract.order_id);
    }
    fetchContracts();
    if (selectedContract?.id === contract.id) setSelectedContract({ ...contract, ...updates } as ContractWithOrder);
  };

  const generateSignatureLink = async (contract: ContractWithOrder) => {
    const token = crypto.randomUUID();
    const link = `${window.location.origin}/assinar/${token}`;
    const { error } = await supabase.from('contracts').update({ signature_link: link }).eq('id', contract.id);
    if (error) { toast.error('Erro ao gerar link'); return; }
    navigator.clipboard.writeText(link);
    toast.success('Link de assinatura copiado!');
    fetchContracts();
  };

  const generatePdf = async (contract: ContractWithOrder) => {
    setGeneratingPdf(true);
    try {
      const content = contract.content || defaultTemplate(contract);
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contrato_${contract.orders?.code ?? contract.id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Contrato exportado para download');
    } catch {
      toast.error('Erro ao gerar documento');
    } finally { setGeneratingPdf(false); }
  };

  const handleSendEmail = async (contract: ContractWithOrder) => {
    const email = contract.orders?.clients?.email;
    if (!email) { toast.error('Cliente não possui e-mail cadastrado'); return; }
    const subject = encodeURIComponent(`Contrato - Pedido ${contract.orders?.code ?? ''}`);
    const body = encodeURIComponent(`Prezado(a) ${contract.orders?.clients?.name ?? ''},\n\nSegue o contrato referente ao pedido ${contract.orders?.code ?? ''}.\n\n${contract.signature_link ? `Link para assinatura digital:\n${contract.signature_link}\n\n` : ''}Atenciosamente,\n${contract.orders?.stores?.name ?? 'Forest Decor'}`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    toast.success('Cliente de e-mail aberto');
  };

  const updateContent = async (contract: ContractWithOrder, newContent: string) => {
    const { error } = await supabase.from('contracts').update({ content: newContent }).eq('id', contract.id);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Conteúdo salvo');
    setSelectedContract({ ...contract, content: newContent });
    fetchContracts();
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
          <Input placeholder="Buscar por pedido, cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary" className="text-xs">{filtered.length} contrato{filtered.length !== 1 ? 's' : ''}</Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-border/60"><CardContent className="py-12 text-center text-muted-foreground"><FileSignature className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum contrato cadastrado.</p></CardContent></Card>
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Loja</TableHead>
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
                        <TableCell className="text-sm text-muted-foreground">{c.orders?.stores?.name ?? '—'}</TableCell>
                        <TableCell><Badge variant="outline" className={`text-[10px] gap-1 ${sc.color}`}>{sc.icon} {sc.label}</Badge></TableCell>
                        <TableCell className="text-sm">v{c.version}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(c.sent_at)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDate(c.signed_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setSelectedContract(c); setDetailOpen(true); }}>
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
          <DialogHeader><DialogTitle className="font-display">Novo Contrato</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Pedido *</Label>
              <Select value={formOrderId} onValueChange={setFormOrderId}>
                <SelectTrigger><SelectValue placeholder="Selecione o pedido" /></SelectTrigger>
                <SelectContent>{orders.map(o => <SelectItem key={o.id} value={o.id}>{o.code} — {o.client_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Conteúdo do contrato <span className="text-muted-foreground">(deixe vazio para usar template padrão)</span></Label>
              <Textarea rows={8} value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="Termos e condições do contrato..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">Observações internas</Label><Textarea rows={3} value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Notas..." /></div>
              <div className="space-y-1.5"><Label className="text-xs">Rodapé</Label><Textarea rows={3} value={formFooter} onChange={e => setFormFooter(e.target.value)} placeholder="Texto de rodapé..." /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Criar contrato</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              Contrato — {selectedContract?.orders?.code}
            </SheetTitle>
          </SheetHeader>
          {selectedContract && (
            <Tabs defaultValue="info" className="mt-4">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
                <TabsTrigger value="acoes">Ações</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-5 mt-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => { const sc = statusConfig[selectedContract.status] ?? statusConfig.rascunho; return <Badge variant="outline" className={`gap-1 ${sc.color}`}>{sc.icon} {sc.label}</Badge>; })()}
                  <span className="text-xs text-muted-foreground">v{selectedContract.version}</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                  <p className="font-medium text-base">{selectedContract.orders?.clients?.name ?? '—'}</p>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <span>Pedido: <span className="font-mono text-foreground">{selectedContract.orders?.code}</span></span>
                    <span>Loja: {selectedContract.orders?.stores?.name ?? '—'}</span>
                    <span>Email: {selectedContract.orders?.clients?.email ?? '—'}</span>
                    <span>Telefone: {selectedContract.orders?.clients?.phone ?? '—'}</span>
                    <span>CPF: {selectedContract.orders?.clients?.cpf ?? '—'}</span>
                    <span>Valor: {selectedContract.orders?.final_value ? (selectedContract.orders.final_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1"><span className="text-xs text-muted-foreground">Criado</span><p className="font-medium">{fmtDate(selectedContract.created_at)}</p></div>
                  <div className="space-y-1"><span className="text-xs text-muted-foreground">Enviado</span><p className="font-medium">{fmtDate(selectedContract.sent_at)}</p></div>
                  <div className="space-y-1"><span className="text-xs text-muted-foreground">Assinado</span><p className="font-medium">{fmtDate(selectedContract.signed_at)}</p></div>
                </div>
                {selectedContract.signature_link && (
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase">Link de assinatura</h3>
                    <div className="flex items-center gap-2">
                      <div className="bg-muted/30 rounded p-2 text-xs font-mono break-all flex-1">{selectedContract.signature_link}</div>
                      <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(selectedContract.signature_link!); toast.success('Link copiado'); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                {selectedContract.notes && (
                  <div className="space-y-1"><h3 className="text-xs font-semibold text-muted-foreground uppercase">Observações</h3><p className="text-sm text-muted-foreground">{selectedContract.notes}</p></div>
                )}
              </TabsContent>

              <TabsContent value="conteudo" className="mt-4">
                <ContractEditor
                  content={selectedContract.content || defaultTemplate(selectedContract)}
                  onSave={(c) => updateContent(selectedContract, c)}
                  readOnly={selectedContract.status === 'assinado'}
                />
              </TabsContent>

              <TabsContent value="acoes" className="space-y-4 mt-4">
                <h3 className="text-sm font-semibold">Gerenciar contrato</h3>
                <div className="grid grid-cols-1 gap-3">
                  <Button variant="outline" className="justify-start" onClick={() => generatePdf(selectedContract)} disabled={generatingPdf}>
                    <Download className="h-4 w-4 mr-2" /> {generatingPdf ? 'Gerando…' : 'Baixar Contrato'}
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => handleSendEmail(selectedContract)}>
                    <Mail className="h-4 w-4 mr-2" /> Enviar por E-mail
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => generateSignatureLink(selectedContract)}>
                    <PenTool className="h-4 w-4 mr-2" /> Gerar Link de Assinatura
                  </Button>
                  {selectedContract.signature_link && (
                    <Button variant="outline" className="justify-start" onClick={() => window.open(selectedContract.signature_link!, '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" /> Abrir Link de Assinatura
                    </Button>
                  )}
                </div>
                <Separator />
                <h3 className="text-sm font-semibold">Alterar Status</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedContract.status === 'rascunho' && (
                    <Button size="sm" onClick={() => handleStatusChange(selectedContract, 'enviado')}><Send className="h-3.5 w-3.5 mr-1.5" /> Marcar Enviado</Button>
                  )}
                  {(selectedContract.status === 'enviado' || selectedContract.status === 'pendente') && (
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusChange(selectedContract, 'assinado')}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Marcar Assinado
                    </Button>
                  )}
                  <Select value={selectedContract.status} onValueChange={v => handleStatusChange(selectedContract, v)}>
                    <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="enviado">Enviado</SelectItem>
                      <SelectItem value="assinado">Assinado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Contract Content Editor ───
function ContractEditor({ content, onSave, readOnly }: { content: string; onSave: (c: string) => void; readOnly?: boolean }) {
  const [text, setText] = useState(content);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setText(content); setDirty(false); }, [content]);

  return (
    <div className="space-y-3">
      <Textarea
        rows={20}
        value={text}
        onChange={e => { setText(e.target.value); setDirty(true); }}
        readOnly={readOnly}
        className="font-mono text-xs leading-relaxed"
      />
      {!readOnly && (
        <div className="flex justify-end gap-2">
          {dirty && <span className="text-xs text-muted-foreground self-center">Alterações não salvas</span>}
          <Button size="sm" disabled={!dirty} onClick={() => { onSave(text); setDirty(false); }}>Salvar Conteúdo</Button>
        </div>
      )}
    </div>
  );
}
