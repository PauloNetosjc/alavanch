import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { useModulosLoja } from "@/hooks/useModulosLoja";
import { BRL } from "@/lib/financeiro";
import {
  FileSignature, FileText, Ruler, Pencil, ClipboardCheck,
  FilePlus2, Factory, Truck, Wrench, ShieldCheck, Workflow, AlertTriangle,
  Search, ArrowRight, FileSpreadsheet, Printer, CheckCircle2, Sparkles, FileX2, CalendarRange,
  PackageCheck,
} from "lucide-react";
import MedicoesPrevistasDialog from "./MedicoesPrevistasDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

// ---------- Tipos ----------
export type EtapaKey =
  | "contrato_nao_assinado"
  | "contrato_assinado"
  | "projeto_inicial"
  | "projeto_vendido"
  | "medicao_tecnica"
  | "venda_futura"
  | "preparo_projeto_revisao"
  | "revisao_loja"
  | "projeto_revisado"
  | "pdf_projeto_final"
  | "projeto_para_producao"
  | "fabrica_lote"
  | "fabrica_liberado_para_lote"
  | "fabrica_em_producao"
  | "entrega"
  | "montagem"
  | "vistoria_finalizacao"
  | "vistoria"
  | "pos_montagem"
  | "concluido"
  | "finalizado";

type StatusPrazo = "vencido" | "hoje" | "pre_alerta" | "no_prazo" | "sem_prazo";

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
  etapa_atual: string | null;
  cliente_nome?: string | null;
  loja_nome?: string | null;
  responsavel_nome?: string | null;
  prazo?: string | null;
  statusPrazo?: StatusPrazo;
  diasRestantes?: number | null;
  // Assinatura (quando aplicável)
  contrato_enviado_em?: string | null;
  contrato_created_at?: string | null;
  prazo_limite_assinatura?: string | null;
};

// ---------- Etapas visuais (workflow) ----------
type GroupKey =
  | "contrato_assinado"
  | "projeto_inicial"
  | "medicao_tecnica"
  | "preparo_projeto_revisao"
  | "revisao_loja"
  | "pdf_projeto_final"
  | "fabrica_lote"
  | "entrega"
  | "montagem"
  | "vistoria_finalizacao"
  | "pos_montagem";

const WORKFLOW_STAGE_GROUPS_ALL: { visualKey: GroupKey; label: string; icon: any; internalKeys: EtapaKey[] }[] = [
  { visualKey: "contrato_assinado", label: "Contrato Assinado", icon: FileSignature, internalKeys: ["contrato_assinado"] },
  { visualKey: "projeto_inicial", label: "Projeto Inicial", icon: FileText, internalKeys: ["projeto_inicial", "projeto_vendido"] },
  { visualKey: "medicao_tecnica", label: "Medição Técnica", icon: Ruler, internalKeys: ["medicao_tecnica"] },
  { visualKey: "preparo_projeto_revisao", label: "Preparo Revisão", icon: Pencil, internalKeys: ["preparo_projeto_revisao"] },
  { visualKey: "revisao_loja", label: "Revisão Loja", icon: ClipboardCheck, internalKeys: ["revisao_loja"] },
  { visualKey: "pdf_projeto_final", label: "PDF Projeto Final", icon: FilePlus2, internalKeys: ["projeto_revisado", "pdf_projeto_final", "projeto_para_producao"] },
  { visualKey: "fabrica_lote", label: "Fábrica / Lote", icon: Factory, internalKeys: ["fabrica_lote", "fabrica_liberado_para_lote", "fabrica_em_producao"] },
  { visualKey: "entrega", label: "Entrega", icon: Truck, internalKeys: ["entrega"] },
  { visualKey: "montagem", label: "Montagem", icon: Wrench, internalKeys: ["montagem"] },
  { visualKey: "vistoria_finalizacao", label: "Vistoria / Finalização", icon: ShieldCheck, internalKeys: ["vistoria_finalizacao", "vistoria"] },
  { visualKey: "pos_montagem", label: "Pós-Montagem", icon: PackageCheck, internalKeys: ["pos_montagem"] },
];

