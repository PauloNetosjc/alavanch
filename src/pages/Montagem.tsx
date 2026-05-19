import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Hammer, Truck, MapPin, CalendarDays, ExternalLink } from "lucide-react";
import { useLoja } from "@/contexts/LojaContext";

type Evento = {
  id: string;
  tipo: "entrega" | "montagem";
  data: string;
  hora_inicio: string;
  endereco: string | null;
  status: string;
  pedido: {
    id: string;
    codigo: string | null;
    valor_total: number | null;
    cliente: { nome: string | null; telefone: string | null } | null;
  } | null;
};

const fmtBrl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

export default function Montagem() {
  const { selectedLojaId } = useLoja();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("agenda_eventos" as any)
      .select("id, tipo, data, hora_inicio, endereco, status, pedido_id")
      .in("tipo", ["entrega", "montagem"])
      .neq("status", "cancelado")
      .not("pedido_id", "is", null)
      .order("data", { ascending: true });
    if (selectedLojaId) q = q.eq("loja_id", selectedLojaId);
    const { data: evs } = await q;
    const list = (evs as any[]) || [];
    const pedidoIds = Array.from(new Set(list.map((e: any) => e.pedido_id).filter(Boolean)));
    let pedidoMap = new Map<string, any>();
    if (pedidoIds.length) {
      const { data: peds } = await supabase
        .from("pedidos")
        .select("id, codigo, valor_total, cliente:clientes(nome, telefone)")
        .in("id", pedidoIds);
      (peds || []).forEach((p: any) => pedidoMap.set(p.id, p));
    }
    setEventos(list.map((e: any) => ({ ...e, pedido: pedidoMap.get(e.pedido_id) || null })).filter((e: any) => e.pedido) as Evento[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedLojaId]);

  const entregas = useMemo(() => eventos.filter((e) => e.tipo === "entrega"), [eventos]);
  const montagens = useMemo(() => eventos.filter((e) => e.tipo === "montagem"), [eventos]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda Logística"
        subtitle="Entregas e montagens agendadas a partir dos pedidos"
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
            actionLabel="ENTREGAR"
            color="emerald"
          />
          <Section
            title="Pedidos para Montagem"
            icon={Hammer}
            items={montagens}
            actionLabel="MONTAR"
            color="amber"
          />
        </>
      )}
    </div>
  );
}

function Section({
  title, icon: Icon, items, actionLabel, color,
}: {
  title: string;
  icon: any;
  items: Evento[];
  actionLabel: string;
  color: "emerald" | "amber";
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
          {items.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-12 gap-3 items-center px-3 py-2.5 rounded-md border border-border hover:bg-muted/30 transition-colors text-[13px]"
            >
              <div className="col-span-12 sm:col-span-2 font-mono text-[12px] font-semibold">
                {e.pedido?.codigo || "—"}
              </div>
              <div className="col-span-12 sm:col-span-3 truncate">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider mr-1">Cliente:</span>
                {e.pedido?.cliente?.nome || "—"}
              </div>
              <div className="col-span-6 sm:col-span-3 truncate text-muted-foreground">
                <CalendarDays className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                {fmtDate(e.data)} {e.hora_inicio?.slice(0, 5)}
              </div>
              <div className="col-span-6 sm:col-span-2 text-right font-mono text-[12px]">
                {fmtBrl(Number(e.pedido?.valor_total) || 0)}
              </div>
              <div className="col-span-12 sm:col-span-2 sm:text-right">
                <Link
                  to={`/pedidos/${e.pedido?.id}`}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded text-white text-[11px] font-semibold ${bg}`}
                >
                  {actionLabel} <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              {e.endereco && (
                <div className="col-span-12 text-[11px] text-muted-foreground -mt-1 flex items-start gap-1">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {e.endereco}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
