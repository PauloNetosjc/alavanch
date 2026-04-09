import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText, Users, ShoppingCart, FileSignature,
  ClipboardCheck, DollarSign, Wrench, AlertTriangle
} from 'lucide-react';

const stats = [
  { label: 'Orçamentos abertos', value: '24', icon: FileText, color: 'text-info' },
  { label: 'Taxa de fechamento', value: '32%', icon: Users, color: 'text-success' },
  { label: 'Pedidos em andamento', value: '18', icon: ShoppingCart, color: 'text-primary' },
  { label: 'Contratos pendentes', value: '5', icon: FileSignature, color: 'text-warning' },
  { label: 'Revisões atrasadas', value: '3', icon: ClipboardCheck, color: 'text-destructive' },
  { label: 'Montagens do dia', value: '4', icon: Wrench, color: 'text-primary' },
  { label: 'Ocorrências abertas', value: '7', icon: AlertTriangle, color: 'text-warning' },
  { label: 'A receber (mês)', value: 'R$ 142.800', icon: DollarSign, color: 'text-success' },
];

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do sistema Forest Decor</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border/60 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold font-body">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Orçamentos recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Nenhum orçamento recente ainda.</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Alertas e prazos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Nenhum alerta pendente.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
