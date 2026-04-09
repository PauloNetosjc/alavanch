import { Badge } from '@/components/ui/badge';

const columns = [
  { id: 'pedido_peca', title: 'Pedido de Peça', color: 'bg-info' },
  { id: 'aguard_prod', title: 'Aguardando Produção', color: 'bg-warning' },
  { id: 'agend_pend', title: 'Agendamento Pendente', color: 'bg-warning' },
  { id: 'agendados', title: 'Clientes Agendados', color: 'bg-primary' },
  { id: 'concluidas', title: 'Assistências Concluídas', color: 'bg-success' },
  { id: 'sem_retorno', title: 'Sem Retorno', color: 'bg-muted-foreground' },
];

export default function PosMontagem() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Pós-montagem</h1>
        <p className="text-sm text-muted-foreground mt-1">Assistências e pós-venda</p>
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
