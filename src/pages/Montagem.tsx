import { Badge } from '@/components/ui/badge';

const columns = [
  { id: 'produzindo', title: 'Produzindo / Fábrica', color: 'bg-info' },
  { id: 'agend_entrega', title: 'Agend. Entrega-Depósito', color: 'bg-warning' },
  { id: 'entregue', title: 'Entregue', color: 'bg-success' },
  { id: 'montagem_agend', title: 'Montagem Agendada', color: 'bg-warning' },
  { id: 'em_montagem', title: 'Em Montagem', color: 'bg-primary' },
  { id: 'vistoria_pend', title: 'Vistoria Pendente', color: 'bg-warning' },
  { id: 'vistoria_agend', title: 'Vistoria Agendada', color: 'bg-info' },
  { id: 'finalizado', title: 'Finalizado', color: 'bg-success' },
];

export default function Montagem() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Montagem</h1>
        <p className="text-sm text-muted-foreground mt-1">Kanban de montagem e entregas</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.id} className="min-w-[220px] max-w-[220px] flex-shrink-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className={`h-2 w-2 rounded-full ${col.color}`} />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{col.title}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">0</Badge>
            </div>
            <div className="min-h-[120px] rounded-lg bg-muted/30 p-2">
              <p className="text-xs text-muted-foreground/60 text-center py-6">Vazio</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
