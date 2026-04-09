import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, LayoutGrid, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const kanbanColumns = [
  { id: 'novo_lead', title: 'Novo Lead', color: 'bg-info' },
  { id: 'em_atendimento', title: 'Em Atendimento', color: 'bg-primary' },
  { id: 'em_elaboracao', title: 'Em Elaboração', color: 'bg-primary' },
  { id: 'enviado', title: 'Enviado', color: 'bg-warning' },
  { id: 'em_negociacao', title: 'Em Negociação', color: 'bg-warning' },
  { id: 'acomp_7d', title: 'Acomp. 7d', color: 'bg-muted-foreground' },
  { id: 'acomp_15d', title: 'Acomp. 15d', color: 'bg-muted-foreground' },
  { id: 'acomp_30d', title: 'Acomp. 30d', color: 'bg-muted-foreground' },
  { id: '30d_plus', title: '30d+', color: 'bg-muted-foreground' },
  { id: 'fechado', title: 'Fechado', color: 'bg-success' },
  { id: 'declinado', title: 'Declinado', color: 'bg-destructive' },
  { id: 'arquivado', title: 'Arquivado', color: 'bg-muted-foreground' },
];

export default function Orcamentos() {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Orçamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão comercial e pipeline de vendas</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Orçamento
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar orçamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban" className="gap-2">
            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
          </TabsTrigger>
          <TabsTrigger value="lista" className="gap-2">
            <List className="h-3.5 w-3.5" /> Lista
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {kanbanColumns.map((col) => (
              <div key={col.id} className="min-w-[260px] max-w-[260px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`h-2 w-2 rounded-full ${col.color}`} />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {col.title}
                  </span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">0</Badge>
                </div>
                <div className="space-y-2 min-h-[120px] rounded-lg bg-muted/30 p-2">
                  <p className="text-xs text-muted-foreground/60 text-center py-6">Vazio</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="lista" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-sm">Nenhum orçamento cadastrado.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
