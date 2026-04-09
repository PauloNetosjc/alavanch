import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

const cards = [
  { label: 'Saldo Anterior', value: 'R$ 85.200', icon: Wallet, color: 'text-muted-foreground' },
  { label: 'A Receber', value: 'R$ 142.800', icon: TrendingUp, color: 'text-success' },
  { label: 'A Pagar', value: 'R$ 67.450', icon: TrendingDown, color: 'text-destructive' },
  { label: 'Projetado', value: 'R$ 160.550', icon: DollarSign, color: 'text-primary' },
];

export default function Financeiro() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Controle financeiro e fluxo de caixa</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
