import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Plus, UserPlus } from "lucide-react";
import { LeadFormDialog, LeadRow } from "@/components/leads/LeadFormDialog";
import { toast } from "sonner";

const COLUMNS: { id: string; label: string; dot: string }[] = [
  { id: "novo",       label: "NOVOS",      dot: "#3B6FB0" },
  { id: "em_contato", label: "EM CONTATO", dot: "#3B6FB0" },
  { id: "orcamento",  label: "ORÇAMENTO",  dot: "#7E4FA0" },
  { id: "negociacao", label: "NEGOCIAÇÃO", dot: "#A8842A" },
  { id: "fechado",    label: "FECHADO",    dot: "#3F8B5C" },
];

const TAG_COLORS = ["#EAF2FB", "#E8F4ED", "#FBF3DF", "#F4ECF7", "#FDECEC"];
const TAG_FG = ["#1E3A6B", "#1F5235", "#6B5210", "#4A2A66", "#8C3535"];

function tagStyle(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  const idx = h % TAG_COLORS.length;
  return { background: TAG_COLORS[idx], color: TAG_FG[idx] };
}

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

  useEffect(() => {
    load();
  }, []);

  const moveStatus = async (lead: LeadRow, newStatus: string) => {
    const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", lead.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: newStatus } : l)));
  };

  const convertToCliente = async (lead: LeadRow) => {
    const { error } = await supabase.from("clientes").insert({
      nome: lead.nome,
      telefone: lead.whatsapp,
      observacoes: lead.notas ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("leads").update({ status: "fechado" }).eq("id", lead.id);
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

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
            Gestão de Leads
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Acompanhe e gerencie seus leads em tempo real
          </p>
        </div>
        <Button
          size="default"
          className="gap-1.5"
          style={{ background: "#5B5BD6", color: "#fff" }}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <MessageSquare className="w-4 h-4" /> Novo Lead
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-5 gap-4">
          {COLUMNS.map((c) => (
            <Skeleton key={c.id} className="h-[500px]" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={MessageSquare}
            title="Nenhum lead cadastrado"
            description="Crie seu primeiro lead para começar a acompanhar o pipeline."
            action={
              <Button
                size="sm"
                style={{ background: "#5B5BD6", color: "#fff" }}
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo lead
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-4">
          {COLUMNS.map((col) => {
            const items = leads.filter((l) => l.status === col.id);
            return (
              <div key={col.id} className="flex flex-col">
                {/* Column header (card) */}
                <div
                  className="rounded-xl bg-card px-4 py-3.5 flex items-center justify-between mb-3"
                  style={{ border: "1px solid hsl(var(--border))" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block rounded-full"
                      style={{ width: 7, height: 7, background: col.dot }}
                    />
                    <span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground">
                      {col.label}
                    </span>
                  </div>
                  <span className="text-[12px] text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                </div>

                {/* Drop zone */}
                <div
                  className="flex flex-col gap-3 min-h-[500px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(e, col.id)}
                >
                  {items.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, lead.id)}
                      onClick={() => {
                        setEditing(lead);
                        setDialogOpen(true);
                      }}
                      className="bg-card rounded-xl px-4 py-4 cursor-pointer hover:shadow-sm transition-all group"
                      style={{ border: "1px solid hsl(var(--border))" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[14px] font-medium text-foreground truncate">
                          {lead.nome}
                        </div>
                        <span
                          className="inline-block rounded-full mt-1.5 shrink-0"
                          style={{ width: 7, height: 7, background: col.dot }}
                        />
                      </div>

                      {lead.interesse && lead.interesse.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {lead.interesse.slice(0, 3).map((i) => (
                            <span
                              key={i}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                              style={tagStyle(i)}
                            >
                              {i}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="text-mono mt-3">{fmtDate(String(lead.created_at ?? ""))}</div>

                      {col.id !== "fechado" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            convertToCliente(lead);
                          }}
                          className="mt-2.5 text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
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
