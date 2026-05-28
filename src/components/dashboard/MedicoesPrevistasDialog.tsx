import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { BRL } from "@/lib/financeiro";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarRange, FileSpreadsheet, Printer, ArrowRight, AlertTriangle,
  CheckCircle2, CalendarClock, CalendarX2, CalendarCheck2,
} from "lucide-react";
import * as XLSX from "xlsx";

type PedidoRow = {
  id: string;
  codigo: string;
  status: string | null;
  valor_total: number | null;
  custo: number;
  loja_id: string | null;
  loja_nome: string | null;
  cliente_nome: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  vendedor_id: string | null;
  vendedor_nome: string | null;
  created_at: string;
  previsao_medicao: string | null;
  data_medicao_tecnica: string | null;
  etapa_atual: string | null;
};

type PrevStatus = "sem_previsao" | "prevista" | "vence_hoje" | "vencida" | "agendada";

const STATUS_LABEL: Record<PrevStatus, string> = {
  sem_previsao: "Sem previsão",
  prevista: "Prevista",
  vence_hoje: "Vence hoje",
  vencida: "Vencida",
  agendada: "Medição agendada",
};

const STATUS_TONE: Record<PrevStatus, string> = {
  sem_previsao: "bg-slate-100 text-slate-700",
  prevista: "bg-[#C7DFE8] text-[#1f4f6b]",
  vence_hoje: "bg-amber-100 text-amber-800",
  vencida: "bg-red-100 text-red-800",
  agendada: "bg-emerald-100 text-emerald-800",
};

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
  concluido: "Concluído",
  finalizado: "Concluído",
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function diffDays(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = startOfDay(new Date(iso));
  const t = startOfDay(new Date());
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return "—"; }
}
function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function getPrevStatus(p: PedidoRow): PrevStatus {
  if (p.data_medicao_tecnica) return "agendada";
  if (!p.previsao_medicao) return "sem_previsao";
  const d = diffDays(p.previsao_medicao);
  if (d === null) return "sem_previsao";
  if (d < 0) return "vencida";
  if (d === 0) return "vence_hoje";
  return "prevista";
}

