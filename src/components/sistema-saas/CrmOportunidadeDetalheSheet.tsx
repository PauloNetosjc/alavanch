import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarPlus, CheckCircle2, XCircle, Repeat, Trash2, Pencil, PackageCheck } from "lucide-react";
import { ETAPAS_CRM, STATUS_CRM, etapaClass, etapaLabel, eventoStatusClass, fmtBRL, registrarHistoricoCrm, type EventoAgenda, type Oportunidade } from "@/lib/sistema-saas/crmSaas";
import { CrmOportunidadeDialog } from "./CrmOportunidadeDialog";
import { AgendaEventoSaaSDialog } from "./AgendaEventoSaaSDialog";
import { ConverterOportunidadeDialog } from "./ConverterOportunidadeDialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  oportunidadeId: string | null;
  onChange?: () => void;
}

export function CrmOportunidadeDetalheSheet({ open, onOpenChange, oportunidadeId, onChange }: Props) {
  const [op, setOp] = useState<Oportunidade | null>(null);
  const [sistemaNome, setSistemaNome] = useState("");
  const [historico, setHistorico] = useState<any[]>([]);
  const [eventos, setEventos] = useState<EventoAgenda[]>([]);
  const [obs, setObs] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [eventoOpen, setEventoOpen] = useState(false);
  const [converterOpen, setConverterOpen] = useState(false);
  const [editEvento, setEditEvento] = useState<EventoAgenda | null>(null);
  const [propVI, setPropVI] = useState<number>(0);
  const [propVM, setPropVM] = useState<number>(0);

  async function load() {
    if (!oportunidadeId) return;
    const { data: o } = await supabase.from("saas_crm_oportunidades" as any).select("*").eq("id", oportunidadeId).single();
    setOp((o as any) ?? null);
    if (o) {
      setPropVI(Number((o as any).valor_implantacao_proposto) || 0);
      setPropVM(Number((o as any).valor_mensal_proposto) || 0);
      if ((o as any).sistema_saas_id) {
        const { data: s } = await supabase.from("sistemas_saas" as any).select("nome").eq("id", (o as any).sistema_saas_id).single();
        setSistemaNome((s as any)?.nome ?? "");
      } else setSistemaNome("");
    }
    const { data: h } = await supabase.from("saas_crm_historico" as any).select("*").eq("oportunidade_id", oportunidadeId).order("created_at", { ascending: false });
    setHistorico((h as any[]) ?? []);
    const { data: e } = await supabase.from("saas_agenda_eventos" as any).select("*").eq("oportunidade_id", oportunidadeId).order("data_inicio", { ascending: false });
    setEventos((e as any[]) ?? []);
  }

  useEffect(() => { if (open && oportunidadeId) load(); }, [open, oportunidadeId]);

  async function mudarEtapa(novaEtapa: string) {
    if (!op) return;
    const updates: any = { etapa: novaEtapa };
    if (novaEtapa === "fechamento_ganho") { updates.status = "ganho"; updates.data_fechamento = new Date().toISOString().slice(0, 10); }
    if (novaEtapa === "fechamento_perdido") { updates.status = "perdido"; updates.data_fechamento = new Date().toISOString().slice(0, 10); }
    const { error } = await supabase.from("saas_crm_oportunidades" as any).update(updates).eq("id", op.id);
    if (error) { toast.error(error.message); return; }
    await registrarHistoricoCrm({ oportunidade_id: op.id, tipo_evento: "etapa_alterada", descricao: `Etapa alterada para ${etapaLabel(novaEtapa)}`, etapa_anterior: op.etapa, etapa_nova: novaEtapa });
    toast.success("Etapa atualizada");
    load(); onChange?.();
  }

  async function addObs() {
    if (!op || !obs.trim()) return;
    await registrarHistoricoCrm({ oportunidade_id: op.id, tipo_evento: "observacao", descricao: obs });
    setObs(""); load();
  }

  async function registrarContato(tipo: string) {
    if (!op) return;
    await registrarHistoricoCrm({ oportunidade_id: op.id, tipo_evento: tipo, descricao: `Registrado: ${tipo}` });
    toast.success("Registrado");
    load();
  }

  async function salvarProposta() {
    if (!op) return;
    const { error } = await supabase.from("saas_crm_oportunidades" as any).update({
      valor_implantacao_proposto: propVI, valor_mensal_proposto: propVM,
    }).eq("id", op.id);
    if (error) { toast.error(error.message); return; }
    await registrarHistoricoCrm({ oportunidade_id: op.id, tipo_evento: "proposta_atualizada", descricao: `Valores: implantação ${fmtBRL(propVI)} / mensal ${fmtBRL(propVM)}` });
    toast.success("Proposta atualizada"); load(); onChange?.();
  }

  async function marcarPropostaEnviada() {
    if (!op) return;
    await mudarEtapa("proposta_enviada");
    await registrarHistoricoCrm({ oportunidade_id: op.id, tipo_evento: "proposta_enviada", descricao: "Proposta marcada como enviada" });
    load();
  }

  async function atualizarEvento(ev: EventoAgenda, status: string) {
    const { error } = await supabase.from("saas_agenda_eventos" as any).update({ status }).eq("id", ev.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Evento atualizado"); load();
  }

  async function excluirEvento(ev: EventoAgenda) {
    if (!confirm("Excluir este evento?")) return;
    const { error } = await supabase.from("saas_agenda_eventos" as any).delete().eq("id", ev.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  const podeConverter = op && (op.etapa === "fechamento_ganho" || op.status === "ganho") && !op.base_cliente_id;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {op?.nome_empresa ?? "..."}
              {op && <Badge className={etapaClass(op.etapa)}>{etapaLabel(op.etapa)}</Badge>}
            </SheetTitle>
          </SheetHeader>

          {op && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Select value={op.etapa} onValueChange={mudarEtapa}>
                <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ETAPAS_CRM.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => { setEditEvento(null); setEventoOpen(true); }}>
                <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Agendar reunião
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
              {podeConverter && (
                <Button size="sm" onClick={() => setConverterOpen(true)}>
                  <PackageCheck className="h-3.5 w-3.5 mr-1" /> Converter em Base
                </Button>
              )}
            </div>
          )}

          <Tabs defaultValue="dados" className="mt-4">
            <TabsList>
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="atividades">Atividades</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
              <TabsTrigger value="proposta">Proposta</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-2 text-sm">
              {op && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Info l="Razão social" v={op.razao_social} />
                  <Info l="CNPJ" v={op.cnpj} />
                  <Info l="Responsável" v={op.responsavel_nome} />
                  <Info l="E-mail" v={op.email} />
                  <Info l="Telefone" v={op.telefone} />
                  <Info l="Origem" v={op.origem} />
                  <Info l="Sistema" v={sistemaNome} />
                  <Info l="Plano" v={op.plano_interesse} />
                  <Info l="Valor implantação" v={fmtBRL(op.valor_implantacao_proposto)} />
                  <Info l="Valor mensal" v={fmtBRL(op.valor_mensal_proposto)} />
                  <Info l="Lojas previstas" v={op.lojas_previstas} />
                  <Info l="Usuários previstos" v={op.usuarios_previstos} />
                  <Info l="Data prevista" v={op.data_prevista_fechamento} />
                  <Info l="Status" v={STATUS_CRM.find(s => s.value === op.status)?.label} />
                  {op.observacoes && <div className="col-span-2"><Info l="Observações" v={op.observacoes} /></div>}
                </div>
              )}
            </TabsContent>

            <TabsContent value="atividades" className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => registrarContato("ligacao")}>Ligação</Button>
                <Button size="sm" variant="outline" onClick={() => registrarContato("whatsapp")}>WhatsApp</Button>
                <Button size="sm" variant="outline" onClick={() => registrarContato("email")}>E-mail enviado</Button>
                <Button size="sm" variant="outline" onClick={() => registrarContato("contato")}>Contato</Button>
              </div>
              <div>
                <Label className="text-xs">Adicionar observação</Label>
                <Textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} />
                <Button size="sm" className="mt-2" onClick={addObs} disabled={!obs.trim()}>Adicionar</Button>
              </div>
            </TabsContent>

            <TabsContent value="agenda" className="space-y-2">
              <Button size="sm" onClick={() => { setEditEvento(null); setEventoOpen(true); }}>
                <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Novo evento
              </Button>
              {eventos.length === 0 && <div className="text-xs text-muted-foreground py-4">Nenhum evento vinculado.</div>}
              <div className="space-y-2">
                {eventos.map(ev => (
                  <div key={ev.id} className="border rounded-md p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{ev.titulo}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(ev.data_inicio).toLocaleString("pt-BR")}
                          {ev.local ? ` · ${ev.local}` : ""}
                        </div>
                      </div>
                      <Badge className={eventoStatusClass(ev.status)}>{ev.status}</Badge>
                    </div>
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="ghost" onClick={() => atualizarEvento(ev, "realizado")}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => atualizarEvento(ev, "cancelado")}><XCircle className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => atualizarEvento(ev, "remarcado")}><Repeat className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditEvento(ev); setEventoOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => excluirEvento(ev)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="proposta" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Valor de implantação</Label>
                  <Input type="number" step="0.01" value={propVI} onChange={e => setPropVI(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Valor mensal</Label>
                  <Input type="number" step="0.01" value={propVM} onChange={e => setPropVM(Number(e.target.value))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={salvarProposta}>Salvar proposta</Button>
                <Button size="sm" variant="outline" onClick={marcarPropostaEnviada}>Marcar como enviada</Button>
              </div>
            </TabsContent>

            <TabsContent value="historico" className="space-y-2">
              {historico.length === 0 && <div className="text-xs text-muted-foreground py-4">Sem histórico.</div>}
              {historico.map((h: any) => (
                <div key={h.id} className="border-l-2 border-zinc-200 pl-3 py-1 text-sm">
                  <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")} · {h.tipo_evento}</div>
                  <div>{h.descricao ?? "—"}</div>
                  {h.etapa_anterior && h.etapa_nova && (
                    <div className="text-xs text-muted-foreground">{etapaLabel(h.etapa_anterior)} → {etapaLabel(h.etapa_nova)}</div>
                  )}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <CrmOportunidadeDialog open={editOpen} onOpenChange={setEditOpen} oportunidade={op} onSaved={() => { load(); onChange?.(); }} />
      <AgendaEventoSaaSDialog
        open={eventoOpen}
        onOpenChange={setEventoOpen}
        evento={editEvento}
        oportunidadeId={op?.id ?? null}
        onSaved={async () => {
          if (op && (op.etapa === "lead_novo" || op.etapa === "qualificacao")) {
            await mudarEtapa("apresentacao_agendada");
          } else { load(); }
        }}
      />
      {op && (
        <ConverterOportunidadeDialog
          open={converterOpen}
          onOpenChange={setConverterOpen}
          oportunidade={op}
          onConverted={() => { load(); onChange?.(); }}
        />
      )}
    </>
  );
}

function Info({ l, v }: { l: string; v: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{l}</div>
      <div className="text-sm">{v ?? "—"}</div>
    </div>
  );
}
