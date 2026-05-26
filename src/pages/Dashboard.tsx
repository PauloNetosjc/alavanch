import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, BarChart3, TrendingUp, TrendingDown, Clock, Ruler, Pencil, Factory, Truck, Wrench, AlertTriangle } from "lucide-react";
import { BRL } from "@/lib/financeiro";
import { PageFilters, defaultPeriodoMes, resolvePeriodo, PeriodoState } from "@/components/PageFilters";
import { useLoja } from "@/contexts/LojaContext";

type Pedido = {
  id: string;
  valor_total: number | null;
  juros_total: number | null;
  rt_repassado: number | null;
  created_at: string;
  status: string | null;
  workflow_estagio: string | null;
  data_limite_finalizacao: string | null;
  loja_id: string | null;
};
type Lanc = { tipo: string; valor: number; status: string | null; data_vencimento: string | null; data_pagamento: string | null; loja_id: string | null };

const ESTAGIOS: { key: string; label: string; icon: any; rota: string }[] = [
  { key: "aguardando", label: "NÃO INICIADO", icon: Clock, rota: "/kanbans" },
  { key: "medicao", label: "MEDIÇÃO", icon: Ruler, rota: "/kanban-revisao" },
  { key: "revisao", label: "REVISÃO", icon: Pencil, rota: "/kanban-revisao" },
  { key: "fabricacao", label: "FABRICAÇÃO", icon: Factory, rota: "/kanban-fabrica" },
  { key: "entrega", label: "ENTREGA", icon: Truck, rota: "/kanban-montagem" },
  { key: "montagem", label: "MONTAGEM", icon: Wrench, rota: "/kanban-montagem" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedLojaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoState>(defaultPeriodoMes());
  const [lojasFiltro, setLojasFiltro] = useState<string[]>(selectedLojaId ? [selectedLojaId] : []);
  useEffect(() => { setLojasFiltro(selectedLojaId ? [selectedLojaId] : []); }, [selectedLojaId]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [vendedores, setVendedores] = useState<{ nome: string; valor: number }[]>([]);
  const [meta, setMeta] = useState(0);

  const { inicio, fim } = useMemo(() => resolvePeriodo(periodo), [periodo]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let qPed = supabase
        .from("pedidos")
        .select("id, valor_total, juros_total, rt_repassado, created_at, status, workflow_estagio, data_limite_finalizacao, loja_id");
      let qLan = supabase
        .from("lancamentos_financeiros")
        .select("tipo, valor, status, data_vencimento, data_pagamento, loja_id");
      let qOrc = supabase
        .from("orcamentos")
        .select("total, consultor_id, created_at, status, loja_id");
      if (lojasFiltro.length > 0) {
        qPed = qPed.in("loja_id", lojasFiltro);
        qLan = qLan.in("loja_id", lojasFiltro);
        qOrc = qOrc.in("loja_id", lojasFiltro);
      }
      if (inicio && fim) {
        qLan = qLan.gte("data_vencimento", inicio.toISOString().slice(0, 10)).lte("data_vencimento", fim.toISOString().slice(0, 10));
        qOrc = qOrc.gte("created_at", inicio.toISOString()).lte("created_at", fim.toISOString());
      }

      // Meta (tabela metas_vendas) — mês/ano de "ref" se key=mes/ano
      let metaTotal = 0;
      if (periodo.key === "mes") {
        const r = periodo.ref;
        let qMeta = supabase.from("metas_vendas" as any).select("meta_valor, loja_id").eq("ano", r.getFullYear()).eq("mes", r.getMonth() + 1);
        if (lojasFiltro.length > 0) qMeta = qMeta.in("loja_id", lojasFiltro);
        const { data: metas } = await qMeta;
        metaTotal = ((metas as any[]) || []).reduce((s, m) => s + Number(m.meta_valor || 0), 0);
      }
      setMeta(metaTotal);

      const [{ data: peds }, { data: ls }, { data: orcs }] = await Promise.all([qPed, qLan, qOrc]);
      setPedidos((peds as Pedido[]) || []);
      setLancs((ls as Lanc[]) || []);

      // Receita por vendedor
      const ids = Array.from(new Set((orcs || []).map((o: any) => o.consultor_id).filter(Boolean)));
      let nomes: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome_completo").in("user_id", ids);
        (profs || []).forEach((p: any) => (nomes[p.user_id] = p.nome_completo));
      }
      const map = new Map<string, number>();
      (orcs || []).forEach((o: any) => {
        if (!o.consultor_id) return;
        const k = nomes[o.consultor_id] || "—";
        map.set(k, (map.get(k) || 0) + Number(o.total || 0));
      });
      setVendedores(Array.from(map.entries()).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor));

      setLoading(false);
    })();
  }, [periodo, lojasFiltro]);

  // Pedidos do período (criados dentro da janela)
  const pedidosPeriodo = useMemo(
    () =>
      pedidos.filter((p) => {
        if (!inicio || !fim) return true;
        const d = new Date(p.created_at);
        return d >= inicio && d <= fim;
      }),
    [pedidos, inicio, fim]
  );

  const vendaBruta = pedidosPeriodo.reduce((s, p) => s + Number(p.valor_total || 0), 0);
  const totalJuros = pedidosPeriodo.reduce((s, p) => s + Number(p.juros_total || 0), 0);
  const totalRT = pedidosPeriodo.reduce((s, p) => s + Number(p.rt_repassado || 0), 0);
  const vendaLiquida = vendaBruta - totalJuros - totalRT;
  const pctMeta = meta ? (vendaBruta / meta) * 100 : 0;

  const receitaEsperada = lancs.filter((l) => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0);
  const recebido = lancs.filter((l) => l.tipo === "entrada" && l.status === "pago").reduce((s, l) => s + Number(l.valor), 0);
  const pendenteRec = receitaEsperada - recebido;
  const despesaPrev = lancs.filter((l) => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
  const pago = lancs.filter((l) => l.tipo === "saida" && l.status === "pago").reduce((s, l) => s + Number(l.valor), 0);
  const pendentePag = despesaPrev - pago;
  const pctReal = receitaEsperada ? (recebido / receitaEsperada) * 100 : 0;
  const pctRealDesp = despesaPrev ? (pago / despesaPrev) * 100 : 0;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fluxo = ESTAGIOS.map((est) => {
    const ps = pedidos.filter((p) => (p.workflow_estagio || "aguardando") === est.key && p.status !== "concluido");
    const vencidos = ps.filter((p) => p.data_limite_finalizacao && new Date(p.data_limite_finalizacao) < hoje).length;
    return { ...est, qtd: ps.length, valor: ps.reduce((s, p) => s + Number(p.valor_total || 0), 0), vencidos };
  });
  const totalFluxo = fluxo.reduce((s, f) => s + f.qtd, 0) || 1;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display">Visão Geral Operacional</h1>
            <p className="text-xs text-muted-foreground">Resumo de receitas, metas e próximas ações</p>
          </div>
        </div>
        <PageFilters value={periodo} onChange={setPeriodo} lojas={lojasFiltro} onLojasChange={setLojasFiltro} />
      </div>

      {/* Meta de Vendas + Receita por Vendedor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="surface-card lg:col-span-2 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <h3 className="font-medium">Meta de Vendas</h3>
              <span className="text-xs text-muted-foreground">Contratos do período</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">{pctMeta.toFixed(0)}%</span>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Venda Bruta</div>
              <div className="text-2xl font-display mt-1">{BRL(vendaBruta)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Venda Líquida</div>
              <div className="text-2xl font-display mt-1 text-primary">{BRL(vendaLiquida)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                − juros {BRL(totalJuros)} − RT {BRL(totalRT)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Meta</div>
              <div className="text-2xl font-display mt-1">{BRL(meta)}</div>
              <div className="h-1.5 bg-muted rounded mt-2 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, pctMeta)}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="font-medium">Receita por Vendedor</h3>
          </div>
          {vendedores.length ? (
            <div className="space-y-2">
              {vendedores.slice(0, 5).map((v) => (
                <div key={v.nome}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate">{v.nome}</span>
                    <span className="font-medium">{BRL(v.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <BarChart3 className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <div className="text-sm mt-2">Nenhum dado de vendas ainda</div>
              <div className="text-xs text-muted-foreground">Vendas aparecerão aqui quando registradas</div>
            </div>
          )}
        </div>
      </div>

      {/* Receita Esperada vs Despesa Prevista */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl p-5" style={{ background: "hsl(142 70% 96%)" }}>
          <div className="flex items-center gap-2 text-green-700">
            <TrendingUp className="w-4 h-4" /><span className="text-xs uppercase tracking-wider font-medium">Receita Esperada</span>
          </div>
          <div className="text-3xl font-display text-green-900 mt-2">{BRL(receitaEsperada)}</div>
          <div className="flex justify-between text-xs text-green-700 mt-3">
            <span>Realizado</span><span>{pctReal.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-green-200 rounded mt-1 overflow-hidden">
            <div className="h-full bg-green-600" style={{ width: `${Math.min(100, pctReal)}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
            <div><div className="text-muted-foreground">Recebido</div><div className="font-medium">{BRL(recebido)}</div></div>
            <div><div className="text-muted-foreground">Pendente</div><div className="font-medium">{BRL(pendenteRec)}</div></div>
          </div>
        </div>

        <div className="rounded-xl p-5" style={{ background: "hsl(0 70% 97%)" }}>
          <div className="flex items-center gap-2 text-red-700">
            <TrendingDown className="w-4 h-4" /><span className="text-xs uppercase tracking-wider font-medium">Despesa Prevista</span>
          </div>
          <div className="text-3xl font-display text-red-900 mt-2">{BRL(despesaPrev)}</div>
          <div className="flex justify-between text-xs text-red-700 mt-3">
            <span>Realizado</span><span>{pctRealDesp.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-red-200 rounded mt-1 overflow-hidden">
            <div className="h-full bg-red-600" style={{ width: `${Math.min(100, pctRealDesp)}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
            <div><div className="text-muted-foreground">Pago</div><div className="font-medium">{BRL(pago)}</div></div>
            <div><div className="text-muted-foreground">Pendente</div><div className="font-medium">{BRL(pendentePag)}</div></div>
          </div>
        </div>
      </div>

      {/* Fluxo de Trabalho Industrial */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Factory className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <h2 className="text-xl font-display">Fluxo de Trabalho Industrial</h2>
              <p className="text-xs text-muted-foreground">Distribuição Ativa por Estágio de Produção</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/radar-prazos")}
            className="text-[11px] px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-1"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Radar de prazos
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {fluxo.map((f) => {
            const Icon = f.icon;
            const pct = (f.qtd / totalFluxo) * 100;
            return (
              <button
                key={f.key}
                onClick={() => navigate(f.rota)}
                className="surface-card p-5 text-left hover:border-primary/50 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3 group-hover:bg-primary/10 transition-colors">
                    <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  {f.vencidos > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {f.vencidos} vencido{f.vencidos > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</div>
                <div className="text-3xl font-display mt-1">{f.qtd}</div>
                <div className="text-xs text-muted-foreground mt-2">Valor: {BRL(f.valor)}</div>
                <div className="h-1 bg-muted rounded mt-2 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
