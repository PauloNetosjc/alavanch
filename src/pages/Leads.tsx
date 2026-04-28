import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Plus, UserPlus } from "lucide-react";
import { LeadFormDialog, LeadRow } from "@/components/leads/LeadFormDialog";
import { toast } from "sonner";

const COLUMNS: { id: string; label: string }[] = [
  { id: "novo", label: "Novo" },
  { id: "qualificado", label: "Qualificado" },
  { id: "proposta", label: "Proposta" },
  { id: "negociacao", label: "Negociação" },
  { id: "convertido", label: "Convertido" },
  { id: "perdido", label: "Perdido" },
];

export default function Leads() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LeadRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setLeads((data ?? []) as LeadRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const moveStatus = async (lead: LeadRow, newStatus: string) => {
    const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", lead.id);
    if (error) { toast.error(error.message); return; }
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status: newStatus } : l));
  };

  const convertToCliente = async (lead: LeadRow) => {
    const { error } = await supabase.from("clientes").insert({
      nome: lead.nome,
      telefone: lead.whatsapp,
      observacoes: lead.notas ?? null,
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("leads").update({ status: "convertido" }).eq("id", lead.id);
    toast.success("Lead convertido em cliente");
    load();
  };

  const onDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
  };
  const onDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("leadId");
    const lead = leads.find((l) => l.id === id);
    if (lead && lead.status !== status) moveStatus(lead, status);
  };

  return (
    <div>
      <PageHeader
        title="Gestão de Leads"
        subtitle="Acompanhe e gerencie seus leads em tempo real"
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo lead
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-6 gap-3">
          {COLUMNS.map((c) => <Skeleton key={c.id} className="h-96" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={MessageSquare}
            title="Nenhum lead cadastrado"
            description="Crie seu primeiro lead para começar a acompanhar o pipeline."
            action={<Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="w-3.5 h-3.5 mr-1.5" /> Novo lead</Button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-3">
          {COLUMNS.map((col) => {
            const items = leads.filter((l) => l.status === col.id);
            return (
              <div
                key={col.id}
                className="bg-muted/40 rounded-lg p-2 min-h-[400px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, col.id)}
              >
                <div className="flex items-center justify-between px-1.5 py-2 mb-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{col.label}</span>
                  <span className="text-[10px] text-muted-foreground">{items.length}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {items.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, lead.id)}
                      onClick={() => { setEditing(lead); setDialogOpen(true); }}
                      className="bg-card border border-border rounded-md p-2.5 cursor-pointer hover:border-accent transition-colors"
                    >
                      <div className="text-[12px] font-medium text-foreground truncate">{lead.nome}</div>
                      <div className="text-mono mt-0.5">{lead.whatsapp}</div>
                      {lead.interesse && lead.interesse.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {lead.interesse.slice(0, 2).map((i) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{i}</span>
                          ))}
                        </div>
                      )}
                      {col.id !== "convertido" && col.id !== "perdido" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); convertToCliente(lead); }}
                          className="mt-2 text-[10px] text-accent-foreground/80 hover:text-foreground inline-flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" /> Converter em cliente
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeadFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lead={editing}
        onSaved={load}
      />
    </div>
  );
}
