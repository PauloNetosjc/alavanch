import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Store, Users, Shield, Tags, CreditCard, Landmark, FileText } from 'lucide-react';

const sections = [
  { title: 'Lojas', desc: 'Gerenciar lojas cadastradas', icon: Store },
  { title: 'Usuários', desc: 'Gerenciar usuários do sistema', icon: Users },
  { title: 'Perfis e Permissões', desc: 'Definir níveis de acesso', icon: Shield },
  { title: 'Tags e Origens', desc: 'Configurar tags e origens de leads', icon: Tags },
  { title: 'Formas de Pagamento', desc: 'Gerenciar formas de pagamento', icon: CreditCard },
  { title: 'Contas Bancárias', desc: 'Gerenciar contas bancárias', icon: Landmark },
  { title: 'Templates de Contrato', desc: 'Modelos de contrato por loja', icon: FileText },
  { title: 'Regras de Aprovação', desc: 'Limites de desconto e aprovações', icon: Settings },
];

export default function Configuracoes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Configurações gerais do sistema</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sections.map((s) => (
          <Card key={s.title} className="border-border/60 hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <s.icon className="h-5 w-5 text-primary mb-2" />
              <CardTitle className="text-sm font-medium">{s.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
