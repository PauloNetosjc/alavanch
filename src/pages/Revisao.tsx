import { Badge } from '@/components/ui/badge';

const columns = [
  { id: 'aguardando', title: 'Aguardando Revisão', color: 'bg-warning' },
  { id: 'em_revisao', title: 'Em Revisão', color: 'bg-info' },
  { id: 'aguardando_lib', title: 'Aguardando Liberação', color: 'bg-warning' },
  { id: 'liberado', title: 'Liberado', color: 'bg-success' },
  { id: 'adendo', title: 'Adendo', color: 'bg-destructive' },
  { id: 'arquivado', title: 'Arquivado', color: 'bg-muted-foreground' },
];

export default function Revisao() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Revisão</h1>
        <p className="text-sm text-muted-foreground mt-1">Kanban de revisão de projetos</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.id} className="min-w-[240px] max-w-[240px] flex-shrink-0">
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
