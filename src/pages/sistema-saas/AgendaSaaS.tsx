import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CalendarClock, CheckCircle2, XCircle, Repeat, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { STATUS_EVENTO, TIPOS_EVENTO, eventoStatusClass, type EventoAgenda } from "@/lib/sistema-saas/crmSaas";
import { AgendaEventoSaaSDialog } from "@/components/sistema-saas/AgendaEventoSaaSDialog";

export default function AgendaSaaS() {
  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [oportunidades, setOportunidades] = useState<Record<string, string>>({});
  const [bases, setBases] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editEvento, setEditEvento] = useState<EventoAgenda | null>(null);

  const today = new Date(); today.setHours(0,0,0,0);
  const in30 = new Date(today.getTime() + 30 * 86400000);

  const [filtroInicio, setFiltroInicio] = useState<string>(toInput(today));
  const [filtroFim, setFiltroFim] = useState<string>(toInput(in30));
  const [filtroTipo, setFiltroTipo] = useState<string>("_all");
  const [filtroStatus, setFiltroStatus] = useState<string>("_all");
  const [busca, setBusca] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("saas_agenda_eventos" as any).select("*").order("data_inicio", { ascending: true });
    setEventos((data as any[]) ?? []);
    const { data: ops } = await supabase.from("saas_crm_oportunidades" as any).select("id,nome_empresa");
    setOportunidades(Object.fromEntries(((ops as any[]) ?? []).map(o => [o.id, o.nome_empresa])));
    const { data: bs } = await supabase.from("bases_clientes" as any).select("id,nome");
    setBases(Object.fromEntries(((bs as any[]) ?? []).map(b => [b.id, b.nome])));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const ini = filtroInicio ? new Date(filtroInicio + "T00:00:00") : null;
    const fim = filtroFim ? new Date(filtroFim + "T23:59:59") : null;
    return eventos.filter(e => {
      const di = new Date(e.data_inicio);
      if (ini && di < ini) return false;
      if (fim && di > fim) return false;
      if (filtroTipo !== "_all" && e.tipo !== filtroTipo) return false;
      if (filtroStatus !== "_all" && e.status !== filtroStatus) return false;
      if (q && !`${e.titulo} ${e.local ?? ""} ${e.participantes ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [eventos, filtroInicio, filtroFim, filtroTipo, filtroStatus, busca]);

  const grupos = useMemo(() => {
    const m = new Map<string, EventoAgenda[]>();
    for (const e of filtrados) {
      const d = new Date(e.data_inicio); const k = d.toISOString().slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return Array.from(m.entries());
  }, [filtrados]);

  async function atualizar(ev: EventoAgenda, status: string) {
    const { error } = await supabase.from("saas_agenda_eventos" as any).update({ status }).eq("id", ev.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Evento atualizado"); load();
  }
  async function excluir(ev: EventoAgenda) {
    if (!confirm("Excluir este evento?")) return;
    const { error } = await supabase.from("saas_agenda_eventos" as any).delete().eq("id", ev.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarClock className="h-6 w-6" /> Agenda SaaS</h1>
          <p className="text-sm text-muted-foreground mt-1">Agenda comercial, implantação e relacionamento da empresa SaaS.</p>
        </div>
        <Button onClick={() => { setEditEvento(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Novo evento</Button>
      </div>

      <Card className="p-3 flex flex-wrap gap-2 items-center">
        <Input className="h-8 w-40" type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)} />
        <Input className="h-8 w-40" type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)} />
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos os tipos</SelectItem>
            {TIPOS_EVENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos os status</SelectItem>
            {STATUS_EVENTO.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="h-8 w-56" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
        <div className="text-xs text-muted-foreground ml-auto">{filtrados.length} evento(s)</div>
      </Card>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : grupos.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum evento no período.</Card>
      ) : (
        <div className="space-y-4">
          {grupos.map(([dia, evs]) => (
            <div key={dia}>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                {new Date(dia + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </div>
              <div className="space-y-2">
                {evs.map(ev => (
                  <Card key={ev.id} className="p-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium">{ev.titulo}</div>
                        <Badge variant="outline" className="text-[10px]">{TIPOS_EVENTO.find(t => t.value === ev.tipo)?.label ?? ev.tipo}</Badge>
                        <Badge className={eventoStatusClass(ev.status)}>{ev.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(ev.data_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {ev.data_fim ? ` - ${new Date(ev.data_fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                        {ev.local ? ` · ${ev.local}` : ""}
                      </div>
                      {(ev.oportunidade_id || ev.base_cliente_id) && (
                        <div className="text-xs mt-1">
                          {ev.oportunidade_id && <span className="mr-2">Oportunidade: {oportunidades[ev.oportunidade_id] ?? "—"}</span>}
                          {ev.base_cliente_id && <span>Base: {bases[ev.base_cliente_id] ?? "—"}</span>}
                        </div>
                      )}
                      {ev.link_reuniao && (
                        <a href={ev.link_reuniao} target="_blank" rel="noreferrer" className="text-xs text-blue-700 hover:underline">{ev.link_reuniao}</a>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" title="Realizado" onClick={() => atualizar(ev, "realizado")}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" title="Cancelar" onClick={() => atualizar(ev, "cancelado")}><XCircle className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" title="Remarcar" onClick={() => atualizar(ev, "remarcado")}><Repeat className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" title="Editar" onClick={() => { setEditEvento(ev); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" title="Excluir" onClick={() => excluir(ev)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AgendaEventoSaaSDialog open={open} onOpenChange={setOpen} evento={editEvento} onSaved={load} />
    </div>
  );
}

function toInput(d: Date) { return d.toISOString().slice(0, 10); }
