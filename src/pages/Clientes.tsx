import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  UserCheck,
  FileText,
  TrendingUp,
  Phone,
} from "lucide-react";
import {
  ClienteFormDialog,
  ClienteRow,
} from "@/components/clientes/ClienteFormDialog";
import { toast } from "sonner";

interface KpiTileProps {
  label: string;
  value: number | string;
  icon: typeof Users;
  variant: "blue" | "green" | "amber" | "purple";
}

const variantStyles: Record<KpiTileProps["variant"], { bg: string; border: string; icon: string; value: string }> = {
  blue:   { bg: "#EAF2FB", border: "#D6E4F5", icon: "#3B6FB0", value: "#1E3A6B" },
  green:  { bg: "#E8F4ED", border: "#D2E8DB", icon: "#3F8B5C", value: "#1F5235" },
  amber:  { bg: "#FBF3DF", border: "#F3E5BF", icon: "#A8842A", value: "#6B5210" },
  purple: { bg: "#F4ECF7", border: "#E5D6EE", icon: "#7E4FA0", value: "#4A2A66" },
};

function KpiTile({ label, value, icon: Icon, variant }: KpiTileProps) {
  const s = variantStyles[variant];
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <div className="flex items-start justify-between">
        <span className="text-[12px] font-medium" style={{ color: s.value, opacity: 0.85 }}>
          {label}
        </span>
        <Icon className="w-4 h-4" style={{ color: s.icon }} />
      </div>
      <div className="text-[34px] font-semibold leading-none tracking-tight" style={{ color: s.value }}>
        {value}
      </div>
    </div>
  );
}

export default function Clientes() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "ativo" | "inativo">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClienteRow | null>(null);
  const [orcamentosAbertos, setOrcamentosAbertos] = useState(0);
  const [contratosFechados, setContratosFechados] = useState(0);

  const load = async () => {
    setLoading(true);
    const [clientesQ, orcQ, pedQ] = await Promise.all([
      supabase.from("clientes").select("*").order("created_at", { ascending: false }),
      supabase.from("orcamentos").select("id", { count: "exact", head: true }).neq("status", "convertido").neq("status", "perdido"),
      supabase.from("pedidos").select("id", { count: "exact", head: true }),
    ]);
    if (clientesQ.error) toast.error(clientesQ.error.message);
    setClientes((clientesQ.data ?? []) as ClienteRow[]);
    setOrcamentosAbertos(orcQ.count ?? 0);
    setContratosFechados(pedQ.count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Auto-abrir cliente vindo de ?cliente=<id> (ex: link a partir da agenda)
  useEffect(() => {
    if (loading || clientes.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("cliente");
    if (!id) return;
    const found = clientes.find((c) => c.id === id);
    if (found) {
      setEditing(found);
      setDialogOpen(true);
    }
  }, [loading, clientes]);

  const totalClientes = clientes.length;
  const clientesAtivos = useMemo(() => clientes.filter((c) => c.ativo !== false).length, [clientes]);

  const filtered = clientes.filter((c) => {
    if (filter === "ativo" && c.ativo === false) return false;
    if (filter === "inativo" && c.ativo !== false) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
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

  const remove = async (c: ClienteRow) => {
    if (!confirm(`Remover ${c.nome}?`)) return;
    const { error } = await supabase.from("clientes").delete().eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cliente removido");
    load();
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const initials = (nome: string) =>
    nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: "#EAF2FB", border: "1px solid #D6E4F5" }}
          >
            <Users className="w-6 h-6" style={{ color: "#3B6FB0" }} />
          </div>
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Clientes</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Gerencie todos os seus clientes
            </p>
          </div>
        </div>
        <Button onClick={openNew} size="default" className="gap-1.5">
          <Plus className="w-4 h-4" /> Novo Cliente
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <KpiTile label="Total de Clientes" value={totalClientes} icon={Users} variant="blue" />
        <KpiTile label="Clientes Ativos" value={clientesAtivos} icon={UserCheck} variant="green" />
        <KpiTile label="Orçamentos Abertos" value={orcamentosAbertos} icon={FileText} variant="amber" />
        <KpiTile label="Contratos Fechados" value={contratosFechados} icon={TrendingUp} variant="purple" />
      </div>

      {/* Search + filter */}
      <div className="surface-card mb-4 flex items-center gap-3" style={{ padding: 12 }}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF/CNPJ ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="surface-card p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={clientes.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum resultado"}
            description={
              clientes.length === 0
                ? "Crie seu primeiro cliente para começar."
                : "Tente outro termo de busca ou ajuste o filtro."
            }
            action={
              clientes.length === 0 ? (
                <Button size="sm" onClick={openNew}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo cliente
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="md:hidden divide-y">
              {filtered.map((c) => (
                <li key={c.id} className="p-4 active:bg-muted/40" onClick={() => openEdit(c)}>
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-medium shrink-0"
                      style={{ background: "#EAF2FB", color: "#3B6FB0" }}
                    >
                      {initials(c.nome)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[14px] font-medium truncate">{c.nome}</div>
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            background: c.ativo === false ? "hsl(var(--status-neutral-bg))" : "hsl(var(--status-success-bg))",
                            color: c.ativo === false ? "hsl(var(--status-neutral-fg))" : "hsl(var(--status-success-fg))",
                          }}
                        >
                          {c.ativo === false ? "Inativo" : "Ativo"}
                        </span>
                      </div>
                      <div className="text-mono text-[11px] mt-0.5">{c.cpf_cnpj ?? "—"}</div>
                      {c.telefone && (
                        <div className="flex items-center gap-1.5 text-[12px] text-foreground mt-1">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span className="text-mono">{c.telefone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="text-[11px] text-muted-foreground truncate">{c.email}</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); remove(c); }}>
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Data de Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => openEdit(c)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0"
                            style={{ background: "#EAF2FB", color: "#3B6FB0" }}
                          >
                            {initials(c.nome)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium text-foreground truncate">
                              {c.nome}
                            </div>
                            <div className="text-mono mt-0.5">{c.cpf_cnpj ?? "—"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {c.telefone && (
                            <div className="flex items-center gap-1.5 text-[12px] text-foreground">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span className="text-mono">{c.telefone}</span>
                            </div>
                          )}
                          {c.email && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                              {c.email}
                            </div>
                          )}
                          {!c.telefone && !c.email && <span className="text-[11px] text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-[12px] text-foreground">{fmtDate(c.created_at as unknown as string)}</div>
                        <div className="mt-0.5">
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{
                              background: c.ativo === false ? "hsl(var(--status-neutral-bg))" : "hsl(var(--status-success-bg))",
                              color: c.ativo === false ? "hsl(var(--status-neutral-fg))" : "hsl(var(--status-success-fg))",
                            }}
                          >
                            {c.ativo === false ? "Inativo" : "Ativo"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(c);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              remove(c);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
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

