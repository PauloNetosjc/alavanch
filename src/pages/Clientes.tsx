import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Search, Pencil } from "lucide-react";
import { ClienteFormDialog, ClienteRow } from "@/components/clientes/ClienteFormDialog";
import { toast } from "sonner";

export default function Clientes() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClienteRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setClientes((data ?? []) as ClienteRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.nome.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.cpf_cnpj ?? "").toLowerCase().includes(q) ||
      (c.telefone ?? "").toLowerCase().includes(q)
    );
  });

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (c: ClienteRow) => {
    setEditing(c);
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Gerencie todos os seus clientes"
        actions={
          <Button onClick={openNew} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo cliente
          </Button>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail, documento…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="surface-card p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={clientes.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum resultado"}
            description={clientes.length === 0 ? "Crie seu primeiro cliente para começar." : "Tente outro termo de busca."}
            action={clientes.length === 0 ? <Button size="sm" onClick={openNew}><Plus className="w-3.5 h-3.5 mr-1.5" /> Novo cliente</Button> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => openEdit(c)}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-mono">{c.cpf_cnpj ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell className="text-mono">{c.telefone ?? "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ClienteFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cliente={editing}
        onSaved={load}
      />
    </div>
  );
}
