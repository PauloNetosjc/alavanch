import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, AlertTriangle } from 'lucide-react';

export default function Ocorrencias() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Ocorrências</h1>
          <p className="text-sm text-muted-foreground mt-1">Registro e acompanhamento de ocorrências</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-2" /> Nova Ocorrência</Button>
      </div>
      <Card className="border-border/60">
        <CardContent className="py-12 text-center text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma ocorrência registrada.</p>
        </CardContent>
      </Card>
    </div>
  );
}
