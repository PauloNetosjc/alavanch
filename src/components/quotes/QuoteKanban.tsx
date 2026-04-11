import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { maskPhone } from '@/lib/masks';
import { Filter, X } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

const NONE = '__none__';

interface QuoteWithClient extends Tables<'quotes'> {
  clients: { name: string; phone: string | null } | null;
}

const COLUMNS = [
  { id: 'novo_lead', title: 'Novo Lead', dot: 'bg-sky-500' },
  { id: 'em_atendimento', title: 'Em Atendimento', dot: 'bg-primary' },
  { id: 'em_elaboracao', title: 'Em Elaboração', dot: 'bg-indigo-500' },
  { id: 'enviado', title: 'Enviado', dot: 'bg-amber-500' },
  { id: 'em_negociacao', title: 'Em Negociação', dot: 'bg-orange-500' },
  { id: 'acomp_7d', title: 'Acomp. 7d', dot: 'bg-muted-foreground' },
  { id: 'acomp_15d', title: 'Acomp. 15d', dot: 'bg-muted-foreground' },
  { id: 'acomp_30d', title: 'Acomp. 30d', dot: 'bg-muted-foreground' },
  { id: '30d_plus', title: '30d+', dot: 'bg-muted-foreground' },
  { id: 'fechado', title: 'Fechado', dot: 'bg-emerald-500' },
  { id: 'declinado', title: 'Declinado', dot: 'bg-destructive' },
  { id: 'arquivado', title: 'Arquivado', dot: 'bg-muted-foreground/60' },
];

const urgencyColors: Record<string, string> = {
  baixa: 'bg-muted text-muted-foreground',
  normal: '',
  alta: 'bg-amber-100 text-amber-800 border-amber-300',
  urgente: 'bg-red-100 text-red-800 border-red-300',
};

interface QuoteKanbanProps {
  search: string;
  onEdit: (q: Tables<'quotes'>) => void;
  onOpenCalc: (q: Tables<'quotes'>) => void;
  onCardClick: (quoteId: string) => void;
  refreshKey: number;
}

