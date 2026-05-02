import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { DollarSign, Calculator, TrendingUp, PieChart as PieIcon, TrendingDown, Users, BarChart3, CalendarDays } from "lucide-react";
import { useLoja } from "@/contexts/LojaContext";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const meses = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

type Periodo = "mes" | "ano" | "tudo" | "personalizado";

export default function Relatorios() {
  const { selectedLojaId } = useLoja();
  const [periodo, setPeriodo] = useState<Periodo>("ano");
  const [orcs, setOrcs] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [parceiros, setParceiros] = useState<any[]>([]);
  const [agendas, setAgendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let sinceISO: string | null = null;
      const now = new Date();
      if (periodo === "mes") sinceISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      else if (periodo === "ano") sinceISO = new Date(now.getFullYear(), 0, 1).toISOString();

      let qOrc = supabase.from("orcamentos").select("id, codigo, total, status, created_at, parceiro_id, cliente_id, loja_id, ambientes(custo_loja,custo_fabrica,custo_aquisicao,preco_sugerido)");
      let qPed = supabase.from("pedidos").select("id, codigo, valor_total, status, created_at, cliente_id, loja_id");
      let qPar = supabase.from("parceiro_comissoes" as any).select("parceiro_id, valor_calculado, loja_id, parceiros(nome)");
      let qAge = supabase.from("agenda_eventos" as any).select("id, tipo, data, status, loja_id");

      if (sinceISO) {
        qOrc = qOrc.gte("created_at", sinceISO);
        qPed = qPed.gte("created_at", sinceISO);
        qAge = qAge.gte("data", sinceISO.slice(0, 10));
      }
      if (selectedLojaId) {
        qOrc = qOrc.eq("loja_id", selectedLojaId);
        qPed = qPed.eq("loja_id", selectedLojaId);
        qPar = qPar.eq("loja_id", selectedLojaId);
        qAge = qAge.eq("loja_id", selectedLojaId);
      }

      const [{ data: o }, { data: p }, { data: pc }, { data: ag }] = await Promise.all([qOrc, qPed, qPar, qAge]);
      setOrcs(o || []); setPedidos(p || []); setParceiros((pc as any[]) || []); setAgendas((ag as any[]) || []);
      setLoading(false);
    })();
  }, [periodo, selectedLojaId]);

  const kpi = useMemo(() => {
    const fechados = orcs.filter((o) => ["aprovado", "fechado", "convertido", "confirmado"].includes(o.status));
    const faturamento = fechados.reduce((s, o) => s + Number(o.total || 0), 0);
    const cancelados = orcs.filter((o) => o.status === "cancelado").length;
    const conv = orcs.length ? (fechados.length / orcs.length) * 100 : 0;
    const ticket = fechados.length ? faturamento / fechados.length : 0;
    // markup: soma preco_sugerido / soma custo total dos ambientes
    let totalPreco = 0, totalCusto = 0;
    fechados.forEach((o) => (o.ambientes || []).forEach((a: any) => {
      totalPreco += Number(a.preco_sugerido || 0);
      totalCusto += Number(a.custo_loja || a.custo_fabrica || a.custo_aquisicao || 0);
    }));
    const markup = totalCusto > 0 ? ((totalPreco - totalCusto) / totalCusto) * 100 : 0;
    return { faturamento, qtd: fechados.length, ticket, conv, cancelados, markup };
  }, [orcs]);

  const evolucao = useMemo(() => {
    const map = new Map<number, number>();
    const ano = new Date().getFullYear();
    for (let i = 0; i < 12; i++) map.set(i, 0);
    orcs.filter((o) => ["aprovado","fechado","convertido","confirmado"].includes(o.status)).forEach((o) => {
      const d = new Date(o.created_at);
      if (d.getFullYear() === ano) {
        map.set(d.getMonth(), (map.get(d.getMonth()) || 0) + Number(o.total || 0));
      }
    });
    return Array.from(map.entries()).map(([m, v]) => ({ mes: meses[m], valor: v }));
  }, [orcs]);

  const topParceiros = useMemo(() => {
    const map = new Map<string, { nome: string; total: number }>();
    parceiros.forEach((p) => {
      const id = p.parceiro_id;
      const nome = p.parceiros?.nome || "—";
      const cur = map.get(id) || { nome, total: 0 };
      cur.total += Number(p.valor_calculado || 0);
      map.set(id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [parceiros]);

  const ultimosFechamentos = useMemo(() => {
    return orcs
      .filter((o) => ["aprovado","fechado","convertido","confirmado"].includes(o.status))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
  }, [orcs]);

  const maxTopParc = topParceiros[0]?.total || 1;

  const TIPO_AGENDA_LABEL: Record<string, string> = {
    apresentacao: "Apresentações",
    retorno: "Retornos",
    medicao_orcamento: "Medições de Orçamento",
    revisao_final: "Revisões",
    medicao_tecnica: "Medições Técnicas",
    entrega: "Entregas",
    montagem: "Montagens",
  };

  const agendasPorTipo = useMemo(() => {
    const map = new Map<string, number>();
    agendas.forEach((a) => {
      const k = a.tipo || "—";
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Object.keys(TIPO_AGENDA_LABEL)
      .map((k) => ({ tipo: k, label: TIPO_AGENDA_LABEL[k], total: map.get(k) || 0 }))
      .sort((a, b) => b.total - a.total);
  }, [agendas]);

  const totalAgendas = agendas.length;
  const maxAgenda = agendasPorTipo[0]?.total || 1;


  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary/15 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1>Relatórios Gerenciais</h1>
            <p className="text-[12px] text-muted-foreground mt-1">Análise de desempenho comercial</p>
          </div>
        </div>
        <div className="inline-flex rounded-md p-1 bg-secondary" style={{ border: "0.5px solid hsl(var(--border))" }}>
          {[
            { v: "mes", label: "Este Mês" },
            { v: "ano", label: "Este Ano" },
            { v: "tudo", label: "Tudo" },
            { v: "personalizado", label: "Personalizado" },
          ].map((p) => (
            <button
              key={p.v}
              onClick={() => setPeriodo(p.v as Periodo)}
              className={`px-3 py-1.5 text-[12px] rounded transition-colors ${
                periodo === p.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiBig icon={<DollarSign className="w-4 h-4" />} color="primary" label="Faturamento" value={fmtBRL(kpi.faturamento)} badge="Ativo" />
        <KpiBig icon={<Calculator className="w-4 h-4" />} color="emerald" label="Markup Médio" value={`${kpi.markup.toFixed(1)}%`} badge="Real" />
        <KpiBig icon={<TrendingUp className="w-4 h-4" />} color="primary" label="Ticket Médio" value={fmtBRL(kpi.ticket)} badge={`${kpi.qtd} ctt.`} />
        <KpiBig icon={<PieIcon className="w-4 h-4" />} color="primary" label="Conversão" value={`${kpi.conv.toFixed(0)}%`} badge="Conv." />
        <KpiBig icon={<TrendingDown className="w-4 h-4" />} color="rose" label="Cancelados" value={String(kpi.cancelados)} badge="Perdidos" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="surface-card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded bg-primary/15 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-[14px] font-medium">Evolução de Vendas</div>
          </div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded bg-primary/15 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-[14px] font-medium">Top Parceiros</div>
          </div>
          {topParceiros.length === 0 ? (
            <div className="text-[12px] text-muted-foreground text-center py-8">Sem comissões.</div>
          ) : (
            <div className="space-y-3">
              {topParceiros.map((p, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground w-4">{i + 1}</span>
                      <span className="font-medium truncate">{p.nome}</span>
                    </div>
                    <span className="text-[11px] text-primary font-medium whitespace-nowrap">{fmtBRL(p.total)}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(p.total / maxTopParc) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-primary/15 flex items-center justify-center">
              <CalendarDays className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-[14px] font-medium">Agendamentos por Tipo</div>
          </div>
          <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-primary/15 text-primary">
            {totalAgendas} no período
          </span>
        </div>
        {totalAgendas === 0 ? (
          <div className="text-[12px] text-muted-foreground text-center py-6">Nenhum agendamento no período.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            {agendasPorTipo.map((a) => (
              <div key={a.tipo}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium">{a.label}</span>
                  <span className="text-[11px] text-primary font-medium whitespace-nowrap">{a.total}</span>
                </div>
                <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(a.total / maxAgenda) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        {loading ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">Carregando…</div>
        ) : ultimosFechamentos.length === 0 ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">Nenhum fechamento no período.</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 px-2 font-normal uppercase text-[10px] tracking-wider">Data</th>
                <th className="py-2 px-2 font-normal uppercase text-[10px] tracking-wider">Código</th>
                <th className="py-2 px-2 font-normal uppercase text-[10px] tracking-wider">Status</th>
                <th className="py-2 px-2 font-normal uppercase text-[10px] tracking-wider text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {ultimosFechamentos.map((o) => (
                <tr key={o.id} className="border-b border-border/50">
                  <td className="py-2 px-2">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="py-2 px-2 font-medium">{o.codigo}</td>
                  <td className="py-2 px-2 text-muted-foreground capitalize">{o.status}</td>
                  <td className="py-2 px-2 text-right font-medium">{fmtBRL(Number(o.total || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiBig({ icon, color, label, value, badge }: { icon: React.ReactNode; color: "primary" | "emerald" | "rose"; label: string; value: string; badge: string }) {
  const colors: Record<string, { bg: string; fg: string; badgeBg: string; badgeFg: string }> = {
    primary: { bg: "bg-primary/15", fg: "text-primary", badgeBg: "bg-primary/15", badgeFg: "text-primary" },
    emerald: { bg: "bg-emerald-500/15", fg: "text-emerald-500", badgeBg: "bg-emerald-500/15", badgeFg: "text-emerald-500" },
    rose: { bg: "bg-rose-500/15", fg: "text-rose-500", badgeBg: "bg-rose-500/15", badgeFg: "text-rose-500" },
  };
  const c = colors[color];
  return (
    <div className="surface-card p-4">
      <div className="flex items-start justify-between">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${c.bg} ${c.fg}`}>{icon}</div>
        <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${c.badgeBg} ${c.badgeFg}`}>{badge}</span>
      </div>
      <div className="text-[10px] uppercase text-muted-foreground tracking-wider mt-3">{label}</div>
      <div className="text-[20px] font-medium mt-1">{value}</div>
    </div>
  );
}