const ETAPA_TO_GROUP: Record<string, GroupKey> = (() => {
  const m: Record<string, GroupKey> = {};
  WORKFLOW_STAGE_GROUPS.forEach((g) => g.internalKeys.forEach((k) => { m[k] = g.visualKey; }));
  return m;
})();

const ETAPA_LABEL: Record<string, string> = {
  contrato_nao_assinado: "Contrato não assinado",
  contrato_assinado: "Contrato Assinado",
  projeto_inicial: "Projeto Inicial",
  projeto_vendido: "Projeto Vendido / 3D",
  medicao_tecnica: "Medição Técnica",
  venda_futura: "Venda Futura",
  preparo_projeto_revisao: "Preparo Revisão",
  revisao_loja: "Revisão Loja",
  projeto_revisado: "Projeto Revisado",
  pdf_projeto_final: "PDF Projeto Final",
  projeto_para_producao: "Projeto p/ Produção",
  fabrica_lote: "Fábrica / Lote",
  fabrica_liberado_para_lote: "Fábrica / Lote",
  fabrica_em_producao: "Fábrica / Lote",
  entrega: "Entrega",
  montagem: "Montagem",
  vistoria_finalizacao: "Vistoria / Finalização",
  vistoria: "Vistoria / Finalização",
  pos_montagem: "Pós-Montagem",
  concluido: "Concluído",
  finalizado: "Concluído",
};

// ---------- Cálculo de prazo ----------
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function diffDays(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = startOfDay(new Date(iso));
  const t = startOfDay(new Date());
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}
export function calcularStatusPrazo(prazo: string | null | undefined): { status: StatusPrazo; dias: number | null } {
  const dias = diffDays(prazo || null);
  if (dias === null) return { status: "sem_prazo", dias: null };
  if (dias < 0) return { status: "vencido", dias };
  if (dias === 0) return { status: "hoje", dias };
  if (dias <= 5) return { status: "pre_alerta", dias };
  return { status: "no_prazo", dias };
}

// Adiciona N dias úteis a uma data ISO (seg-sex)
function addBusinessDays(isoOrDate: string | Date | null, n: number): string | null {
  if (!isoOrDate) return null;
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return null;
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString();
}

// ---------- Componente ----------
type TopCardKey = "concluido" | "venda_futura";
type ContratoFiltro = "todos" | "assinados" | "nao_assinados";

