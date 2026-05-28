import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { BRL } from "@/lib/financeiro";
import {
  FileSignature, FileText, Box, Ruler, Pencil, ClipboardCheck, FileCheck2,
  FilePlus2, Factory, Truck, Wrench, ShieldCheck, Workflow, AlertTriangle,
  ChevronRight, Search, ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ---------- Tipos ----------
export type EtapaKey =
  | "contrato_assinado"
  | "projeto_inicial"
  | "projeto_vendido"
  | "medicao_tecnica"
  | "preparo_projeto_revisao"
  | "revisao_loja"
  | "projeto_revisado"
  | "pdf_projeto_final"
  | "projeto_para_producao"
  | "fabrica_lote"
  | "entrega"
  | "montagem"
  | "vistoria_finalizacao";

type StatusPrazo = "vencido" | "hoje" | "pre_alerta" | "no_prazo" | "sem_prazo";

type TarefaLite = {
  id: string;
  pedido_id: string;
  status: string;
  prazo: string | null;
  responsavel_id: string | null;
  created_at: string;
  modelo_nome: string | null;
};

type DocLite = { pedido_id: string; categoria_projeto: string | null; created_at: string };

type PedidoLite = {
  id: string;
  codigo: string;
  status: string | null;
  valor_total: number | null;
  loja_id: string | null;
  cliente_id: string | null;
  created_at: string;
  is_adendo: boolean | null;
  is_complemento: boolean | null;
  status_fabrica: string | null;
  data_assinatura_pdf_final: string | null;
  data_medicao_tecnica: string | null;
  data_entrega: string | null;
  data_montagem: string | null;
  data_vistoria: string | null;
  data_limite_finalizacao: string | null;
  data_limite_entrega: string | null;
  data_limite_inicio_montagem: string | null;
  cliente_nome?: string | null;
  loja_nome?: string | null;
};

type PedidoComEtapa = PedidoLite & {
  etapa: EtapaKey;
  prazo: string | null;
  responsavel_nome: string | null;
  data_inicio_etapa: string | null;
  statusPrazo: StatusPrazo;
  diasRestantes: number | null;
};

// ---------- Etapas ----------
const ETAPAS: { key: EtapaKey; label: string; icon: any }[] = [
  { key: "contrato_assinado", label: "Contrato Assinado", icon: FileSignature },
  { key: "projeto_inicial", label: "Projeto Inicial", icon: FileText },
  { key: "projeto_vendido", label: "Projeto Vendido / 3D", icon: Box },
  { key: "medicao_tecnica", label: "Medição Técnica", icon: Ruler },
  { key: "preparo_projeto_revisao", label: "Preparo Revisão", icon: Pencil },
  { key: "revisao_loja", label: "Revisão Loja", icon: ClipboardCheck },
  { key: "projeto_revisado", label: "Projeto Revisado", icon: FileCheck2 },
  { key: "pdf_projeto_final", label: "PDF Projeto Final", icon: FilePlus2 },
  { key: "projeto_para_producao", label: "Projeto p/ Produção", icon: FilePlus2 },
  { key: "fabrica_lote", label: "Fábrica / Lote", icon: Factory },
  { key: "entrega", label: "Entrega", icon: Truck },
  { key: "montagem", label: "Montagem", icon: Wrench },
  { key: "vistoria_finalizacao", label: "Vistoria / Finalização", icon: ShieldCheck },
];

// Mapeia nome do modelo da tarefa nativa -> chave técnica
const MODELO_PARA_ETAPA: Record<string, EtapaKey> = {
  "acompanhar assinatura do contrato": "contrato_assinado",
  "enviar projeto inicial para o cliente": "projeto_inicial",
  "subir arquivo 3d vendido": "projeto_vendido",
  "fazer medição técnica": "medicao_tecnica",
  "preparo projeto revisão": "preparo_projeto_revisao",
  "revisão loja": "revisao_loja",
  "subir projeto revisado": "projeto_revisado",
  "preparo e envio de pdf projeto final": "pdf_projeto_final",
  "implantação fábrica": "fabrica_lote",
};

// ---------- Cálculo de prazo (dias corridos) ----------
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function diffDays(iso: string | null): number | null {
  if (!iso) return null;
  const d = startOfDay(new Date(iso));
  const t = startOfDay(new Date());
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}
export function calcularStatusPrazo(prazo: string | null): { status: StatusPrazo; dias: number | null } {
  const dias = diffDays(prazo);
  if (dias === null) return { status: "sem_prazo", dias: null };
  if (dias < 0) return { status: "vencido", dias };
  if (dias === 0) return { status: "hoje", dias };
  if (dias <= 5) return { status: "pre_alerta", dias };
  return { status: "no_prazo", dias };
}

// ---------- Decide etapa atual do pedido ----------
export function getEtapaAtualPedido(
  p: PedidoLite,
  tarefasPendentes: TarefaLite[],
  docs: DocLite[],
): EtapaKey | null {
  if ((p.status || "").toLowerCase() === "concluido") return null;
  if ((p.status || "").toLowerCase() === "cancelado") return null;

  const pendentesPorEtapa = new Map<EtapaKey, TarefaLite>();
  for (const t of tarefasPendentes) {
    const key = MODELO_PARA_ETAPA[(t.modelo_nome || "").toLowerCase().trim()];
    if (key && !pendentesPorEtapa.has(key)) pendentesPorEtapa.set(key, t);
  }
  const docCats = new Set(docs.map((d) => d.categoria_projeto));

  // Vistoria
  if (p.data_vistoria) return "vistoria_finalizacao";
  // Montagem
  if (p.data_montagem) return "montagem";
  // Entrega
  if (p.data_entrega) return "entrega";
  // Fábrica/Lote
  if (p.status_fabrica === "liberado_para_lote" || pendentesPorEtapa.has("fabrica_lote")) return "fabrica_lote";
  // PDF Final (pendência manda)
  if (pendentesPorEtapa.has("pdf_projeto_final")) return "pdf_projeto_final";
  // Projeto para Produção
  if (docCats.has("projeto_para_producao") && !p.data_assinatura_pdf_final) return "projeto_para_producao";
  // Projeto revisado
  if (docCats.has("projeto_revisado") && !pendentesPorEtapa.has("pdf_projeto_final")) return "projeto_revisado";
  // Revisão loja
  if (pendentesPorEtapa.has("revisao_loja")) return "revisao_loja";
  // Preparo projeto revisão
  if (pendentesPorEtapa.has("preparo_projeto_revisao")) return "preparo_projeto_revisao";
  // Medição técnica
  if (pendentesPorEtapa.has("medicao_tecnica")) return "medicao_tecnica";
  // Projeto vendido / 3D
  if (pendentesPorEtapa.has("projeto_vendido") || !docCats.has("projeto_vendido")) {
    if (pendentesPorEtapa.has("projeto_vendido")) return "projeto_vendido";
  }
  // Projeto inicial
  if (pendentesPorEtapa.has("projeto_inicial")) return "projeto_inicial";
  // Contrato
  if (pendentesPorEtapa.has("contrato_assinado")) return "contrato_assinado";

  // Default: se há doc projeto_vendido mas sem nada pendente, considera projeto_vendido (aguardando próxima)
  if (docCats.has("projeto_vendido")) return "projeto_vendido";
  return "contrato_assinado";
}

// ---------- Componente ----------
export default function WorkflowOperacionalDashboard() {
  const navigate = useNavigate();
  const { selectedLojaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<PedidoLite[]>([]);
  const [tarefas, setTarefas] = useState<TarefaLite[]>([]);
  const [docs, setDocs] = useState<DocLite[]>([]);
  const [profileNomes, setProfileNomes] = useState<Record<string, string>>({});

  const [etapaSelecionada, setEtapaSelecionada] = useState<EtapaKey | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<"todos" | StatusPrazo>("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      let qPed = supabase
        .from("pedidos")
        .select(
          "id, codigo, status, valor_total, loja_id, cliente_id, created_at, is_adendo, is_complemento, status_fabrica, data_assinatura_pdf_final, data_medicao_tecnica, data_entrega, data_montagem, data_vistoria, data_limite_finalizacao, data_limite_entrega, data_limite_inicio_montagem, cliente:clientes(nome), loja:lojas(nome)",
        );
      if (selectedLojaId) qPed = qPed.eq("loja_id", selectedLojaId);
      const { data: pedsRaw } = await qPed;
      const peds: PedidoLite[] = ((pedsRaw as any[]) || [])
        .filter((p) => !p.is_adendo && (p.status || "").toLowerCase() !== "cancelado" && (p.status || "").toLowerCase() !== "concluido")
        .map((p) => ({
          ...p,
          cliente_nome: p.cliente?.nome ?? null,
          loja_nome: p.loja?.nome ?? null,
        }));

      const pedIds = peds.map((p) => p.id);
      if (pedIds.length === 0) {
        setPedidos([]); setTarefas([]); setDocs([]); setLoading(false); return;
      }

      const [{ data: tRaw }, { data: dRaw }] = await Promise.all([
        supabase
          .from("tarefas_pedido")
          .select("id, pedido_id, status, prazo, responsavel_id, created_at, modelo:tarefas_nativas_modelos(nome)")
          .in("pedido_id", pedIds)
          .in("status", ["pendente", "em_andamento", "aguardando_aprovacao", "bloqueada"]),
        supabase
          .from("pedido_documentos")
          .select("pedido_id, categoria_projeto, created_at")
          .in("pedido_id", pedIds)
          .eq("ativo", true)
          .not("categoria_projeto", "is", null),
      ]);
      const tList: TarefaLite[] = ((tRaw as any[]) || []).map((t) => ({
        id: t.id, pedido_id: t.pedido_id, status: t.status, prazo: t.prazo,
        responsavel_id: t.responsavel_id, created_at: t.created_at,
        modelo_nome: t.modelo?.nome ?? null,
      }));
      const responsavelIds = Array.from(new Set(tList.map((t) => t.responsavel_id).filter(Boolean))) as string[];
      let nomes: Record<string, string> = {};
      if (responsavelIds.length) {
        const { data: profs } = await supabase
          .from("profiles").select("id, nome_completo").in("id", responsavelIds);
        (profs || []).forEach((p: any) => { nomes[p.id] = p.nome_completo || "—"; });
      }

      setPedidos(peds);
      setTarefas(tList);
      setDocs(((dRaw as any[]) || []) as DocLite[]);
      setProfileNomes(nomes);
      setLoading(false);
    })();
  }, [selectedLojaId]);

  // ---------- Agrupar pedidos por etapa ----------
  const pedidosComEtapa = useMemo<PedidoComEtapa[]>(() => {
    const tarefasPorPed = new Map<string, TarefaLite[]>();
    tarefas.forEach((t) => {
      const arr = tarefasPorPed.get(t.pedido_id) || [];
      arr.push(t); tarefasPorPed.set(t.pedido_id, arr);
    });
    const docsPorPed = new Map<string, DocLite[]>();
    docs.forEach((d) => {
      const arr = docsPorPed.get(d.pedido_id) || [];
      arr.push(d); docsPorPed.set(d.pedido_id, arr);
    });
    const out: PedidoComEtapa[] = [];
    for (const p of pedidos) {
      const tp = tarefasPorPed.get(p.id) || [];
      const dp = docsPorPed.get(p.id) || [];
      const etapa = getEtapaAtualPedido(p, tp, dp);
      if (!etapa) continue;
      // Tarefa associada à etapa (se houver)
      const tarefaDaEtapa = tp.find((t) => MODELO_PARA_ETAPA[(t.modelo_nome || "").toLowerCase().trim()] === etapa);
      let prazo: string | null = tarefaDaEtapa?.prazo ?? null;
      let dataInicio: string | null = tarefaDaEtapa?.created_at ?? null;
      // Para etapas de pós-produção, usar campos do pedido
      if (!prazo) {
        if (etapa === "entrega") prazo = p.data_entrega;
        else if (etapa === "montagem") prazo = p.data_montagem;
        else if (etapa === "vistoria_finalizacao") prazo = p.data_vistoria || p.data_limite_finalizacao;
        else if (etapa === "medicao_tecnica") prazo = p.data_medicao_tecnica;
      }
      const { status, dias } = calcularStatusPrazo(prazo);
      out.push({
        ...p,
        etapa,
        prazo,
        responsavel_nome: tarefaDaEtapa?.responsavel_id ? profileNomes[tarefaDaEtapa.responsavel_id] || null : null,
        data_inicio_etapa: dataInicio,
        statusPrazo: status,
        diasRestantes: dias,
      });
    }
    return out;
  }, [pedidos, tarefas, docs, profileNomes]);

  // Resumos por etapa
  const resumos = useMemo(() => {
    const map = new Map<EtapaKey, { qtd: number; valor: number; vencidos: number; preAlerta: number; hoje: number }>();
    ETAPAS.forEach((e) => map.set(e.key, { qtd: 0, valor: 0, vencidos: 0, preAlerta: 0, hoje: 0 }));
    pedidosComEtapa.forEach((p) => {
      const r = map.get(p.etapa)!;
      r.qtd += 1;
      r.valor += Number(p.valor_total || 0);
      if (p.statusPrazo === "vencido") r.vencidos += 1;
      else if (p.statusPrazo === "hoje") r.hoje += 1;
      else if (p.statusPrazo === "pre_alerta") r.preAlerta += 1;
    });
    return map;
  }, [pedidosComEtapa]);

  const resumoGeral = useMemo(() => {
    const totalValor = pedidosComEtapa.reduce((s, p) => s + Number(p.valor_total || 0), 0);
    const vencidos = pedidosComEtapa.filter((p) => p.statusPrazo === "vencido");
    let maiorGargalo: { etapa: EtapaKey; qtd: number } | null = null;
    resumos.forEach((v, k) => { if (!maiorGargalo || v.qtd > maiorGargalo.qtd) maiorGargalo = { etapa: k, qtd: v.qtd }; });
    return {
      totalAtivos: pedidosComEtapa.length,
      totalValor,
      totalVencidos: vencidos.length,
      valorVencido: vencidos.reduce((s, p) => s + Number(p.valor_total || 0), 0),
      maiorGargalo,
    };
  }, [pedidosComEtapa, resumos]);

  // Lista expandida da etapa selecionada
  const listaExpandida = useMemo(() => {
    if (!etapaSelecionada) return [];
    return pedidosComEtapa
      .filter((p) => p.etapa === etapaSelecionada)
      .filter((p) => {
        if (statusFiltro !== "todos" && p.statusPrazo !== statusFiltro) return false;
        const b = busca.trim().toLowerCase();
        if (!b) return true;
        return (p.cliente_nome || "").toLowerCase().includes(b) || (p.codigo || "").toLowerCase().includes(b);
      })
      .sort((a, b) => {
        const order = { vencido: 0, hoje: 1, pre_alerta: 2, no_prazo: 3, sem_prazo: 4 };
        return order[a.statusPrazo] - order[b.statusPrazo];
      });
  }, [etapaSelecionada, pedidosComEtapa, statusFiltro, busca]);

  const etapaLabel = (k: EtapaKey) => ETAPAS.find((e) => e.key === k)?.label || k;

  if (loading) {
    return (
      <div className="surface-card p-5">
        <div className="text-sm text-muted-foreground">Carregando workflow operacional…</div>
      </div>
    );
  }

  return (
    <div className="surface-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Workflow className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display">Workflow Operacional dos Pedidos</h2>
            <p className="text-xs text-muted-foreground">
              Acompanhe contratos por etapa, valores em produção e prazos críticos.
            </p>
          </div>
        </div>
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <ResumoBox label="Pedidos ativos" value={String(resumoGeral.totalAtivos)} />
        <ResumoBox label="Valor em andamento" value={BRL(resumoGeral.totalValor)} highlight />
        <ResumoBox label="Vencidos" value={String(resumoGeral.totalVencidos)} tone="danger" />
        <ResumoBox label="Valor em atraso" value={BRL(resumoGeral.valorVencido)} tone="danger" />
        <ResumoBox
          label="Maior gargalo"
          value={resumoGeral.maiorGargalo && resumoGeral.maiorGargalo.qtd > 0 ? etapaLabel(resumoGeral.maiorGargalo.etapa) : "—"}
          hint={resumoGeral.maiorGargalo && resumoGeral.maiorGargalo.qtd > 0 ? `${resumoGeral.maiorGargalo.qtd} pedidos` : undefined}
        />
      </div>

      {/* Esteira de etapas */}
      <div className="relative">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {ETAPAS.map((e, idx) => {
            const r = resumos.get(e.key)!;
            const Icon = e.icon;
            const active = etapaSelecionada === e.key;
            const risco =
              r.vencidos > 0 ? "danger" :
              r.hoje > 0 ? "warning" :
              r.preAlerta > 0 ? "alert" :
              r.qtd > 0 ? "ok" : "muted";
            return (
              <div key={e.key} className="flex items-stretch shrink-0">
                <button
                  onClick={() => setEtapaSelecionada(active ? null : e.key)}
                  className={`min-w-[180px] text-left rounded-xl p-3 border transition-all ${
                    active ? "border-primary shadow-md bg-primary/5" : "border-border hover:border-foreground/30 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ICON_BG[risco]}`}>
                      <Icon className={`w-4 h-4 ${ICON_FG[risco]}`} />
                    </div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${DOT_CHIP[risco]}`}>
                      {RISCO_LABEL[risco]}
                    </span>
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium leading-tight">
                    {e.label}
                  </div>
                  <div className="text-2xl font-display mt-1 leading-none">{r.qtd}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{BRL(r.valor)}</div>
                  {(r.vencidos > 0 || r.preAlerta > 0 || r.hoje > 0) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.vencidos > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                          {r.vencidos} vencido{r.vencidos > 1 ? "s" : ""}
                        </span>
                      )}
                      {r.hoje > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                          {r.hoje} hoje
                        </span>
                      )}
                      {r.preAlerta > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                          {r.preAlerta} alerta
                        </span>
                      )}
                    </div>
                  )}
                </button>
                {idx < ETAPAS.length - 1 && (
                  <div className="flex items-center px-1 text-muted-foreground/40">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Área expandida */}
      {etapaSelecionada && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Pedidos em {etapaLabel(etapaSelecionada)}</h3>
              <span className="text-xs text-muted-foreground">({listaExpandida.length})</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou contrato"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-7 h-8 text-xs w-56"
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/30">
                {[
                  { v: "todos", l: "Todos" },
                  { v: "vencido", l: "Vencidos" },
                  { v: "hoje", l: "Hoje" },
                  { v: "pre_alerta", l: "Pré-alerta" },
                  { v: "no_prazo", l: "No prazo" },
                ].map((s) => (
                  <button
                    key={s.v}
                    onClick={() => setStatusFiltro(s.v as any)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition ${
                      statusFiltro === s.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.l}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEtapaSelecionada(null)}>Fechar</Button>
            </div>
          </div>

          {listaExpandida.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum pedido nesta etapa.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3">Cliente</th>
                    <th className="text-left py-2 pr-3">PV</th>
                    <th className="text-right py-2 pr-3">Valor</th>
                    <th className="text-left py-2 pr-3">Início etapa</th>
                    <th className="text-left py-2 pr-3">Prazo</th>
                    <th className="text-left py-2 pr-3">Status</th>
                    <th className="text-left py-2 pr-3">Responsável</th>
                    <th className="text-left py-2 pr-3">Loja</th>
                    <th className="text-right py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {listaExpandida.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="py-2 pr-3 font-medium">{p.cliente_nome || "—"}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{p.codigo}</td>
                      <td className="py-2 pr-3 text-right">{BRL(Number(p.valor_total || 0))}</td>
                      <td className="py-2 pr-3 text-xs">{fmtDateBR(p.data_inicio_etapa)}</td>
                      <td className="py-2 pr-3 text-xs">{fmtDateBR(p.prazo)}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge status={p.statusPrazo} dias={p.diasRestantes} />
                      </td>
                      <td className="py-2 pr-3 text-xs">{p.responsavel_nome || "—"}</td>
                      <td className="py-2 pr-3 text-xs">{p.loja_nome || "—"}</td>
                      <td className="py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/pedidos/${p.id}`)}>
                          Abrir <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Subcomponentes ----------
function ResumoBox({ label, value, hint, tone, highlight }: { label: string; value: string; hint?: string; tone?: "danger"; highlight?: boolean }) {
  const color = tone === "danger" ? "text-red-700" : highlight ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-lg border border-border p-3 bg-muted/20">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className={`text-lg font-display mt-1 leading-tight ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function StatusBadge({ status, dias }: { status: StatusPrazo; dias: number | null }) {
  const cfg: Record<StatusPrazo, { label: string; cls: string }> = {
    vencido: { label: dias != null ? `Vencido há ${Math.abs(dias)}d` : "Vencido", cls: "bg-red-100 text-red-700" },
    hoje: { label: "Vence hoje", cls: "bg-orange-100 text-orange-700" },
    pre_alerta: { label: dias != null ? `${dias}d restantes` : "Pré-alerta", cls: "bg-amber-100 text-amber-700" },
    no_prazo: { label: dias != null ? `${dias}d restantes` : "No prazo", cls: "bg-emerald-100 text-emerald-700" },
    sem_prazo: { label: "Sem prazo", cls: "bg-muted text-muted-foreground" },
  };
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded ${c.cls}`}>
      {status === "vencido" && <AlertTriangle className="w-3 h-3" />}
      {c.label}
    </span>
  );
}

function fmtDateBR(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const ICON_BG: Record<string, string> = {
  danger: "bg-red-100", warning: "bg-orange-100", alert: "bg-amber-100", ok: "bg-emerald-100", muted: "bg-muted",
};
const ICON_FG: Record<string, string> = {
  danger: "text-red-700", warning: "text-orange-700", alert: "text-amber-700", ok: "text-emerald-700", muted: "text-muted-foreground",
};
const DOT_CHIP: Record<string, string> = {
  danger: "bg-red-100 text-red-700",
  warning: "bg-orange-100 text-orange-700",
  alert: "bg-amber-100 text-amber-700",
  ok: "bg-emerald-100 text-emerald-700",
  muted: "bg-muted text-muted-foreground",
};
const RISCO_LABEL: Record<string, string> = {
  danger: "Crítico", warning: "Hoje", alert: "Alerta", ok: "Ok", muted: "—",
};

export function agruparPedidosPorEtapa(pedidos: PedidoComEtapa[]) {
  const m = new Map<EtapaKey, PedidoComEtapa[]>();
  pedidos.forEach((p) => {
    const arr = m.get(p.etapa) || []; arr.push(p); m.set(p.etapa, arr);
  });
  return m;
}
