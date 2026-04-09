import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Search, LayoutGrid, List, Pencil, Calculator } from 'lucide-react';
import { QuoteFormDialog } from '@/components/quotes/QuoteFormDialog';
import { QuoteKanban } from '@/components/quotes/QuoteKanban';
import { QuoteCalculator } from '@/components/quotes/QuoteCalculator';
import { QuoteDetailSheet } from '@/components/quotes/QuoteDetailSheet';
import { maskPhone } from '@/lib/masks';
import type { Tables } from '@/integrations/supabase/types';

interface QuoteWithClient extends Tables<'quotes'> {
  clients: { name: string; phone: string | null } | null;
}

const statusLabels: Record<string, string> = {
  novo_lead: 'Novo Lead', em_atendimento: 'Em Atendimento', em_elaboracao: 'Em Elaboração',
  enviado: 'Enviado', em_negociacao: 'Em Negociação', acomp_7d: 'Acomp. 7d',
  acomp_15d: 'Acomp. 15d', acomp_30d: 'Acomp. 30d', '30d_plus': '30d+',
  fechado: 'Fechado', declinado: 'Declinado', arquivado: 'Arquivado',
};

export default function Orcamentos() {
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<Tables<'quotes'> | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcQuote, setCalcQuote] = useState<Tables<'quotes'> | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailQuoteId, setDetailQuoteId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [listQuotes, setListQuotes] = useState<QuoteWithClient[]>([]);

  const refresh = () => setRefreshKey(k => k + 1);

  const fetchList = async () => {
    const { data } = await supabase
      .from('quotes')
      .select('*, clients(name, phone)')
      .order('created_at', { ascending: false });
    setListQuotes((data as QuoteWithClient[]) ?? []);
  };

  useEffect(() => { fetchList(); }, [refreshKey]);

  const handleEdit = (q: Tables<'quotes'>) => { setEditQuote(q); setFormOpen(true); };
  const handleFormClose = (open: boolean) => { setFormOpen(open); if (!open) setEditQuote(null); };
  const handleOpenCalc = (q: Tables<'quotes'>) => { setCalcQuote(q); setCalcOpen(true); };
  const handleCardClick = (quoteId: string) => { setDetailQuoteId(quoteId); setDetailOpen(true); };

  const fmt = (v: number | null) =>
    v ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—';

  const filteredList = listQuotes.filter(q => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return q.code.toLowerCase().includes(s) || q.clients?.name?.toLowerCase().includes(s) || q.clients?.phone?.includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Orçamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão comercial e pipeline de vendas</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Orçamento
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código, cliente, telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary" className="text-xs">
          {filteredList.length} orçamento{filteredList.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban" className="gap-2"><LayoutGrid className="h-3.5 w-3.5" /> Kanban</TabsTrigger>
          <TabsTrigger value="lista" className="gap-2"><List className="h-3.5 w-3.5" /> Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <QuoteKanban search={search} onEdit={handleEdit} onOpenCalc={handleOpenCalc} onCardClick={handleCardClick} refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="lista" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="p-0">
              {filteredList.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground"><p className="text-sm">Nenhum orçamento encontrado.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Urgência</TableHead>
                        <TableHead className="w-[100px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredList.map(q => (
                        <TableRow key={q.id} className="cursor-pointer" onClick={() => handleCardClick(q.id)}>
                          <TableCell className="font-mono text-xs">{q.code}</TableCell>
                          <TableCell className="font-medium">{q.clients?.name ?? '—'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{statusLabels[q.status] ?? q.status}</Badge></TableCell>
                          <TableCell>{fmt(q.final_value ?? q.total_value)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{q.origin ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${q.urgency === 'urgente' ? 'border-destructive text-destructive' : q.urgency === 'alta' ? 'border-amber-500 text-amber-700' : ''}`}>
                              {q.urgency ?? 'normal'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenCalc(q); }}><Calculator className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEdit(q); }}><Pencil className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <QuoteFormDialog open={formOpen} onOpenChange={handleFormClose} onSuccess={refresh} editQuote={editQuote} />
      <QuoteCalculator open={calcOpen} onOpenChange={setCalcOpen} quote={calcQuote} onSuccess={refresh} />
      <QuoteDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        quoteId={detailQuoteId}
        onEdit={handleEdit}
        onOpenCalc={handleOpenCalc}
        onRefresh={refresh}
      />
    </div>
  );
}
