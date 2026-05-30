import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Target } from "lucide-react";
import { ETAPAS_CRM, etapaClass, etapaLabel, fmtBRL, type Oportunidade } from "@/lib/sistema-saas/crmSaas";
import { CrmOportunidadeDialog } from "@/components/sistema-saas/CrmOportunidadeDialog";
import { CrmOportunidadeDetalheSheet } from "@/components/sistema-saas/CrmOportunidadeDetalheSheet";

type Sistema = { id: string; nome: string };

export default function CrmSaaS() {
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoOpen, setNovoOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtroSistema, setFiltroSistema] = useState<string>("_all");
  const [busca, setBusca] = useState("");
  const [eventosCount, setEventosCount] = useState({ apresentacoes: 0 });

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("saas_crm_oportunidades" as any).select("*").order("created_at", { ascending: false });
    setOportunidades((data as any[]) ?? []);
    const { data: s } = await supabase.from("sistemas_saas" as any).select("id,nome").eq("ativo", true).order("ordem");
    setSistemas((s as any[]) ?? []);
    const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0,0,0,0);
    const { count } = await supabase.from("saas_agenda_eventos" as any)
      .select("id", { count: "exact", head: true })
      .eq("tipo", "apresentacao")
      .gte("data_inicio", startMonth.toISOString());
    setEventosCount({ apresentacoes: count ?? 0 });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return oportunidades.filter(o => {
      if (filtroSistema !== "_all" && o.sistema_saas_id !== filtroSistema) return false;
      if (q && !`${o.nome_empresa} ${o.responsavel_nome ?? ""} ${o.cnpj ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [oportunidades, filtroSistema, busca]);

  const sistemasMap = useMemo(() => Object.fromEntries(sistemas.map(s => [s.id, s.nome])), [sistemas]);

  const abertas = filtradas.filter(o => o.status === "aberto");
  const valorMensalPot = abertas.reduce((s, o) => s + (Number(o.valor_mensal_proposto) || 0), 0);
  const implantacaoPot = abertas.reduce((s, o) => s + (Number(o.valor_implantacao_proposto) || 0), 0);
  const propostasEnviadas = abertas.filter(o => o.etapa === "proposta_enviada").length;
  const negociacoes = abertas.filter(o => o.etapa === "negociacao").length;

  const nowMonth = new Date(); nowMonth.setDate(1); nowMonth.setHours(0,0,0,0);
  const ganhasMes = filtradas.filter(o => o.status === "ganho" && o.data_fechamento && new Date(o.data_fechamento) >= nowMonth).length;
  const perdidasMes = filtradas.filter(o => o.status === "perdido" && o.data_fechamento && new Date(o.data_fechamento) >= nowMonth).length;

  const porEtapa = useMemo(() => {
    const m = new Map<string, Oportunidade[]>();
    for (const e of ETAPAS_CRM) m.set(e.value, []);
    for (const o of filtradas) {
      if (!m.has(o.etapa)) m.set(o.etapa, []);
      m.get(o.etapa)!.push(o);
    }
    return m;
  }, [filtradas]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="h-6 w-6" /> CRM SaaS</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle comercial da empresa SaaS para venda de sistemas e conversão em bases.</p>
        </div>
        <Button onClick={() => setNovoOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova oportunidade</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Oportunidades abertas" value={abertas.length} />
        <Kpi label="Valor mensal potencial" value={fmtBRL(valorMensalPot)} />
        <Kpi label="Implantação potencial" value={fmtBRL(implantacaoPot)} />
        <Kpi label="Apresentações no mês" value={eventosCount.apresentacoes} />
        <Kpi label="Propostas enviadas" value={propostasEnviadas} />
        <Kpi label="Em negociação" value={negociacoes} />
        <Kpi label="Ganhas no mês" value={ganhasMes} className="text-emerald-700" />
        <Kpi label="Perdidas no mês" value={perdidasMes} className="text-red-700" />
      </div>

      <Card className="p-3 flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 w-64" placeholder="Buscar empresa, responsável, CNPJ" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <Select value={filtroSistema} onValueChange={setFiltroSistema}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos os sistemas</SelectItem>
            {sistemas.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">{filtradas.length} oportunidade(s)</div>
      </Card>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-max pb-3">
            {ETAPAS_CRM.map(et => {
              const items = porEtapa.get(et.value) ?? [];
              return (
                <div key={et.value} className="w-72 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={et.className}>{et.label}</Badge>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {items.map(o => (
                      <Card key={o.id} className="p-3 cursor-pointer hover:shadow-sm transition" onClick={() => setSelectedId(o.id)}>
                        <div className="font-medium text-sm truncate">{o.nome_empresa}</div>
                        {o.responsavel_nome && <div className="text-xs text-muted-foreground truncate">{o.responsavel_nome}</div>}
                        {o.sistema_saas_id && <div className="text-xs mt-1">{sistemasMap[o.sistema_saas_id]}</div>}
                        {(o.plano_interesse || o.valor_mensal_proposto) && (
                          <div className="text-xs text-muted-foreground">
                            {o.plano_interesse ? `${o.plano_interesse} · ` : ""}
                            {fmtBRL(o.valor_mensal_proposto)}/mês
                          </div>
                        )}
                        {Number(o.valor_implantacao_proposto) > 0 && (
                          <div className="text-xs text-muted-foreground">Implantação: {fmtBRL(o.valor_implantacao_proposto)}</div>
                        )}
                        {o.data_prevista_fechamento && (
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                            Prev: {new Date(o.data_prevista_fechamento).toLocaleDateString("pt-BR")}
                          </div>
                        )}
                      </Card>
                    ))}
                    {items.length === 0 && <div className="text-[11px] text-muted-foreground italic px-1">vazio</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CrmOportunidadeDialog open={novoOpen} onOpenChange={setNovoOpen} onSaved={load} />
      <CrmOportunidadeDetalheSheet
        open={!!selectedId}
        onOpenChange={(o) => { if (!o) setSelectedId(null); }}
        oportunidadeId={selectedId}
        onChange={load}
      />
    </div>
  );
}

function Kpi({ label, value, className }: { label: string; value: any; className?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${className ?? ""}`}>{value}</div>
    </Card>
  );
}
