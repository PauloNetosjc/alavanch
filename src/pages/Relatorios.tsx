import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function Relatorios() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-1">Relatórios gerenciais e operacionais</p>
      </div>
      <Card className="border-border/60">
        <CardContent className="py-12 text-center text-muted-foreground">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Relatórios em desenvolvimento.</p>
        </CardContent>
      </Card>
    </div>
  );
}
