import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, ShoppingCart } from 'lucide-react';
import { useState } from 'react';

export default function Pedidos() {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Pedidos</h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhamento e gestão de pedidos</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Novo Pedido
        </Button>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar pedido..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Card className="border-border/60">
        <CardContent className="py-12 text-center text-muted-foreground">
          <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum pedido cadastrado.</p>
        </CardContent>
      </Card>
    </div>
  );
}