export function QuoteKanban({ search, onEdit, onOpenCalc, onCardClick, refreshKey }: QuoteKanbanProps) {
  const [quotes, setQuotes] = useState<QuoteWithClient[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Tags config
  const [tagsConfig, setTagsConfig] = useState<{ id: string; name: string; color: string }[]>([]);

  // Filter state
  const [storesList, setStoresList] = useState<Tables<'stores'>[]>([]);
  const [sellers, setSellers] = useState<{ id: string; full_name: string | null }[]>([]);
  const [filterStore, setFilterStore] = useState('');
  const [filterSeller, setFilterSeller] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const hasFilters = filterStore || filterSeller || filterUrgency || filterDateFrom || filterDateTo;

  const fetchQuotes = useCallback(async () => {
    const { data } = await supabase
      .from('quotes')
      .select('*, clients(name, phone)')
      .order('updated_at', { ascending: false });
    setQuotes((data as QuoteWithClient[]) ?? []);
  }, []);

  const fetchFilterData = useCallback(async () => {
    const [storesRes, sellersRes, tagsRes] = await Promise.all([
      supabase.from('stores').select('*').eq('active', true).order('name'),
      supabase.from('profiles').select('id, full_name').order('full_name'),
      supabase.from('tags_config').select('id, name, color').order('name'),
    ]);
    setStoresList(storesRes.data ?? []);
    setSellers(sellersRes.data ?? []);
    setTagsConfig((tagsRes.data ?? []).map(t => ({ id: t.id, name: t.name, color: t.color ?? '#6b7280' })));
  }, []);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes, refreshKey]);
  useEffect(() => { fetchFilterData(); }, [fetchFilterData]);

  const filtered = quotes.filter(q => {
    if (search.trim()) {
      const s = search.toLowerCase();
      const matchText = q.code.toLowerCase().includes(s) ||
        q.clients?.name?.toLowerCase().includes(s) ||
        q.clients?.phone?.includes(s) ||
        q.origin?.toLowerCase().includes(s);
      if (!matchText) return false;
    }
    if (filterStore && q.store_id !== filterStore) return false;
    if (filterSeller && q.seller_id !== filterSeller) return false;
    if (filterUrgency && q.urgency !== filterUrgency) return false;
    if (filterDateFrom && q.created_at < filterDateFrom) return false;
    if (filterDateTo && q.created_at > filterDateTo + 'T23:59:59') return false;
    return true;
  });

  const byColumn = (colId: string) => filtered.filter(q => q.status === colId);

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent, colId: string) => { e.preventDefault(); setDragOverCol(colId); };

  const handleDrop = async (colId: string) => {
    if (!draggedId) return;
    setDragOverCol(null);
    setDraggedId(null);
    const quote = quotes.find(q => q.id === draggedId);
    if (!quote || quote.status === colId) return;
    setQuotes(prev => prev.map(q => q.id === draggedId ? { ...q, status: colId } : q));
    const { error } = await supabase.from('quotes').update({ status: colId }).eq('id', draggedId);
    if (error) setQuotes(prev => prev.map(q => q.id === draggedId ? { ...q, status: quote.status } : q));
  };

  const clearFilters = () => {
    setFilterStore('');
    setFilterSeller('');
    setFilterUrgency('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const formatCurrency = (v: number | null) =>
    v ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '';

  const getTagName = (tagId: string) => tagsConfig.find(t => t.name === tagId || t.id === tagId);

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Filtros
              {hasFilters && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">Ativo</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-3" align="start">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Filtros avançados</h4>
              {hasFilters && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Loja</Label>
                <Select value={filterStore || NONE} onValueChange={v => setFilterStore(v === NONE ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Todas</SelectItem>
                    {storesList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vendedor</Label>
                <Select value={filterSeller || NONE} onValueChange={v => setFilterSeller(v === NONE ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Todos</SelectItem>
                    {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name ?? 'Sem nome'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Urgência</Label>
                <Select value={filterUrgency || NONE} onValueChange={v => setFilterUrgency(v === NONE ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Todas</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Período de</Label>
                  <Input type="date" className="h-8 text-xs" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Até</Label>
                  <Input type="date" className="h-8 text-xs" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {hasFilters && (
          <span className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map(col => {
          const items = byColumn(col.id);
          const isOver = dragOverCol === col.id;
          return (
            <div
              key={col.id}
              className="min-w-[270px] max-w-[270px] flex-shrink-0"
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col.id)}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`h-2 w-2 rounded-full ${col.dot}`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{col.title}</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">{items.length}</Badge>
              </div>
              <div className={`space-y-2 min-h-[120px] rounded-lg p-2 transition-colors ${isOver ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/30'}`}>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 text-center py-6">Vazio</p>
                ) : (
                  items.map(q => (
                    <div
                      key={q.id}
                      draggable
                      onDragStart={() => handleDragStart(q.id)}
                      onClick={() => onCardClick(q.id)}
                      className={`bg-card border border-border/60 rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${
                        draggedId === q.id ? 'opacity-50' : ''
                      } ${urgencyColors[q.urgency ?? 'normal'] || ''}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-[11px] font-mono text-muted-foreground">{q.code}</span>
                        {q.urgency && q.urgency !== 'normal' && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1">{q.urgency}</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{q.clients?.name ?? '—'}</p>
                      {q.clients?.phone && (
                        <p className="text-xs text-muted-foreground mt-0.5">{maskPhone(q.clients.phone)}</p>
                      )}
                      {/* Tags */}
                      {q.tags && q.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {q.tags.map((tag, i) => {
                            const cfg = getTagName(tag);
                            return (
                              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full border" style={cfg ? { backgroundColor: cfg.color + '20', color: cfg.color, borderColor: cfg.color + '40' } : {}}>
                                {cfg?.name ?? tag}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                        {q.final_value ? (
                          <span className="text-xs font-semibold text-foreground">{formatCurrency(q.final_value)}</span>
                        ) : q.total_value ? (
                          <span className="text-xs text-muted-foreground">{formatCurrency(q.total_value)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">Sem valor</span>
                        )}
                        <div className="flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); onOpenCalc(q); }} className="text-[10px] text-primary hover:underline">Calcular</button>
                          <span className="text-muted-foreground/30">·</span>
                          <button onClick={(e) => { e.stopPropagation(); onEdit(q); }} className="text-[10px] text-primary hover:underline">Editar</button>
                        </div>
                      </div>
                      {q.origin && <p className="text-[10px] text-muted-foreground/70 mt-1">{q.origin}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
