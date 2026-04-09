import { Card, CardContent } from '@/components/ui/card';
import { FileSignature } from 'lucide-react';

export default function Contratos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Contratos</h1>
        <p className="text-sm text-muted-foreground mt-1">Geração, envio e gestão de contratos</p>
      </div>
      <Card className="border-border/60">
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileSignature className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum contrato cadastrado.</p>
        </CardContent>
      </Card>
    </div>
  );
}
