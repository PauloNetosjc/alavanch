import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLoja } from "@/contexts/LojaContext";
import { CalendarDays, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { AgendaEventoDialog, AgendaTipo } from "@/components/agenda/AgendaEventoDialog";
import { EventoDetalheDialog } from "@/components/agenda/EventoDetalheDialog";

const TIPO_LABEL: Record<string, string> = {
  apresentacao_comercial: "Apresentação",
  medicao_tecnica: "Medição",
  revisao_final: "Revisão",
  entrega: "Entrega",
  montagem: "Montagem",
  assistencia_tecnica: "Assistência",
  tarefa_interna: "Tarefa",
};
const TIPO_COR: Record<string, string> = {
  apresentacao_comercial: "bg-pink-500/15 text-pink-700 border-pink-300",
  medicao_tecnica: "bg-blue-500/15 text-blue-700 border-blue-300",
  revisao_final: "bg-purple-500/15 text-purple-700 border-purple-300",
  entrega: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  montagem: "bg-amber-500/15 text-amber-700 border-amber-300",
  assistencia_tecnica: "bg-rose-500/15 text-rose-700 border-rose-300",
  tarefa_interna: "bg-slate-500/15 text-slate-700 border-slate-300",
};

interface Evento {
  id: string;
  tipo: AgendaTipo;
  titulo: string;
  data: string;
  hora_inicio: string;
  hora_fim: string | null;
  endereco: string | null;
  responsavel_id: string;
  status: string;
  pedido_id: string | null;
  loja_id: string | null;
  excecao: boolean;
}

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfWeek(d: Date)  { const x = new Date(d); x.setDate(d.getDate() - d.getDay()); return x; }
function fmtKey(d: Date)       { return d.toISOString().slice(0, 10); }

export default function Agenda() {
  const { user, role } = useAuth();
  const { lojas } = useLoja();
  const isAdminOuDiretor = role === "admin" || role === "diretor";
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [responsaveis, setResponsaveis] = useState<{ user_id: string; nome_completo: string | null }[]>([]);
  const [filtroResp, setFiltroResp] = useState<string>("all");
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [filtroLoja, setFiltroLoja] = useState<string>("all"); // só admin/diretor
  const [openNovo, setOpenNovo] = useState(false);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();

  // intervalo visível
  const range = useMemo(() => {
    if (view === "month") {
      const ini = startOfMonth(cursor); const fim = endOfMonth(cursor);
      return { ini, fim };
    }
    const ini = startOfWeek(cursor); const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
    return { ini, fim };
  }, [cursor, view]);

  const reload = async () => {
    let q = supabase.from("agenda_eventos" as any).select("*")
      .gte("data", fmtKey(range.ini)).lte("data", fmtKey(range.fim))
      .order("data").order("hora_inicio");
    if (filtroResp !== "all") q = q.eq("responsavel_id", filtroResp);
    if (filtroTipo !== "all") q = q.eq("tipo", filtroTipo);
    if (isAdminOuDiretor && filtroLoja !== "all") {
      if (filtroLoja === "__global__") q = q.is("loja_id", null);
      else q = q.eq("loja_id", filtroLoja);
    }
    const { data } = await q;
    setEventos((data as any) || []);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("user_id, nome_completo").order("nome_completo");
      setResponsaveis((data as any) || []);
    })();
  }, []);
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [range.ini.getTime(), range.fim.getTime(), filtroResp, filtroTipo, filtroLoja]);

  // agrupa por dia
  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    eventos.forEach((e) => {
      const arr = m.get(e.data) || []; arr.push(e); m.set(e.data, arr);
    });
    return m;
  }, [eventos]);

  const monthGrid = useMemo(() => {
    const ini = startOfMonth(cursor);
    const start = new Date(ini); start.setDate(ini.getDate() - ini.getDay()); // domingo anterior
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i); cells.push(d);
    }
    return cells;
  }, [cursor]);

  const weekDays = useMemo(() => {
    const ini = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(ini); d.setDate(ini.getDate() + i); return d; });
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const concluir = async (id: string) => {
    await supabase.from("agenda_eventos" as any).update({ status: "concluido", concluido_em: new Date().toISOString() }).eq("id", id);
    reload();
  };
  const cancelar = async (id: string) => {
    await supabase.from("agenda_eventos" as any).update({ status: "cancelado", cancelado_em: new Date().toISOString() }).eq("id", id);
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Agenda Operacional"
        subtitle="Medições, revisões, entregas, montagens e tarefas internas"
        icon={CalendarDays}
        actions={
          <Button onClick={() => { setDefaultDate(undefined); setOpenNovo(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Novo evento
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex border rounded-md overflow-hidden">
          <Button variant="ghost" size="sm" onClick={() => {
            const d = new Date(cursor);
            view === "month" ? d.setMonth(d.getMonth() - 1) : d.setDate(d.getDate() - 7);
            setCursor(d);
          }}><ChevronLeft className="w-4 h-4" /></Button>
          <div className="px-3 py-1.5 text-[13px] capitalize min-w-[160px] text-center">{monthLabel}</div>
          <Button variant="ghost" size="sm" onClick={() => {
            const d = new Date(cursor);
            view === "month" ? d.setMonth(d.getMonth() + 1) : d.setDate(d.getDate() + 7);
            setCursor(d);
          }}><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
        <div className="flex border rounded-md overflow-hidden ml-auto">
          <Button variant={view === "month" ? "default" : "ghost"} size="sm" onClick={() => setView("month")}>Mês</Button>
          <Button variant={view === "week" ? "default" : "ghost"} size="sm" onClick={() => setView("week")}>Semana</Button>
        </div>
        <Select value={filtroResp} onValueChange={setFiltroResp}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {user && <SelectItem value={user.id}>Apenas eu</SelectItem>}
            {responsaveis.map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>{p.nome_completo || p.user_id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        {isAdminOuDiretor && (
          <Select value={filtroLoja} onValueChange={setFiltroLoja}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as lojas</SelectItem>
              <SelectItem value="__global__">Eventos gerais</SelectItem>
              {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {view === "month" ? (
        <div className="surface-card overflow-hidden">
          <div className="grid grid-cols-7 text-[10px] uppercase tracking-wider text-muted-foreground border-b">
            {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
              <div key={d} className="px-2 py-2 text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthGrid.map((d) => {
              const key = fmtKey(d);
              const sameMonth = d.getMonth() === cursor.getMonth();
              const isToday = key === fmtKey(new Date());
              const evs = porDia.get(key) || [];
              return (
                <div key={key} className={`min-h-[110px] border-b border-r p-1.5 ${sameMonth ? "bg-card" : "bg-muted/30"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>{d.getDate()}</span>
                    <button onClick={() => { setDefaultDate(key); setOpenNovo(true); }} className="opacity-30 hover:opacity-100" title="Adicionar">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {evs.slice(0, 3).map((e) => (
                      <div key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${TIPO_COR[e.tipo]}`} title={e.titulo}>
                        {e.hora_inicio?.slice(0, 5)} {e.titulo}
                      </div>
                    ))}
                    {evs.length > 3 && <div className="text-[10px] text-muted-foreground">+{evs.length - 3} mais</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Visão semanal estilo Google Agenda: grade horária com slots de 1h
        (() => {
          const HOUR_START = 7;   // 07:00
          const HOUR_END = 22;    // 22:00
          const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
          const SLOT_PX = 56;     // altura de uma hora
          const todayKey = fmtKey(new Date());

          const parseHM = (h: string) => {
            const [hh, mm] = (h || "00:00").split(":").map(Number);
            return hh + (mm || 0) / 60;
          };
          const eventTop = (h: string) => (parseHM(h) - HOUR_START) * SLOT_PX;
          const eventHeight = (ini: string, fim: string | null) => {
            const a = parseHM(ini);
            const b = fim ? parseHM(fim) : a + 1; // default 1h
            return Math.max(24, (b - a) * SLOT_PX);
          };

          return (
            <div className="surface-card overflow-hidden">
              {/* cabeçalho dos dias */}
              <div className="grid border-b sticky top-0 bg-card z-10" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
                <div className="border-r" />
                {weekDays.map((d) => {
                  const isToday = fmtKey(d) === todayKey;
                  return (
                    <div key={fmtKey(d)} className={`p-2 text-center border-r ${isToday ? "bg-primary/5" : ""}`}>
                      <div className="text-[10px] uppercase text-muted-foreground">
                        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.getDay()]}
                      </div>
                      <div className={`text-[18px] font-semibold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>

              {/* corpo: coluna de horas + 7 colunas de dias */}
              <div className="overflow-auto max-h-[calc(100vh-300px)]">
                <div className="grid relative" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
                  {/* coluna de horários */}
                  <div className="border-r">
                    {HOURS.map((h) => (
                      <div key={h} style={{ height: SLOT_PX }} className="text-[10px] text-muted-foreground text-right pr-1.5 -mt-1.5">
                        {String(h).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>

                  {/* colunas dos dias */}
                  {weekDays.map((d) => {
                    const key = fmtKey(d);
                    const evs = porDia.get(key) || [];
                    const isToday = key === todayKey;
                    return (
                      <div key={key} className={`border-r relative ${isToday ? "bg-primary/[0.03]" : ""}`}>
                        {/* linhas de hora */}
                        {HOURS.map((h) => (
                          <button
                            key={h}
                            onClick={() => {
                              setDefaultDate(key);
                              setOpenNovo(true);
                            }}
                            className="block w-full border-b border-dashed border-border/60 hover:bg-muted/40 transition"
                            style={{ height: SLOT_PX }}
                            title={`Adicionar evento às ${String(h).padStart(2, "0")}:00`}
                          />
                        ))}

                        {/* eventos posicionados absolutamente */}
                        {evs.map((e) => {
                          const top = eventTop(e.hora_inicio);
                          const height = eventHeight(e.hora_inicio, e.hora_fim);
                          if (top < 0 || top > (HOUR_END - HOUR_START) * SLOT_PX) return null;
                          return (
                            <div
                              key={e.id}
                              className={`absolute left-1 right-1 rounded border px-1.5 py-1 overflow-hidden text-[11px] shadow-sm ${TIPO_COR[e.tipo]} ${e.status === "cancelado" ? "opacity-50 line-through" : ""}`}
                              style={{ top, height }}
                              title={`${e.titulo} (${e.hora_inicio?.slice(0,5)}${e.hora_fim ? `–${e.hora_fim.slice(0,5)}` : ""})`}
                            >
                              <div className="font-semibold truncate">
                                {e.hora_inicio?.slice(0,5)} {TIPO_LABEL[e.tipo]}
                              </div>
                              <div className="truncate">{e.titulo}</div>
                              {height > 60 && e.endereco && (
                                <div className="truncate opacity-80">{e.endereco}</div>
                              )}
                              {e.excecao && (
                                <div className="text-[9px] uppercase tracking-wide font-bold mt-0.5">Exceção</div>
                              )}
                              {e.status === "agendado" && height > 70 && (
                                <div className="flex gap-2 mt-0.5">
                                  <button onClick={(ev) => { ev.stopPropagation(); concluir(e.id); }} className="text-[10px] underline">Concluir</button>
                                  <button onClick={(ev) => { ev.stopPropagation(); cancelar(e.id); }} className="text-[10px] underline opacity-70">Cancelar</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()
      )}

      <AgendaEventoDialog
        open={openNovo}
        onOpenChange={setOpenNovo}
        defaultDate={defaultDate}
        onCreated={reload}
      />
    </div>
  );
}
