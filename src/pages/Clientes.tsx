import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Users, Eye, Pencil, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';
import { ClientDetailSheet } from '@/components/clients/ClientDetailSheet';
import type { Tables } from '@/integrations/supabase/types';

export default function Clientes() {
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<Tables<'clients'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editClient, setEditClient] = useState<Tables<'clients'> | null>(null);
  const [detailClient, setDetailClient] = useState<Tables<'clients'> | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    setClients(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.cpf?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  }, [clients, search]);

  const handleEdit = (client: Tables<'clients'>) => {
    setEditClient(client);
    setFormOpen(true);
  };

  const handleView = (client: Tables<'clients'>) => {
    setDetailClient(client);
    setDetailOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditClient(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro e gestão de clientes</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, telefone ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary" className="text-xs">
          {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Lista de Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}
              </p>
              {!search && (
                <p className="text-xs mt-1">Clique em "Novo Cliente" para começar.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(client => (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleView(client)}
                    >
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {client.cpf || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {client.phone || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {client.email || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); handleView(client); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); handleEdit(client); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
                              const { error } = await supabase.from('clients').delete().eq('id', client.id);
                              if (error) { toast.error('Erro ao excluir cliente'); return; }
                              toast.success('Cliente excluído');
                              fetchClients();
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ClientFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        onSuccess={fetchClients}
        editClient={editClient}
      />

      <ClientDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        client={detailClient}
      />
    </div>
  );
}
