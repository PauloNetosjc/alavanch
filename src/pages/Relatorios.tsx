import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { DollarSign, Calculator, TrendingUp, PieChart as PieIcon, TrendingDown, Users, BarChart3, CalendarDays, Wallet, ChevronDown } from "lucide-react";
import { useLoja } from "@/contexts/LojaContext";
import { PageFilters, defaultPeriodoAno, resolvePeriodo, PeriodoState } from "@/components/PageFilters";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const meses = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

const TIPO_AGENDA_LABEL: Record<string, string> = {
  apresentacao_comercial: "Apresentações",
  retorno: "Retornos",
  medicao_orcamento: "Medições de Orçamento",
  revisao_final: "Revisões",
  medicao_tecnica: "Medições Técnicas",
  entrega: "Entregas",
  montagem: "Montagens",
  tarefa_interna: "Tarefas Internas",
};

export default function Relatorios() {
  const { selectedLojaId } = useLoja();
  const [periodo, setPeriodo] = useState<PeriodoState>(defaultPeriodoAno());
  const [lojasFiltro, setLojasFiltro] = useState<string[]>(selectedLojaId ? [selectedLojaId] : []);
  useEffect(() => { setLojasFiltro(selectedLojaId ? [selectedLojaId] : []); }, [selectedLojaId]);
  const [orcs, setOrcs] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [parceiros, setParceiros] = useState<any[]>([]);
  const [agendas, setAgendas] = useState<any[]>([]);
  const [origens, setOrigens] = useState<{ id: string; nome: string }[]>([]);
  const [origensSel, setOrigensSel] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const { inicio, fim } = useMemo(() => resolvePeriodo(periodo), [periodo]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let qOrc = supabase.from("orcamentos").select("id, codigo, total, status, created_at, parceiro_id, cliente_id, loja_id, origem_id, ambientes(custo_loja,custo_fabrica,custo_aquisicao,preco_sugerido)");
      let qPed = supabase.from("pedidos").select("id, codigo, valor_total, juros_total, rt_repassado, is_adendo, is_complemento, status, created_at, cliente_id, loja_id, orcamento_id, orcamentos(origem_id, desconto_valor, ambientes(custo_loja,custo_fabrica,custo_aquisicao,preco_sugerido))");
      let qPar = supabase.from("parceiro_comissoes" as any).select("parceiro_id, valor_calculado, loja_id, parceiros(nome)");
      let qAge = supabase.from("agenda_eventos" as any).select("id, tipo, data, status, loja_id, orcamento_id, pedido_id");

      if (inicio && fim) {
        qOrc = qOrc.gte("created_at", inicio.toISOString()).lte("created_at", fim.toISOString());
        qPed = qPed.gte("created_at", inicio.toISOString()).lte("created_at", fim.toISOString());
        qAge = qAge.gte("data", inicio.toISOString().slice(0, 10)).lte("data", fim.toISOString().slice(0, 10));
      }
      if (lojasFiltro.length > 0) {
        qOrc = qOrc.in("loja_id", lojasFiltro);
        qPed = qPed.in("loja_id", lojasFiltro);
        qPar = qPar.in("loja_id", lojasFiltro);
        qAge = qAge.in("loja_id", lojasFiltro);
      }

      const [{ data: o }, { data: p }, { data: pc }, { data: ag }, { data: ors }] = await Promise.all([
        qOrc, qPed, qPar, qAge,
        supabase.from("origens_lead" as any).select("id, nome").order("nome"),
      ]);
      setOrcs(o || []);
      setPedidos(p || []);
      setParceiros((pc as any[]) || []);
      setAgendas((ag as any[]) || []);
      const orig = (ors as any[]) || [];
      setOrigens(orig);
      if (origensSel.length === 0) setOrigensSel(orig.map((x) => x.id));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, lojasFiltro]);

  // ===== KPIs gerais =====
  const kpi = useMemo(() => {
    // Conversão considera apenas PEDIDOS (sem adendo/complemento)
    const orcsPedido = orcs.filter((o: any) => !o.is_adendo && !o.is_complemento);
    const fechadosPed = orcsPedido.filter((o) => ["aprovado", "fechado", "convertido", "confirmado"].includes(o.status));
    const cancelados = orcs.filter((o) => o.status === "cancelado").length;
    const conv = orcsPedido.length ? (fechadosPed.length / orcsPedido.length) * 100 : 0;

    const bruto = pedidos.reduce((s, p) => s + Number(p.valor_total || 0), 0);
    const juros = pedidos.reduce((s, p) => s + Number(p.juros_total || 0), 0);
    const rt = pedidos.reduce((s, p) => s + Number(p.rt_repassado || 0), 0);
    const liquido = bruto - juros - rt;
    let custoTotal = 0;
    pedidos.forEach((p) => (p.orcamentos?.ambientes || []).forEach((a: any) => {
      custoTotal += Number(a.custo_loja || a.custo_fabrica || a.custo_aquisicao || 0);
    }));
    const margemValor = liquido - custoTotal;
    const margemPerc = liquido > 0 ? (margemValor / liquido) * 100 : 0;

    // Ticket médio: apenas contratos (PV)
    const pvs = pedidos.filter((p) => !p.is_adendo && !p.is_complemento);
    const brutoPv = pvs.reduce((s, p) => s + Number(p.valor_total || 0), 0);
    const ticket = pvs.length ? brutoPv / pvs.length : 0;

    const descontoTotal = pedidos.reduce((s, p) => s + Number(p.orcamentos?.desconto_valor || 0), 0);

    return { bruto, liquido, juros, rt, custoTotal, margemValor, margemPerc, ticket, qtdPv: pvs.length, qtd: pedidos.length, conv, cancelados, fechadosPed: fechadosPed.length, totalOrcPed: orcsPedido.length, descontoTotal };
  }, [orcs, pedidos]);

  // ===== Tabela por tipo (PV / AD / CP) =====
  const porTipo = useMemo(() => {
    const buckets = [
      { tipo: "Pedido", code: "PV", match: (p: any) => !p.is_adendo && !p.is_complemento },
      { tipo: "Adendo", code: "AD", match: (p: any) => !!p.is_adendo },
      { tipo: "Complemento", code: "CP", match: (p: any) => !!p.is_complemento },
    ];
    return buckets.map((b) => {
      const arr = pedidos.filter(b.match);
      const bruto = arr.reduce((s, p) => s + Number(p.valor_total || 0), 0);
      const juros = arr.reduce((s, p) => s + Number(p.juros_total || 0), 0);
      const rt = arr.reduce((s, p) => s + Number(p.rt_repassado || 0), 0);
      const liq = bruto - juros - rt;
      let custo = 0;
      arr.forEach((p) => (p.orcamentos?.ambientes || []).forEach((a: any) => {
        custo += Number(a.custo_loja || a.custo_fabrica || a.custo_aquisicao || 0);
      }));
      const margem = liq > 0 ? ((liq - custo) / liq) * 100 : 0;
      const ticket = arr.length ? bruto / arr.length : 0;
      const desconto = arr.reduce((s, p) => s + Number(p.orcamentos?.desconto_valor || 0), 0);
      return { ...b, qtd: arr.length, bruto, liquido: liq, juros, rt, custo, margem, margemValor: liq - custo, ticket, desconto };
    });
  }, [pedidos]);

  const evolucao = useMemo(() => {
    const map = new Map<number, number>();
    const ano = (inicio || new Date()).getFullYear();
    for (let i = 0; i < 12; i++) map.set(i, 0);
    pedidos.forEach((p) => {
      const d = new Date(p.created_at);
      if (d.getFullYear() === ano) map.set(d.getMonth(), (map.get(d.getMonth()) || 0) + Number(p.valor_total || 0));
    });
    return Array.from(map.entries()).map(([m, v]) => ({ mes: meses[m], valor: v }));
  }, [pedidos, inicio]);

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
  const maxTopParc = topParceiros[0]?.total || 1;

  // ===== Agendamentos por tipo (com filtro origem) =====
  const [tiposSelecionados, setTiposSelecionados] = useState<string[]>(Object.keys(TIPO_AGENDA_LABEL));
  const orcOrigemMap = useMemo(() => {
    const m = new Map<string, string | null>();
    orcs.forEach((o) => m.set(o.id, o.origem_id || null));
    pedidos.forEach((p) => p.orcamento_id && m.set(p.orcamento_id, p.orcamentos?.origem_id || null));
    return m;
  }, [orcs, pedidos]);

  const agendasFiltradas = useMemo(() => {
    return agendas.filter((a) => {
      if (origensSel.length === origens.length) return true; // todas
      const oid = a.orcamento_id || (pedidos.find((p) => p.id === a.pedido_id)?.orcamento_id);
      const origem = oid ? orcOrigemMap.get(oid) : null;
      if (!origem) return origensSel.includes("__sem__");
      return origensSel.includes(origem);
    });
  }, [agendas, origensSel, origens, pedidos, orcOrigemMap]);

  const agendasPorTipo = useMemo(() => {
    const map = new Map<string, number>();
    agendasFiltradas.forEach((a) => {
      const k = a.tipo || "—";
      if (!tiposSelecionados.includes(k)) return;
      map.set(k, (map.get(k) || 0) + 1);
    });
    return tiposSelecionados
      .map((k) => ({ tipo: k, label: TIPO_AGENDA_LABEL[k] || k, total: map.get(k) || 0 }))
      .sort((a, b) => b.total - a.total);
  }, [agendasFiltradas, tiposSelecionados]);

  const totalAgendas = agendasPorTipo.reduce((s, a) => s + a.total, 0);
  const maxAgenda = agendasPorTipo[0]?.total || 1;

  const toggleTipo = (k: string) =>
    setTiposSelecionados((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const toggleOrigem = (id: string) =>
    setOrigensSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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
        <PageFilters value={periodo} onChange={setPeriodo} lojas={lojasFiltro} onLojasChange={setLojasFiltro} />
      </div>

      {/* KPIs gerais */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5" />
          <span className="font-medium text-foreground">Resumo Geral</span>
          <span>· todos os pedidos do período</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <KpiBig icon={<DollarSign className="w-4 h-4" />} color="primary" label="Faturamento Bruto" value={fmtBRL(kpi.bruto)} badge="Bruto" hint={`Juros previstos: ${fmtBRL(kpi.juros)}`} />
          <KpiBig icon={<Wallet className="w-4 h-4" />} color="emerald" label="Faturamento Líquido" value={fmtBRL(kpi.liquido)} badge="− juros − RT" hint={`RT indicação: ${fmtBRL(kpi.rt)}`} />
          <KpiBig icon={<Calculator className="w-4 h-4" />} color="emerald" label="Margem Líquida" value={fmtBRL(kpi.margemValor)} badge={`${kpi.margemPerc.toFixed(1)}%`} hint={`Custo previsto: ${fmtBRL(kpi.custoTotal)}`} />
          <KpiBig icon={<TrendingUp className="w-4 h-4" />} color="primary" label="Ticket Médio" value={fmtBRL(kpi.ticket)} badge={`${kpi.qtdPv} contratos`} hint="Somente PV (sem adendo/complemento)" />
          <KpiBig icon={<PieIcon className="w-4 h-4" />} color="primary" label="Conversão" value={`${kpi.conv.toFixed(0)}%`} badge="Conv." hint={`${kpi.fechadosPed}/${kpi.totalOrcPed} orçamentos PV`} />
          <KpiBig icon={<TrendingDown className="w-4 h-4" />} color="rose" label="Cancelados" value={String(kpi.cancelados)} badge="Perdidos" hint={`Desconto aplicado: ${fmtBRL(kpi.descontoTotal)}`} />
        </div>
      </div>

      {/* KPIs por tipo de pedido (recolhíveis) */}
      <div className="space-y-2">
        {porTipo.map((t) => (
          <CollapsibleTipo
            key={t.code}
            tipo={t.tipo}
            code={t.code}
            qtd={t.qtd}
          >
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-2">
              <KpiBig icon={<DollarSign className="w-4 h-4" />} color="primary" label="Faturamento Bruto" value={fmtBRL(t.bruto)} badge="Bruto" hint={`Juros: ${fmtBRL(t.juros)}`} />
              <KpiBig icon={<Wallet className="w-4 h-4" />} color="emerald" label="Faturamento Líquido" value={fmtBRL(t.liquido)} badge="− juros − RT" hint={`RT: ${fmtBRL(t.rt)}`} />
              <KpiBig icon={<Calculator className="w-4 h-4" />} color="emerald" label="Margem Líquida" value={fmtBRL(t.margemValor)} badge={`${t.margem.toFixed(1)}%`} hint={`Custo: ${fmtBRL(t.custo)}`} />
              <KpiBig icon={<TrendingUp className="w-4 h-4" />} color="primary" label="Ticket Médio" value={fmtBRL(t.ticket)} badge={`${t.qtd}`} />
              <KpiBig icon={<PieIcon className="w-4 h-4" />} color="primary" label="Part. Bruto" value={kpi.bruto > 0 ? `${((t.bruto / kpi.bruto) * 100).toFixed(0)}%` : "—"} badge="Share" />
              <KpiBig icon={<TrendingDown className="w-4 h-4" />} color="rose" label="Desconto Negociação" value={fmtBRL(t.desconto)} badge="Desc." hint={`Deduções: ${fmtBRL(t.juros + t.rt)}`} />
            </div>
          </CollapsibleTipo>
        ))}
      </div>



      {/* Tabela por tipo (PV / AD / CP) */}
      <div className="surface-card p-5">
        <div className="text-[14px] font-medium mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Faturamento por tipo de pedido
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2 px-2 font-normal uppercase text-[10px] tracking-wider">Tipo</th>
              <th className="py-2 px-2 font-normal uppercase text-[10px] tracking-wider text-right">Qtd</th>
              <th className="py-2 px-2 font-normal uppercase text-[10px] tracking-wider text-right">Faturamento Bruto</th>
              <th className="py-2 px-2 font-normal uppercase text-[10px] tracking-wider text-right">Faturamento Líquido</th>
              <th className="py-2 px-2 font-normal uppercase text-[10px] tracking-wider text-right">Margem</th>
              <th className="py-2 px-2 font-normal uppercase text-[10px] tracking-wider text-right">Ticket Médio</th>
            </tr>
          </thead>
          <tbody>
            {porTipo.map((t) => (
              <tr key={t.code} className="border-b border-border/50">
                <td className="py-2 px-2">
                  <span className="font-medium">{t.tipo}</span>
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase tracking-wider">{t.code}</span>
                </td>
                <td className="py-2 px-2 text-right">{t.qtd}</td>
                <td className="py-2 px-2 text-right">{fmtBRL(t.bruto)}</td>
                <td className="py-2 px-2 text-right font-medium text-primary">{fmtBRL(t.liquido)}</td>
                <td className="py-2 px-2 text-right">{t.margem.toFixed(1)}%</td>
                <td className="py-2 px-2 text-right">{fmtBRL(t.ticket)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

        {/* filtro por tipo */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(TIPO_AGENDA_LABEL).map(([k, label]) => {
            const active = tiposSelecionados.includes(k);
            return (
              <button
                key={k}
                onClick={() => toggleTipo(k)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* filtro por origem do lead */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-[10px] uppercase text-muted-foreground tracking-wider mr-1">Origem:</span>
          {origens.map((o) => {
            const active = origensSel.includes(o.id);
            return (
              <button
                key={o.id}
                onClick={() => toggleOrigem(o.id)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {o.nome}
              </button>
            );
          })}
          <button
            onClick={() => toggleOrigem("__sem__")}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              origensSel.includes("__sem__")
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-transparent text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            Sem origem
          </button>
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

      {loading && <div className="text-[12px] text-muted-foreground py-3 text-center">Carregando…</div>}
    </div>
  );
}

function KpiBig({ icon, color, label, value, badge, hint }: { icon: React.ReactNode; color: "primary" | "emerald" | "rose"; label: string; value: string; badge: string; hint?: string }) {
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
      <div className="text-[18px] font-medium mt-1">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function CollapsibleTipo({ tipo, code, qtd, children }: { tipo: string; code: string; qtd: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="surface-card p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="font-medium text-foreground">{tipo}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">{code}</span>
          <span>· {qtd} {qtd === 1 ? "registro" : "registros"}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && children}
    </div>
  );
}
