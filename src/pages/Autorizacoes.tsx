import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, Check, X, Clock, Filter } from "lucide-react";
import { toast } from "sonner";

type AutTipo = "desconto_acima_limite" | "agenda_fora_horario" | "agenda_fora_dia" | "agenda_lead_time" | "outro";
type AutStatus = "pendente" | "aprovada" | "rejeitada" | "expirada";

interface Autorizacao {
  id: string;
  tipo: AutTipo;
  status: AutStatus;
  titulo: string;
  descricao: string | null;
  contexto: any;
  loja_id: string | null;
  pedido_id: string | null;
  orcamento_id: string | null;
  agenda_evento_id: string | null;
  valor_solicitado: number | null;
  limite_padrao: number | null;
  solicitante_id: string | null;
  solicitante_email: string | null;
  aprovador_email: string | null;
  decidido_em: string | null;
  decisao_observacao: string | null;
  created_at: string;
}

const TIPO_LABEL: Record<AutTipo, string> = {
  desconto_acima_limite: "Desconto acima do limite",
  agenda_fora_horario: "Agenda fora do horário",
  agenda_fora_dia: "Agenda em dia não permitido",
  agenda_lead_time: "Lead time abaixo do mínimo",
  outro: "Outro",
};

const STATUS_COR: Record<AutStatus, string> = {
  pendente: "bg-amber-500/15 text-amber-700 border-amber-300",
  aprovada: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  rejeitada: "bg-rose-500/15 text-rose-700 border-rose-300",
  expirada: "bg-slate-500/15 text-slate-600 border-slate-300",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function fmtBrl(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Autorizacoes() {
  const { user, role } = useAuth();
  const podeDecidir = role === "admin" || role === "diretor";

  const [items, setItems] = useState<Autorizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AutStatus | "todas">("pendente");
  const [filtroTipo, setFiltroTipo] = useState<string>("all");

  const [decisao, setDecisao] = useState<{ id: string; acao: "aprovada" | "rejeitada" } | null>(null);
  const [obs, setObs] = useState("");

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("autorizacoes" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const visiveis = useMemo(() => {
    return items.filter((i) => {
      if (tab !== "todas" && i.status !== tab) return false;
      if (filtroTipo !== "all" && i.tipo !== filtroTipo) return false;
      return true;
    });
  }, [items, tab, filtroTipo]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { pendente: 0, aprovada: 0, rejeitada: 0, expirada: 0, todas: items.length };
    items.forEach((i) => { c[i.status] = (c[i.status] || 0) + 1; });
    return c;
  }, [items]);

  const decidir = async () => {
    if (!decisao) return;
    if (!podeDecidir) { toast.error("Apenas administradores e diretores podem decidir."); return; }
    const { error } = await supabase
      .from("autorizacoes" as any)
      .update({
        status: decisao.acao,
        aprovador_id: user?.id,
        aprovador_email: user?.email,
        decidido_em: new Date().toISOString(),
        decisao_observacao: obs || null,
      })
      .eq("id", decisao.id);
    if (error) { toast.error(error.message); return; }
    toast.success(decisao.acao === "aprovada" ? "Solicitação aprovada" : "Solicitação rejeitada");
    setDecisao(null); setObs("");
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Autorizações"
        subtitle="Central de aprovações para ações fora do padrão (descontos, agenda, exceções)"
        icon={ShieldCheck}
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pendente">Pendentes ({counts.pendente})</TabsTrigger>
            <TabsTrigger value="aprovada">Aprovadas ({counts.aprovada})</TabsTrigger>
            <TabsTrigger value="rejeitada">Rejeitadas ({counts.rejeitada})</TabsTrigger>
            <TabsTrigger value="todas">Todas ({counts.todas})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 ml-auto">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[240px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TIPO_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : visiveis.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhuma solicitação nesta visão.</div>
        ) : (
          <div className="divide-y">
            {visiveis.map((a) => (
              <div key={a.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${STATUS_COR[a.status]} border`}>{a.status.toUpperCase()}</Badge>
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{TIPO_LABEL[a.tipo]}</span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {fmtDate(a.created_at)}
                      </span>
                    </div>
                    <div className="text-[15px] font-semibold mt-1">{a.titulo}</div>
                    {a.descricao && <div className="text-[13px] text-muted-foreground mt-0.5">{a.descricao}</div>}
                    <div className="text-[12px] text-muted-foreground mt-1">
                      Solicitado por: <span className="font-medium text-foreground">{a.solicitante_email || "—"}</span>
                      {a.aprovador_email && (
                        <> · Decidido por: <span className="font-medium text-foreground">{a.aprovador_email}</span></>
                      )}
                    </div>
                    {a.tipo === "desconto_acima_limite" && a.valor_solicitado != null && (
                      <div className="text-[12px] mt-1">
                        Solicitado: <strong>{a.valor_solicitado}%</strong>
                        {a.limite_padrao != null && <> · Limite do solicitante: <strong>{a.limite_padrao}%</strong></>}
                      </div>
                    )}
                    {a.contexto && Object.keys(a.contexto).length > 0 && (
                      <details className="text-[11px] text-muted-foreground mt-1">
                        <summary className="cursor-pointer">Contexto</summary>
                        <pre className="mt-1 bg-muted/40 p-2 rounded text-[10px] overflow-auto">{JSON.stringify(a.contexto, null, 2)}</pre>
                      </details>
                    )}
                    {a.decisao_observacao && (
                      <div className="text-[12px] mt-1 italic">Obs.: {a.decisao_observacao}</div>
                    )}
                  </div>
                  {a.status === "pendente" && podeDecidir && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => { setDecisao({ id: a.id, acao: "aprovada" }); setObs(""); }}>
                        <Check className="w-4 h-4 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setDecisao({ id: a.id, acao: "rejeitada" }); setObs(""); }}>
                        <X className="w-4 h-4 mr-1" /> Rejeitar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!decisao} onOpenChange={(v) => { if (!v) setDecisao(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisao?.acao === "aprovada" ? "Aprovar solicitação" : "Rejeitar solicitação"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-[12px] text-muted-foreground">Observação (opcional)</label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Justificativa da decisão…" rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisao(null)}>Cancelar</Button>
            <Button onClick={decidir}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