export default function MedicoesPrevistasDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { selectedLojaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<PedidoRow[]>([]);

  const hoje = new Date();
  const [ano, setAno] = useState<string>(String(hoje.getFullYear()));
  const [mes, setMes] = useState<string>("todos");
  const [lojaFiltro, setLojaFiltro] = useState<string>("todas");
  const [respFiltro, setRespFiltro] = useState<string>("todos");
  const [vendFiltro, setVendFiltro] = useState<string>("todos");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | "com_previsao" | "sem_previsao" | "vencida" | "agendada" | "nao_agendada">("todos");
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("pedidos")
        .select("id, codigo, status, valor_total, loja_id, created_at, previsao_medicao, data_medicao_tecnica, etapa_atual, projetista_id, orcamento_id, is_adendo, cliente:clientes(nome), loja:lojas(nome)");
      if (selectedLojaId) q = q.eq("loja_id", selectedLojaId);
      const { data } = await q;
      const raw: any[] = ((data as any[]) || []).filter(
        (p) => !p.is_adendo && (p.status || "").toLowerCase() !== "cancelado",
      );

      const orcIds = Array.from(new Set(raw.map((p) => p.orcamento_id).filter(Boolean)));
      const respIds = Array.from(new Set(raw.map((p) => p.projetista_id).filter(Boolean)));

      const [{ data: orcs }, { data: profs }] = await Promise.all([
        orcIds.length
          ? supabase.from("orcamentos").select("id, vendedor_id").in("id", orcIds)
          : Promise.resolve({ data: [] as any[] }),
        Promise.resolve(null).then(async () => {
          const ids = new Set<string>(respIds);
          return ids.size ? supabase.from("profiles").select("id, nome_completo").in("id", Array.from(ids)) : { data: [] as any[] };
        }),
      ]);
      const vendIds = Array.from(new Set(((orcs as any[]) || []).map((o) => o.vendedor_id).filter(Boolean)));
      const allProfIds = Array.from(new Set([...respIds, ...vendIds]));
      const { data: profs2 } = allProfIds.length
        ? await supabase.from("profiles").select("id, nome_completo").in("id", allProfIds)
        : { data: [] as any[] };
      const nomes: Record<string, string> = {};
      ((profs2 as any[]) || []).forEach((p) => { nomes[p.id] = p.nome_completo || "—"; });
      const orcVend: Record<string, string | null> = {};
      ((orcs as any[]) || []).forEach((o) => { orcVend[o.id] = o.vendedor_id || null; });

      // Custo de fábrica por orçamento (soma dos ambientes.custo_fabrica)
      const custoPorOrc: Record<string, number> = {};
      if (orcIds.length) {
        const { data: ambs } = await supabase
          .from("ambientes")
          .select("orcamento_id, custo_fabrica")
          .in("orcamento_id", orcIds);
        ((ambs as any[]) || []).forEach((a) => {
          if (!a.orcamento_id) return;
          custoPorOrc[a.orcamento_id] = (custoPorOrc[a.orcamento_id] || 0) + Number(a.custo_fabrica || 0);
        });
      }

      const rows: PedidoRow[] = raw.map((p) => {
        const vendId = p.orcamento_id ? orcVend[p.orcamento_id] || null : null;
        return {
          id: p.id,
          codigo: p.codigo,
          status: p.status,
          valor_total: p.valor_total,
          custo: p.orcamento_id ? Number(custoPorOrc[p.orcamento_id] || 0) : 0,
          loja_id: p.loja_id,
          loja_nome: p.loja?.nome ?? null,
          cliente_nome: p.cliente?.nome ?? null,
          responsavel_id: p.projetista_id || null,
          responsavel_nome: p.projetista_id ? nomes[p.projetista_id] || null : null,
          vendedor_id: vendId,
          vendedor_nome: vendId ? nomes[vendId] || null : null,
          created_at: p.created_at,
          previsao_medicao: p.previsao_medicao,
          data_medicao_tecnica: p.data_medicao_tecnica,
          etapa_atual: p.etapa_atual,
        };
      });
      // Suprime profs var lint
      void profs;
      setPedidos(rows);
      setLoading(false);
    })();
  }, [open, selectedLojaId]);

  const anosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach((p) => { if (p.previsao_medicao) set.add(String(new Date(p.previsao_medicao).getFullYear())); });
    set.add(String(hoje.getFullYear()));
    return Array.from(set).sort();
  }, [pedidos]);

  const lojasDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    pedidos.forEach((p) => { if (p.loja_id) m.set(p.loja_id, p.loja_nome || "—"); });
    return Array.from(m.entries());
  }, [pedidos]);
  const respDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    pedidos.forEach((p) => { if (p.responsavel_id) m.set(p.responsavel_id, p.responsavel_nome || "—"); });
    return Array.from(m.entries());
  }, [pedidos]);
  const vendDisponiveis = useMemo(() => {
    const m = new Map<string, string>();
    pedidos.forEach((p) => { if (p.vendedor_id) m.set(p.vendedor_id, p.vendedor_nome || "—"); });
    return Array.from(m.entries());
  }, [pedidos]);

  // Aplica filtros (exceto mês — usado depois p/ agrupamento)
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (lojaFiltro !== "todas" && p.loja_id !== lojaFiltro) return false;
      if (respFiltro !== "todos" && p.responsavel_id !== respFiltro) return false;
      if (vendFiltro !== "todos" && p.vendedor_id !== vendFiltro) return false;
      const st = getPrevStatus(p);
      if (statusFiltro === "com_previsao" && !p.previsao_medicao) return false;
      if (statusFiltro === "sem_previsao" && p.previsao_medicao) return false;
      if (statusFiltro === "vencida" && st !== "vencida") return false;
      if (statusFiltro === "agendada" && st !== "agendada") return false;
      if (statusFiltro === "nao_agendada" && p.data_medicao_tecnica) return false;
      // Filtro por ano/mês refere-se à previsão de medição
      if (p.previsao_medicao) {
        const d = new Date(p.previsao_medicao);
        if (ano !== "todos" && String(d.getFullYear()) !== ano) return false;
        if (mes !== "todos" && String(d.getMonth() + 1).padStart(2, "0") !== mes) return false;
      } else {
        // Sem previsão só aparece se status = "sem_previsao" ou "todos" e sem filtro ano/mês específico
        if (ano !== "todos" || mes !== "todos") return false;
        if (statusFiltro !== "todos" && statusFiltro !== "sem_previsao") return false;
      }
      return true;
    });
  }, [pedidos, lojaFiltro, respFiltro, vendFiltro, statusFiltro, ano, mes]);

  // Cards superiores (baseados em todos os pedidos da loja contexto + filtros base loja/resp/vend, ignorando ano/mês/status)
  const baseParaCards = useMemo(() => {
    return pedidos.filter((p) => {
      if (lojaFiltro !== "todas" && p.loja_id !== lojaFiltro) return false;
      if (respFiltro !== "todos" && p.responsavel_id !== respFiltro) return false;
      if (vendFiltro !== "todos" && p.vendedor_id !== vendFiltro) return false;
      return true;
    });
  }, [pedidos, lojaFiltro, respFiltro, vendFiltro]);

  const topCards = useMemo(() => {
    const comPrev = baseParaCards.filter((p) => p.previsao_medicao);
    const m = hoje.getMonth(); const y = hoje.getFullYear();
    const desteMes = comPrev.filter((p) => {
      const d = new Date(p.previsao_medicao!);
      return d.getMonth() === m && d.getFullYear() === y;
    });
    const valorMes = desteMes.reduce((s, p) => s + Number(p.valor_total || 0), 0);
    const custoMes = desteMes.reduce((s, p) => s + Number(p.custo || 0), 0);
    const vencidas = comPrev.filter((p) => getPrevStatus(p) === "vencida").length;
    const agendadas = baseParaCards.filter((p) => p.data_medicao_tecnica).length;
    return {
      totalPrev: comPrev.length,
      qtdMes: desteMes.length,
      valorMes,
      custoMes,
      vencidas,
      agendadas,
    };
  }, [baseParaCards]);

  // Agrupamento mensal a partir de pedidosFiltrados (somente com previsão)
  const meses = useMemo(() => {
    const map = new Map<string, {
      key: string; label: string; qtd: number; valor: number; custo: number;
      porLoja: Map<string, number>; porResp: Map<string, number>;
      vencidas: number; agendadas: number;
    }>();
    pedidosFiltrados.forEach((p) => {
      if (!p.previsao_medicao) return;
      const k = monthKey(p.previsao_medicao);
      let r = map.get(k);
      if (!r) {
        r = { key: k, label: monthLabel(k), qtd: 0, valor: 0, custo: 0, porLoja: new Map(), porResp: new Map(), vencidas: 0, agendadas: 0 };
        map.set(k, r);
      }
      r.qtd++;
      r.valor += Number(p.valor_total || 0);
      r.custo += Number(p.custo || 0);
      const ln = p.loja_nome || "—"; r.porLoja.set(ln, (r.porLoja.get(ln) || 0) + 1);
      const rn = p.responsavel_nome || p.vendedor_nome || "—"; r.porResp.set(rn, (r.porResp.get(rn) || 0) + 1);
      const st = getPrevStatus(p);
      if (st === "vencida") r.vencidas++;
      if (st === "agendada") r.agendadas++;
    });
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [pedidosFiltrados]);

  const lista = useMemo(() => {
    if (!mesSelecionado) return pedidosFiltrados;
    return pedidosFiltrados.filter((p) => p.previsao_medicao && monthKey(p.previsao_medicao) === mesSelecionado);
  }, [pedidosFiltrados, mesSelecionado]);

  function ticket(qtd: number, valor: number) {
    return qtd > 0 ? valor / qtd : 0;
  }

  function exportarExcel() {
    const linhas = lista.map((p) => {
      const st = getPrevStatus(p);
      const dias = p.previsao_medicao ? diffDays(p.previsao_medicao) : null;
      return {
        "Mês": p.previsao_medicao ? monthLabel(monthKey(p.previsao_medicao)) : "—",
        "Código": p.codigo,
        "Cliente": p.cliente_nome || "—",
        "Loja": p.loja_nome || "—",
        "Responsável": p.responsavel_nome || "—",
        "Vendedor": p.vendedor_nome || "—",
        "Valor": Number(p.valor_total || 0),
        "Custo de mercadoria/fábrica": Number(p.custo || 0),
        "Data da venda": fmtDate(p.created_at),
        "Previsão de medição": fmtDate(p.previsao_medicao),
        "Status da previsão": STATUS_LABEL[st],
        "Medição técnica agendada": p.data_medicao_tecnica ? "Sim" : "Não",
        "Data da medição agendada": fmtDate(p.data_medicao_tecnica),
        "Dias restantes/atraso": dias === null ? "—" : dias,
        "Etapa atual": p.etapa_atual ? ETAPA_LABEL[p.etapa_atual] || p.etapa_atual : "—",
      };
    });
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Medições Previstas");
    XLSX.writeFile(wb, "dashboard_medicoes_previstas.xlsx");
  }

  function imprimir() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1280px] max-h-[92vh] overflow-y-auto p-0">
        <div className="p-6 space-y-5 medicoes-previstas-print">
          <DialogHeader className="no-print">
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-primary" />
              Dashboard de Medições Previstas
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Visão gerencial e comercial das previsões de medição informadas na negociação. Esta tela não agenda, não cria tarefas e não altera o workflow.
            </p>
          </DialogHeader>

          {/* Header impressão */}
          <div className="hidden print:block">
            <h1 className="text-lg font-semibold">Dashboard de Medições Previstas</h1>
            <p className="text-xs">Gerado em {new Date().toLocaleString("pt-BR")}</p>
            <p className="text-xs">
              Filtros: Ano {ano} · Mês {mes} · Loja {lojaFiltro} · Resp. {respFiltro} · Vend. {vendFiltro} · Status {statusFiltro}
            </p>
          </div>

          {/* Top Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <TopCard icon={CalendarRange} tone="slate" label="Total com previsão" value={topCards.totalPrev} />
            <TopCard icon={CalendarClock} tone="blue" label="Previstas este mês" value={topCards.qtdMes} />
            <TopCard icon={CalendarCheck2} tone="blue" label="Valor previsto este mês" value={BRL(topCards.valorMes)} money />
            <TopCard icon={CalendarCheck2} tone="slate" label="Custo (mês)" value={BRL(topCards.custoMes)} money />
            <TopCard icon={CalendarX2} tone="red" label="Previsões vencidas" value={topCards.vencidas} />
            <TopCard icon={CheckCircle2} tone="emerald" label="Medições já agendadas" value={topCards.agendadas} />
          </div>

          {/* Filtros + ações */}
          <div className="flex flex-wrap items-center gap-2 no-print">
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="w-[110px] h-9"><SelectValue placeholder="Ano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos anos</SelectItem>
                {anosDisponiveis.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-[120px] h-9"><SelectValue placeholder="Mês" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos meses</SelectItem>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Loja" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas lojas</SelectItem>
                {lojasDisponiveis.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={respFiltro} onValueChange={setRespFiltro}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos responsáveis</SelectItem>
                {respDisponiveis.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={vendFiltro} onValueChange={setVendFiltro}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Vendedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos vendedores</SelectItem>
                {vendDisponiveis.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFiltro} onValueChange={(v: any) => setStatusFiltro(v)}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="com_previsao">Com previsão</SelectItem>
                <SelectItem value="sem_previsao">Sem previsão</SelectItem>
                <SelectItem value="vencida">Previsão vencida</SelectItem>
                <SelectItem value="agendada">Medição já agendada</SelectItem>
                <SelectItem value="nao_agendada">Medição ainda não agendada</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={exportarExcel}>
              <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
            </Button>
            <Button variant="outline" size="sm" onClick={imprimir}>
              <Printer className="w-4 h-4" /> Imprimir
            </Button>
          </div>

          {/* Cards por mês */}
          <div>
            <h3 className="text-sm font-medium mb-2">Resumo por mês</h3>
            {meses.length === 0 ? (
              <div className="text-sm text-muted-foreground border rounded-lg p-6 text-center">
                Nenhuma previsão de medição encontrada para os filtros aplicados.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {meses.map((m) => {
                  const sel = mesSelecionado === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setMesSelecionado(sel ? null : m.key)}
                      className={`text-left rounded-xl border bg-white p-4 transition-all hover:shadow-md ${sel ? "ring-2 ring-primary shadow-md" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold capitalize">{m.label}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E7EEF2] text-[#3F7898]">{m.qtd} pedidos</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Valor total</div>
                      <div className="text-base font-semibold text-slate-900">{BRL(m.valor)}</div>
                      <div className="text-[11px] text-muted-foreground mt-2">Custo</div>
                      <div className="text-sm font-semibold text-slate-900">{BRL(m.custo)}</div>
                      <div className="text-[11px] text-muted-foreground mt-2">Ticket médio: <span className="font-semibold text-slate-900">{BRL(ticket(m.qtd, m.valor))}</span></div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-md bg-red-50 text-red-700 px-2 py-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Vencidas: {m.vencidas}
                        </div>
                        <div className="rounded-md bg-emerald-50 text-emerald-700 px-2 py-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Agendadas: {m.agendadas}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <div className="text-muted-foreground mb-0.5">Por loja</div>
                          <ul className="space-y-0.5">
                            {Array.from(m.porLoja.entries()).slice(0, 3).map(([k, v]) => (
                              <li key={k} className="truncate">{k}: <strong>{v}</strong></li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-0.5">Por responsável</div>
                          <ul className="space-y-0.5">
                            {Array.from(m.porResp.entries()).slice(0, 3).map(([k, v]) => (
                              <li key={k} className="truncate">{k}: <strong>{v}</strong></li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lista detalhada */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">
                Lista detalhada {mesSelecionado && <span className="text-muted-foreground">— {monthLabel(mesSelecionado)}</span>}
              </h3>
              {mesSelecionado && (
                <Button variant="ghost" size="sm" onClick={() => setMesSelecionado(null)} className="no-print">Limpar mês</Button>
              )}
            </div>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2">Código</th>
                    <th className="p-2">Cliente</th>
                    <th className="p-2">Loja</th>
                    <th className="p-2">Responsável</th>
                    <th className="p-2">Vendedor</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2 text-right">Custo</th>
                    <th className="p-2">Venda</th>
                    <th className="p-2">Previsão</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Agendada</th>
                    <th className="p-2 text-right">Dias</th>
                    <th className="p-2">Etapa atual</th>
                    <th className="p-2 no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="p-4 text-center text-muted-foreground" colSpan={14}>Carregando…</td></tr>
                  ) : lista.length === 0 ? (
                    <tr><td className="p-4 text-center text-muted-foreground" colSpan={14}>Nenhum pedido para os filtros.</td></tr>
                  ) : lista.map((p) => {
                    const st = getPrevStatus(p);
                    const dias = p.previsao_medicao ? diffDays(p.previsao_medicao) : null;
                    return (
                      <tr key={p.id} className="border-t hover:bg-muted/30">
                        <td className="p-2 font-medium">{p.codigo}</td>
                        <td className="p-2">{p.cliente_nome || "—"}</td>
                        <td className="p-2">{p.loja_nome || "—"}</td>
                        <td className="p-2">{p.responsavel_nome || "—"}</td>
                        <td className="p-2">{p.vendedor_nome || "—"}</td>
                        <td className="p-2 text-right font-semibold text-slate-900">{BRL(Number(p.valor_total || 0))}</td>
                        <td className="p-2 text-right font-semibold text-slate-900">{BRL(Number(p.custo || 0))}</td>
                        <td className="p-2">{fmtDate(p.created_at)}</td>
                        <td className="p-2">{fmtDate(p.previsao_medicao)}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${STATUS_TONE[st]}`}>{STATUS_LABEL[st]}</span>
                        </td>
                        <td className="p-2">{p.data_medicao_tecnica ? fmtDate(p.data_medicao_tecnica) : "—"}</td>
                        <td className="p-2 text-right">{dias === null ? "—" : (dias < 0 ? `${Math.abs(dias)}d atraso` : `${dias}d`)}</td>
                        <td className="p-2">{p.etapa_atual ? ETAPA_LABEL[p.etapa_atual] || p.etapa_atual : "—"}</td>
                        <td className="p-2 no-print">
                          <Button variant="ghost" size="sm" onClick={() => { onOpenChange(false); navigate(`/pedidos/${p.id}`); }}>
                            <ArrowRight className="w-3 h-3" /> Abrir
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TopCard({ icon: Icon, tone, label, value, money }: { icon: any; tone: "blue" | "red" | "emerald" | "slate"; label: string; value: string | number; money?: boolean }) {
  const tones: Record<string, string> = {
    blue: "bg-[#E7EEF2] text-[#1f4f6b]",
    red: "bg-red-50 text-red-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-50 text-slate-700",
  };
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
      <div className={`text-lg font-semibold ${money ? "text-slate-900" : ""}`}>{value}</div>
    </div>
  );
}