export default function WorkflowOperacionalDashboard() {
  const navigate = useNavigate();
  const { selectedLojaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<PedidoLite[]>([]);

  const [grupoSelecionado, setGrupoSelecionado] = useState<GroupKey | null>(null);
  const [topCardSelecionado, setTopCardSelecionado] = useState<TopCardKey | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<"todos" | StatusPrazo>("todos");
  const [contratoFiltro, setContratoFiltro] = useState<ContratoFiltro>("assinados");
  const [busca, setBusca] = useState("");
  const [openMedicoes, setOpenMedicoes] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let qPed = supabase
        .from("pedidos")
        .select(
          "id, codigo, status, valor_total, loja_id, cliente_id, created_at, is_adendo, is_complemento, status_fabrica, etapa_atual, data_assinatura_pdf_final, data_medicao_tecnica, data_entrega, data_montagem, data_vistoria, data_limite_finalizacao, data_limite_entrega, data_limite_inicio_montagem, projetista_id, orcamento_id, cliente:clientes(nome), loja:lojas(nome)",
        );
      if (selectedLojaId) qPed = qPed.eq("loja_id", selectedLojaId);
      const { data: pedsRaw } = await qPed;
      const pedsAll: any[] = ((pedsRaw as any[]) || [])
        .filter((p) => !p.is_adendo && (p.status || "").toLowerCase() !== "cancelado");

      const orcamentoIds = Array.from(new Set(pedsAll.map((p) => p.orcamento_id).filter(Boolean)));
      const respIds = Array.from(new Set(pedsAll.map((p) => p.projetista_id).filter(Boolean)));

      const [{ data: contratosRaw }, { data: profs }] = await Promise.all([
        orcamentoIds.length
          ? supabase
              .from("contratos")
              .select("orcamento_id, status, assinado_em, enviado_em, created_at")
              .in("orcamento_id", orcamentoIds)
          : Promise.resolve({ data: [] as any[] }),
        respIds.length
          ? supabase.from("profiles").select("id, nome_completo").in("id", respIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const nomes: Record<string, string> = {};
      ((profs as any[]) || []).forEach((p: any) => { nomes[p.id] = p.nome_completo || "—"; });

      // Para cada orcamento_id, pegar o contrato mais relevante (não cancelado/recusado)
      const contratoPorOrc = new Map<string, any>();
      ((contratosRaw as any[]) || []).forEach((c) => {
        if (["cancelado", "recusado", "expirado"].includes(c.status)) return;
        const prev = contratoPorOrc.get(c.orcamento_id);
        if (!prev) contratoPorOrc.set(c.orcamento_id, c);
        else if (c.assinado_em && !prev.assinado_em) contratoPorOrc.set(c.orcamento_id, c);
      });

      const peds: PedidoLite[] = pedsAll.map((p) => {
        const c = p.orcamento_id ? contratoPorOrc.get(p.orcamento_id) : null;
        const enviado = c?.enviado_em || c?.created_at || null;
        const prazoLimite = !c?.assinado_em ? addBusinessDays(enviado, 2) : null;
        // Prazo da etapa: usa data específica conforme etapa_atual
        let prazo: string | null = null;
        const etapa = (p.etapa_atual || "").toString();
        if (etapa === "entrega") prazo = p.data_entrega;
        else if (etapa === "montagem") prazo = p.data_montagem;
        else if (etapa === "vistoria_finalizacao" || etapa === "vistoria") prazo = p.data_vistoria || p.data_limite_finalizacao;
        else if (etapa === "medicao_tecnica") prazo = p.data_medicao_tecnica;
        else if (etapa === "contrato_nao_assinado") prazo = prazoLimite;
        const { status, dias } = calcularStatusPrazo(prazo);
        return {
          ...p,
          cliente_nome: p.cliente?.nome ?? null,
          loja_nome: p.loja?.nome ?? null,
          responsavel_nome: p.projetista_id ? nomes[p.projetista_id] || null : null,
          contrato_enviado_em: enviado,
          contrato_created_at: c?.created_at || null,
          prazo_limite_assinatura: prazoLimite,
          prazo,
          statusPrazo: status,
          diasRestantes: dias,
        } as PedidoLite;
      });

      setPedidos(peds);
      setLoading(false);
    })();
  }, [selectedLojaId]);

  const isConcluido = (p: PedidoLite) => (p.status || "").toLowerCase() === "concluido" || p.etapa_atual === "concluido" || p.etapa_atual === "finalizado";
  const isVendaFutura = (p: PedidoLite) => p.etapa_atual === "venda_futura";
  const isAtivoWorkflow = (p: PedidoLite) => !isConcluido(p) && !isVendaFutura(p) && p.etapa_atual && ETAPA_TO_GROUP[p.etapa_atual] !== undefined;
  const isNaoAssinado = (p: PedidoLite) => p.etapa_atual === "contrato_nao_assinado";

  // Resumos por grupo (workflow ativo)
  const resumos = useMemo(() => {
    const map = new Map<GroupKey, { qtd: number; valor: number; vencidos: number; preAlerta: number; hoje: number }>();
    WORKFLOW_STAGE_GROUPS.forEach((g) => map.set(g.visualKey, { qtd: 0, valor: 0, vencidos: 0, preAlerta: 0, hoje: 0 }));
    pedidos.filter(isAtivoWorkflow).forEach((p) => {
      const gk = ETAPA_TO_GROUP[p.etapa_atual!]; if (!gk) return;
      const r = map.get(gk)!;
      r.qtd += 1;
      r.valor += Number(p.valor_total || 0);
      if (p.statusPrazo === "vencido") r.vencidos += 1;
      else if (p.statusPrazo === "hoje") r.hoje += 1;
      else if (p.statusPrazo === "pre_alerta") r.preAlerta += 1;
    });
    return map;
  }, [pedidos]);

  const concluidos = useMemo(() => pedidos.filter(isConcluido), [pedidos]);
  const vendasFuturas = useMemo(() => pedidos.filter(isVendaFutura), [pedidos]);
  const naoAssinados = useMemo(() => pedidos.filter(isNaoAssinado), [pedidos]);

  const resumoGeral = useMemo(() => {
    const ativos = pedidos.filter(isAtivoWorkflow);
    const totalValor = ativos.reduce((s, p) => s + Number(p.valor_total || 0), 0);
    const vencidos = ativos.filter((p) => p.statusPrazo === "vencido");
    let maiorGargalo: { grupo: GroupKey; qtd: number } | null = null;
    resumos.forEach((v, k) => { if (!maiorGargalo || v.qtd > maiorGargalo.qtd) maiorGargalo = { grupo: k, qtd: v.qtd }; });
    return {
      totalAtivos: ativos.length,
      totalValor,
      totalVencidos: vencidos.length,
      valorVencido: vencidos.reduce((s, p) => s + Number(p.valor_total || 0), 0),
      maiorGargalo,
    };
  }, [pedidos, resumos]);

  // Lista expandida
  const listaExpandida = useMemo(() => {
    let fonte: PedidoLite[] = [];
    if (topCardSelecionado === "concluido") fonte = concluidos;
    else if (topCardSelecionado === "venda_futura") fonte = vendasFuturas;
    else if (grupoSelecionado) {
      const grupo = WORKFLOW_STAGE_GROUPS.find((g) => g.visualKey === grupoSelecionado);
      const internas = new Set(grupo?.internalKeys || []);
      const ativos = pedidos.filter((p) => p.etapa_atual && internas.has(p.etapa_atual as EtapaKey));
      if (grupoSelecionado === "contrato_assinado") {
        // Adicionar não assinados se filtro permitir
        if (contratoFiltro === "nao_assinados") fonte = naoAssinados;
        else if (contratoFiltro === "todos") fonte = [...ativos, ...naoAssinados];
        else fonte = ativos;
      } else {
        fonte = ativos;
      }
    }
    return fonte
      .filter((p) => {
        if (statusFiltro !== "todos" && p.statusPrazo !== statusFiltro) return false;
        const b = busca.trim().toLowerCase();
        if (!b) return true;
        return (p.cliente_nome || "").toLowerCase().includes(b) || (p.codigo || "").toLowerCase().includes(b);
      })
      .sort((a, b) => {
        const order = { vencido: 0, hoje: 1, pre_alerta: 2, no_prazo: 3, sem_prazo: 4 };
        return (order[a.statusPrazo || "sem_prazo"] - order[b.statusPrazo || "sem_prazo"]);
      });
  }, [grupoSelecionado, topCardSelecionado, contratoFiltro, pedidos, concluidos, vendasFuturas, naoAssinados, statusFiltro, busca]);

  const grupoLabel = (k: GroupKey) => WORKFLOW_STAGE_GROUPS.find((g) => g.visualKey === k)?.label || k;

  function onSelectGrupo(k: GroupKey) {
    setTopCardSelecionado(null);
    setGrupoSelecionado(grupoSelecionado === k ? null : k);
  }
  function onSelectTopCard(k: TopCardKey) {
    setGrupoSelecionado(null);
    setTopCardSelecionado(topCardSelecionado === k ? null : k);
  }

  function exportarExcel() {
    const fonte = listaExpandida.length > 0 ? listaExpandida : pedidos.filter(isAtivoWorkflow);
    const rows = fonte.map((p) => {
      const assinado = !isNaoAssinado(p);
      return {
        "Etapa Atual": ETAPA_LABEL[p.etapa_atual || ""] || p.etapa_atual || "—",
        "Status de assinatura": assinado ? "Assinado" : "Não assinado",
        "Prazo limite de assinatura": fmtDateBR(p.prazo_limite_assinatura || null),
        "Venda Futura": isVendaFutura(p) ? "Sim" : "Não",
        "Concluído": isConcluido(p) ? "Sim" : "Não",
        Cliente: p.cliente_nome || "—",
        PV: p.codigo,
        Valor: Number(p.valor_total || 0),
        Responsável: p.responsavel_nome || "—",
        Loja: p.loja_nome || "—",
        "Data de criação": fmtDateBR(p.created_at),
        "Data de vencimento": fmtDateBR(p.prazo || null),
        "Status do prazo":
          p.statusPrazo === "vencido" ? "Vencido" :
          p.statusPrazo === "hoje" ? "Vence hoje" :
          p.statusPrazo === "pre_alerta" ? "Pré-alerta" :
          p.statusPrazo === "no_prazo" ? "No prazo" : "Sem prazo",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Workflow");
    XLSX.writeFile(wb, "workflow_operacional_pedidos.xlsx");
  }

  if (loading) {
    return (
      <div className="surface-card p-5">
        <div className="text-sm text-muted-foreground">Carregando workflow operacional…</div>
      </div>
    );
  }

  const totalConcluidoValor = concluidos.reduce((s, p) => s + Number(p.valor_total || 0), 0);
  const totalVendaFuturaValor = vendasFuturas.reduce((s, p) => s + Number(p.valor_total || 0), 0);

  return (
    <div className="surface-card p-5 space-y-5 workflow-print-root">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 no-print">
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportarExcel}>
            <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpenMedicoes(true)}>
            <CalendarRange className="w-4 h-4" /> Medições Previstas
          </Button>
        </div>
      </div>
      <MedicoesPrevistasDialog open={openMedicoes} onOpenChange={setOpenMedicoes} />

      {/* Cards de topo: Concluídos e Venda Futura */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TopCard
          icon={CheckCircle2}
          label="Pedidos Concluídos"
          qtd={concluidos.length}
          valor={totalConcluidoValor}
          tone="emerald"
          active={topCardSelecionado === "concluido"}
          onClick={() => onSelectTopCard("concluido")}
        />
        <TopCard
          icon={Sparkles}
          label="Venda Futura"
          hint="Projeto inicial concluído, sem medição agendada"
          qtd={vendasFuturas.length}
          valor={totalVendaFuturaValor}
          tone="violet"
          active={topCardSelecionado === "venda_futura"}
          onClick={() => onSelectTopCard("venda_futura")}
        />
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <ResumoBox label="Pedidos ativos" value={String(resumoGeral.totalAtivos)} />
        <ResumoBox label="Valor em andamento" value={BRL(resumoGeral.totalValor)} highlight />
        <ResumoBox label="Vencidos" value={String(resumoGeral.totalVencidos)} tone="danger" />
        <ResumoBox label="Valor em atraso" value={BRL(resumoGeral.valorVencido)} tone="danger" />
        <ResumoBox
          label="Maior gargalo"
          value={resumoGeral.maiorGargalo && resumoGeral.maiorGargalo.qtd > 0 ? grupoLabel(resumoGeral.maiorGargalo.grupo) : "—"}
          hint={resumoGeral.maiorGargalo && resumoGeral.maiorGargalo.qtd > 0 ? `${resumoGeral.maiorGargalo.qtd} pedidos` : undefined}
        />
      </div>

      {/* Esteira de etapas em formato de setas */}
      <div className="relative no-print-scroll">
        <div className="flex overflow-x-auto pb-3 pt-1 -mx-1 px-1 workflow-arrows gap-1">
          {WORKFLOW_STAGE_GROUPS.map((e, idx) => {
            const r = resumos.get(e.visualKey)!;
            const Icon = e.icon;
            const active = grupoSelecionado === e.visualKey;
            const risco =
              r.vencidos > 0 ? "danger" :
              r.hoje > 0 ? "warning" :
              r.preAlerta > 0 ? "alert" :
              r.qtd > 0 ? "ok" : "muted";
            const isFirst = idx === 0;
            const isLast = idx === WORKFLOW_STAGE_GROUPS.length - 1;
            const tip = 14;
            const clip = isLast
              ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${tip}px 50%)`
              : isFirst
              ? `polygon(0 0, calc(100% - ${tip}px) 0, 100% 50%, calc(100% - ${tip}px) 100%, 0 100%)`
              : `polygon(0 0, calc(100% - ${tip}px) 0, 100% 50%, calc(100% - ${tip}px) 100%, 0 100%, ${tip}px 50%)`;
            // Badge "não assinados" só no primeiro card
            const showNaoAssinadoBadge = isFirst && naoAssinados.length > 0;
            return (
              <div
                key={e.visualKey}
                className={`shrink-0 transition-all duration-200 ${active ? "drop-shadow-lg" : "drop-shadow-sm"}`}
                style={{ marginLeft: isFirst ? 0 : -tip + 8 }}
              >
                <button
                  type="button"
                  onClick={() => onSelectGrupo(e.visualKey)}
                  className={`relative text-left transition-all duration-200 ${active ? "scale-[1.04] z-20 brightness-105 !bg-[#2F6F90] !text-white hover:!bg-[#3F7898]" : `hover:brightness-105 ${ARROW_BG[risco]}`} ${active ? "ring-[3px] ring-primary/80" : ""}`}
                  style={{
                    clipPath: clip,
                    WebkitClipPath: clip,
                    minWidth: 210,
                    paddingLeft: isFirst ? 14 : tip + 10,
                    paddingRight: isLast ? 14 : tip + 10,
                    paddingTop: 10,
                    paddingBottom: 10,
                    minHeight: 110,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : BADGE_NUM[risco]}`}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center ${active ? "bg-white/20" : ICON_BG[risco]}`}>
                        <Icon className={`w-3.5 h-3.5 ${active ? "text-white" : ICON_FG[risco]}`} />
                      </div>
                    </div>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : DOT_CHIP[risco]}`}>
                      {RISCO_LABEL[risco]}
                    </span>
                  </div>
                  <div className={`text-[11px] font-semibold leading-tight line-clamp-2 ${active ? "text-white" : "text-foreground"}`}>
                    {e.label}
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-xl font-display leading-none ${active ? "text-white" : ""}`}>{r.qtd}</span>
                    <span className={`text-[10px] truncate ${active ? "text-white/80" : "text-muted-foreground"}`}>{BRL(r.valor)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {r.vencidos > 0 && (
                      <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-red-200/80 text-red-800">{r.vencidos} venc</span>
                    )}
                    {r.hoje > 0 && (
                      <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-orange-200/80 text-orange-800">{r.hoje} hoje</span>
                    )}
                    {r.preAlerta > 0 && (
                      <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-200/80 text-amber-800">{r.preAlerta} alerta</span>
                    )}
                    {showNaoAssinadoBadge && (
                      <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${active ? "bg-white/20 text-white" : "bg-rose-200/80 text-rose-800"}`}>
                        <FileX2 className="w-2.5 h-2.5 inline mr-0.5" />{naoAssinados.length} n/assin
                      </span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Área expandida */}
      {(grupoSelecionado || topCardSelecionado) && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">
                {topCardSelecionado === "concluido" && `Pedidos concluídos`}
                {topCardSelecionado === "venda_futura" && `Pedidos em Venda Futura`}
                {grupoSelecionado && `Pedidos em ${grupoLabel(grupoSelecionado)}`}
              </h3>
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
              {/* Filtro Assinados / Não Assinados (só na 1ª etapa) */}
              {grupoSelecionado === "contrato_assinado" && (
                <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/30">
                  {[
                    { v: "assinados", l: "Assinados" },
                    { v: "nao_assinados", l: "Não assinados" },
                    { v: "todos", l: "Todos" },
                  ].map((s) => (
                    <button
                      key={s.v}
                      onClick={() => setContratoFiltro(s.v as ContratoFiltro)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition ${
                        contratoFiltro === s.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s.l}
                    </button>
                  ))}
                </div>
              )}
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
              <Button variant="ghost" size="sm" onClick={() => { setGrupoSelecionado(null); setTopCardSelecionado(null); }}>Fechar</Button>
            </div>
          </div>

          {listaExpandida.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum pedido nesta lista.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3">Cliente</th>
                    <th className="text-left py-2 pr-3">PV</th>
                    <th className="text-left py-2 pr-3">Etapa atual</th>
                    <th className="text-right py-2 pr-3">Valor</th>
                    <th className="text-left py-2 pr-3">Data criação</th>
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
                      <td className="py-2 pr-3 text-xs">
                        {ETAPA_LABEL[p.etapa_atual || ""] || p.etapa_atual || "—"}
                        {isNaoAssinado(p) && <span className="ml-1 text-[10px] text-rose-700">(contrato pendente)</span>}
                      </td>
                      <td className="py-2 pr-3 text-right">{BRL(Number(p.valor_total || 0))}</td>
                      <td className="py-2 pr-3 text-xs">{fmtDateBR(p.created_at)}</td>
                      <td className="py-2 pr-3 text-xs">{fmtDateBR(p.prazo || null)}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge status={p.statusPrazo || "sem_prazo"} dias={p.diasRestantes ?? null} />
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
function TopCard({ icon: Icon, label, hint, qtd, valor, tone, active, onClick }: { icon: any; label: string; hint?: string; qtd: number; valor: number; tone: "emerald" | "violet"; active: boolean; onClick: () => void }) {
  const palette = tone === "emerald"
    ? { bg: "bg-emerald-50", border: "border-emerald-200", icon: "bg-emerald-100 text-emerald-700", value: "text-emerald-800", activeRing: "ring-emerald-400" }
    : { bg: "bg-violet-50", border: "border-violet-200", icon: "bg-violet-100 text-violet-700", value: "text-violet-800", activeRing: "ring-violet-400" };
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border ${palette.border} ${palette.bg} p-4 transition-all hover:shadow-md ${active ? `ring-[3px] ${palette.activeRing} shadow-md` : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${palette.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          {hint && <div className="text-[10px] text-muted-foreground/80">{hint}</div>}
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className={`text-2xl font-display leading-none ${palette.value}`}>{qtd}</span>
            <span className="text-xs text-muted-foreground">{BRL(valor)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

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
    no_prazo: { label: dias != null ? `${dias}d restantes` : "No prazo", cls: "bg-[#C7DFE8] text-[#3F7898]" },
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
  danger: "bg-red-200", warning: "bg-orange-200", alert: "bg-amber-200", ok: "bg-[#C7DFE8]", muted: "bg-[#E7EEF2]",
};
const ICON_FG: Record<string, string> = {
  danger: "text-red-800", warning: "text-orange-800", alert: "text-amber-800", ok: "text-[#3F7898]", muted: "text-[#64748B]",
};
const DOT_CHIP: Record<string, string> = {
  danger: "bg-red-200 text-red-800",
  warning: "bg-orange-200 text-orange-800",
  alert: "bg-amber-200 text-amber-800",
  ok: "bg-[#C7DFE8] text-[#3F7898]",
  muted: "bg-[#E7EEF2] text-[#64748B]",
};
const RISCO_LABEL: Record<string, string> = {
  danger: "Crítico", warning: "Hoje", alert: "Alerta", ok: "Ok", muted: "—",
};
const ARROW_BG: Record<string, string> = {
  danger: "bg-red-100/90 hover:bg-red-200",
  warning: "bg-orange-100/90 hover:bg-orange-200",
  alert: "bg-amber-100/90 hover:bg-amber-200",
  ok: "bg-[#8FB9C9]/90 hover:bg-[#5F93AE]",
  muted: "bg-[#E7EEF2]/90 hover:bg-[#C7DFE8]",
};
const BADGE_NUM: Record<string, string> = {
  danger: "bg-red-600 text-white",
  warning: "bg-orange-500 text-white",
  alert: "bg-amber-500 text-white",
  ok: "bg-[#5F93AE] text-white",
  muted: "bg-[#8FB9C9] text-white",
};
