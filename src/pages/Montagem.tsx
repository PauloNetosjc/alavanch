import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Hammer, Truck, MapPin, CalendarDays, ExternalLink, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLoja } from "@/contexts/LojaContext";
import { AgendaEventoDialog, type AgendaTipo } from "@/components/agenda/AgendaEventoDialog";

type Pedido = {
  id: string;
  codigo: string | null;
  valor_total: number | null;
  endereco_entrega: string | null;
  data_entrega: string | null;
  data_montagem: string | null;
  entregador_id: string | null;
  montador_id: string | null;
  estagio_montagem_id: string | null;
  cliente: { nome: string | null; telefone: string | null } | null;
  entregador_nome?: string | null;
  montador_nome?: string | null;
  estagio_nome?: string | null;
};

const fmtBrl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

// Stage names that determine the section
const STAGE_ENTREGA = "Agendamento Entrega"; // contains
const STAGE_ENTREGUE = "Entregue";
const STAGE_MONTAGEM_AG = "Montagem Agendada";

export default function Montagem() {
  const { selectedLojaId } = useLoja();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAgendar, setOpenAgendar] = useState<{ pedidoId: string; tipo: AgendaTipo } | null>(null);

  const load = async () => {
    setLoading(true);
    // Fetch montagem pipeline stages
    const { data: stages } = await supabase
      .from("pipeline_estagios")
      .select("id, nome")
      .eq("pipeline", "montagem")
      .order("ordem");
    const stageMap = new Map<string, string>();
    (stages || []).forEach((s: any) => stageMap.set(s.id, s.nome));
    const relevantIds = (stages || [])
      .filter((s: any) =>
        s.nome.includes(STAGE_ENTREGA) || s.nome.includes(STAGE_ENTREGUE) || s.nome.includes(STAGE_MONTAGEM_AG),
      )
      .map((s: any) => s.id);

    let q = supabase
      .from("pedidos")
      .select(
        "id, codigo, valor_total, endereco_entrega, data_entrega, data_montagem, entregador_id, montador_id, estagio_montagem_id, cliente:clientes(nome, telefone)",
      )
      .in("estagio_montagem_id", relevantIds.length ? relevantIds : ["00000000-0000-0000-0000-000000000000"]);
    if (selectedLojaId) q = q.eq("loja_id", selectedLojaId);
    const { data: peds } = await q;
    const list = ((peds as any[]) || []).map((p: any) => ({
      ...p,
      estagio_nome: stageMap.get(p.estagio_montagem_id) || "",
    })) as Pedido[];

    // Resolve user names
    const userIds = Array.from(
      new Set(list.flatMap((p) => [p.entregador_id, p.montador_id]).filter(Boolean) as string[]),
    );
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome_completo")
        .in("user_id", userIds);
      const map = new Map<string, string>();
      (profs || []).forEach((p: any) => map.set(p.user_id, p.nome_completo || ""));
      list.forEach((p) => {
        p.entregador_nome = p.entregador_id ? map.get(p.entregador_id) || null : null;
        p.montador_nome = p.montador_id ? map.get(p.montador_id) || null : null;
      });
    }
    setPedidos(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedLojaId]);

  const entregas = useMemo(
    () => pedidos.filter((p) => (p.estagio_nome || "").includes(STAGE_ENTREGA)),
    [pedidos],
  );
  const montagens = useMemo(
    () =>
      pedidos.filter(
        (p) => (p.estagio_nome || "").includes(STAGE_ENTREGUE) || (p.estagio_nome || "").includes(STAGE_MONTAGEM_AG),
      ),
    [pedidos],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda Logística"
        subtitle="Sincronizada com a agenda, os pedidos e o kanban de Montagem"
        icon={Hammer}
        iconVariant="amber"
      />

      {loading ? (
        <div className="text-center py-16 text-[13px] text-muted-foreground">Carregando…</div>
      ) : (
        <>
          <Section
            title="Pedidos para Entrega"
            icon={Truck}
            items={entregas}
            kind="entrega"
            color="emerald"
            onAgendar={(pid) => setOpenAgendar({ pedidoId: pid, tipo: "entrega" })}
          />
          <Section
            title="Pedidos para Montagem"
            icon={Hammer}
            items={montagens}
            kind="montagem"
            color="amber"
            onAgendar={(pid) => setOpenAgendar({ pedidoId: pid, tipo: "montagem" })}
          />
        </>
      )}

      {openAgendar && (
        <AgendaEventoDialog
          open
          onOpenChange={(o) => !o && setOpenAgendar(null)}
          pedidoId={openAgendar.pedidoId}
          defaultTipo={openAgendar.tipo}
          onCreated={() => {
            setOpenAgendar(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  items,
  kind,
  color,
  onAgendar,
}: {
  title: string;
  icon: any;
  items: Pedido[];
  kind: "entrega" | "montagem";
  color: "emerald" | "amber";
  onAgendar: (pedidoId: string) => void;
}) {
  const bg = color === "emerald" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-500 hover:bg-amber-600";
  return (
    <section className="surface-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <h2 className="font-playfair text-[18px] font-semibold uppercase tracking-wider">{title}</h2>
        <span className="ml-2 text-[11px] text-muted-foreground">({items.length})</span>
      </div>

      {items.length === 0 ? (
        <div className="text-[12px] text-muted-foreground py-6 text-center">Nada agendado.</div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => {
            const data = kind === "entrega" ? p.data_entrega : p.data_montagem;
            const resp = kind === "entrega" ? p.entregador_nome : p.montador_nome;
            const respLabel = kind === "entrega" ? "Entregador" : "Montador";
            return (
              <div
                key={p.id}
                className="grid grid-cols-12 gap-3 items-center px-3 py-2.5 rounded-md border border-border hover:bg-muted/30 transition-colors text-[13px]"
              >
                <div className="col-span-12 sm:col-span-2 font-mono text-[12px] font-semibold">
                  <Link to={`/pedidos/${p.id}`} className="hover:underline">
                    {p.codigo || "—"}
                  </Link>
                </div>
                <div className="col-span-12 sm:col-span-3 truncate">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider mr-1">Cliente:</span>
                  {p.cliente?.nome || "—"}
                </div>
                <div className="col-span-6 sm:col-span-3 truncate text-muted-foreground text-[12px]">
                  <CalendarDays className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                  {data ? fmtDate(data) : <span className="italic">Sem data</span>}
                  {resp && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <User className="w-3 h-3" /> {resp}
                    </span>
                  )}
                </div>
                <div className="col-span-6 sm:col-span-2 text-right font-mono text-[12px]">
                  {fmtBrl(Number(p.valor_total) || 0)}
                </div>
                <div className="col-span-12 sm:col-span-2 sm:text-right flex sm:justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => onAgendar(p.id)}
                    className={`text-white text-[11px] font-semibold ${bg}`}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {data ? "Reagendar" : `Agendar ${kind === "entrega" ? "Entrega" : "Montagem"}`}
                  </Button>
                  <Link
                    to={`/pedidos/${p.id}`}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-border text-[11px] hover:bg-muted/50"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                {p.endereco_entrega && (
                  <div className="col-span-12 text-[11px] text-muted-foreground -mt-1 flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {p.endereco_entrega}
                  </div>
                )}
                <div className="col-span-12 text-[10px] text-muted-foreground/70 -mt-1">
                  Estágio: {p.estagio_nome} · {respLabel}: {resp || "não atribuído"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
