import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Play, ArrowRight, Zap, KanbanSquare } from "lucide-react";
import ConfigurarKanbansDialog from "@/components/ConfigurarKanbansDialog";
import { usePermissions } from "@/hooks/usePermissions";

const PIPELINES = ["operacional","pos_venda","revisao","montagem","fabrica","leads"];
const EVENTOS = [
  { value: "agenda_criada", label: "Agenda criada" },
  { value: "medicao_agendada", label: "Medição técnica agendada" },
  { value: "revisao_agendada", label: "Revisão final agendada" },
  { value: "checklist_concluido", label: "Checklist concluído" },
  { value: "assinatura_concluida", label: "Assinatura concluída" },
  { value: "manual", label: "Disparo manual" },
];
const TIPOS_AGENDA = ["medicao_tecnica","revisao_final","entrega","montagem","vistoria","reuniao","outro"];

export default function SimuladorAutomacoes() {
  const [pipeline, setPipeline] = useState("revisao");
  const [estagios, setEstagios] = useState<any[]>([]);
  const [origemId, setOrigemId] = useState<string>("");
  const [evento, setEvento] = useState("medicao_agendada");
  const [tipoEventoAgenda, setTipoEventoAgenda] = useState("medicao_tecnica");
  const [templateId, setTemplateId] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [dataRef, setDataRef] = useState<string>("");
  const [resultado, setResultado] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [openConfig, setOpenConfig] = useState(false);
  const { isAdmin, can } = usePermissions();
  const podeConfigurarKanbans = isAdmin || can("sistema_configurar_kanbans", "edit");

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("pipeline_estagios").select("id,nome,ordem,sla_dias_uteis").eq("pipeline", pipeline).order("ordem");
      setEstagios(data ?? []);
      setOrigemId(data?.[0]?.id ?? "");
    })();
  }, [pipeline]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("checklist_templates").select("id,nome").eq("ativo", true).order("nome");
      setTemplates(data ?? []);
    })();
  }, []);

  const simular = async () => {
    if (!origemId) return;
    setLoading(true);
    const contexto: any = {};
    if (["medicao_agendada","revisao_agendada","agenda_criada"].includes(evento)) {
      contexto.tipo_evento = tipoEventoAgenda;
    }
    if (evento === "checklist_concluido" && templateId) {
      contexto.template_id = templateId;
    }
    if (dataRef) contexto.data_referencia = dataRef;

    const { data, error } = await (supabase as any).rpc("pipeline_simular", {
      _estagio_origem_id: origemId,
      _evento: evento,
      _contexto: contexto,
    });
    setLoading(false);
    if (error) { setResultado({ error: error.message }); return; }
    setResultado(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader icon={Zap} title="Simulador de automações" subtitle="Teste qual regra dispara para um cenário e veja o destino e prazo calculados." />
        {podeConfigurarKanbans && (
          <Button variant="outline" onClick={() => setOpenConfig(true)}>
            <KanbanSquare className="w-4 h-4" /> Configurar Kanbans
          </Button>
        )}
      </div>
      <ConfigurarKanbansDialog open={openConfig} onOpenChange={setOpenConfig} />


      <Card>
        <CardHeader><CardTitle className="text-base">Cenário</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Kanban</Label>
            <Select value={pipeline} onValueChange={setPipeline}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PIPELINES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estágio atual do card</Label>
            <Select value={origemId} onValueChange={setOrigemId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {estagios.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome} {e.sla_dias_uteis ? `(SLA ${e.sla_dias_uteis} du)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Evento</Label>
            <Select value={evento} onValueChange={setEvento}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EVENTOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de referência (opcional)</Label>
            <Input type="date" value={dataRef} onChange={(e) => setDataRef(e.target.value)} />
          </div>
          {["medicao_agendada","revisao_agendada","agenda_criada"].includes(evento) && (
            <div>
              <Label>Tipo de evento da agenda</Label>
              <Select value={tipoEventoAgenda} onValueChange={setTipoEventoAgenda}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_AGENDA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {evento === "checklist_concluido" && (
            <div>
              <Label>Template do checklist</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="(qualquer)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">(qualquer)</SelectItem>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="md:col-span-2">
            <Button onClick={simular} disabled={loading || !origemId}>
              <Play className="w-4 h-4 mr-1" /> {loading ? "Simulando…" : "Simular"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader><CardTitle className="text-base">Resultado</CardTitle></CardHeader>
          <CardContent>
            {resultado.error ? (
              <div className="text-destructive text-sm">{resultado.error}</div>
            ) : resultado.matched ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{resultado.origem}</Badge>
                  <ArrowRight className="w-4 h-4" />
                  <Badge>{resultado.destino}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><div className="text-muted-foreground text-xs">Prazo calculado</div><div className="font-medium">{resultado.prazo ?? "—"}</div></div>
                  <div><div className="text-muted-foreground text-xs">SLA destino</div><div className="font-medium">{resultado.destino_sla ?? "—"} du</div></div>
                  <div><div className="text-muted-foreground text-xs">Ajuste da regra</div><div className="font-medium">{resultado.ajustar_prazo_dias ?? "—"} du</div></div>
                  <div><div className="text-muted-foreground text-xs">Regra ID</div><div className="font-mono text-[10px]">{resultado.regra_id}</div></div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Nenhuma regra ativa corresponde a este cenário em "{resultado.origem}". O card permaneceria onde está.</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
