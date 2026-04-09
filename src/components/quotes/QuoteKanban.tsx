import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { maskPhone } from '@/lib/masks';
import type { Tables } from '@/integrations/supabase/types';

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

  const fetchQuotes = useCallback(async () => {
    const { data } = await supabase
      .from('quotes')
      .select('*, clients(name, phone)')
      .order('updated_at', { ascending: false });
    setQuotes((data as QuoteWithClient[]) ?? []);
  }, []);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes, refreshKey]);

  const filtered = quotes.filter(q => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      q.code.toLowerCase().includes(s) ||
      q.clients?.name?.toLowerCase().includes(s) ||
      q.clients?.phone?.includes(s) ||
      q.origin?.toLowerCase().includes(s)
    );
  });

  const byColumn = (colId: string) => filtered.filter(q => q.status === colId);

  const handleDragStart = (id: string) => setDraggedId(id);

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(colId);
  };

  const handleDrop = async (colId: string) => {
    if (!draggedId) return;
    setDragOverCol(null);
    setDraggedId(null);

    const quote = quotes.find(q => q.id === draggedId);
    if (!quote || quote.status === colId) return;

    // Optimistic update
    setQuotes(prev => prev.map(q => q.id === draggedId ? { ...q, status: colId } : q));

    const { error } = await supabase
      .from('quotes')
      .update({ status: colId })
      .eq('id', draggedId);

    if (error) {
      setQuotes(prev => prev.map(q => q.id === draggedId ? { ...q, status: quote.status } : q));
    }
  };

  const formatCurrency = (v: number | null) =>
    v ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '';

  return (
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
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {col.title}
              </span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">
                {items.length}
              </Badge>
            </div>
            <div
              className={`space-y-2 min-h-[120px] rounded-lg p-2 transition-colors ${
                isOver ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/30'
              }`}
            >
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
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          {q.urgency}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">
                      {q.clients?.name ?? '—'}
                    </p>
                    {q.clients?.phone && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {maskPhone(q.clients.phone)}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                      {q.final_value ? (
                        <span className="text-xs font-semibold text-foreground">
                          {formatCurrency(q.final_value)}
                        </span>
                      ) : q.total_value ? (
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(q.total_value)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">Sem valor</span>
                      )}
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenCalc(q); }}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Calcular
                        </button>
                        <span className="text-muted-foreground/30">·</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onEdit(q); }}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                    {q.origin && (
                      <p className="text-[10px] text-muted-foreground/70 mt-1">{q.origin}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
