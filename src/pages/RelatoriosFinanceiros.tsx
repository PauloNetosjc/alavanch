import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download, Printer, Search, X, FileBarChart, TrendingUp, TrendingDown } from "lucide-react";
import { LojasFilter } from "@/components/financeiro/LojasFilter";
import { useLoja } from "@/contexts/LojaContext";
import { BRL } from "@/lib/financeiro";
import {
  enrich, groupBy, totalize,
  type LancRaw, type Cat, type CC, type Conta,
} from "@/lib/relatoriosFinanceiros";
import GroupedReport from "@/components/relatorios/GroupedReport";
import DespesasMesAMes from "@/components/relatorios/DespesasMesAMes";
import ReceitaPorPedido from "@/components/relatorios/ReceitaPorPedido";
import { exportGrupos, exportLancs, imprimirRelatorio } from "@/lib/exportRelatorios";

type EntidadeOpt = { id: string; nome: string; tipo: "cliente" | "fornecedor" | "parceiro" };

function defaultPeriodo() {
  const t = new Date();
  const ini = new Date(t.getFullYear(), t.getMonth(), 1).toISOString().slice(0, 10);
  const fim = new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { ini, fim };
}

export default function RelatoriosFinanceiros() {
  const nav = useNavigate();
  const { selectedLojaId } = useLoja();
  const { ini, fim } = defaultPeriodo();
  const [dtIni, setDtIni] = useState(ini);
  const [dtFim, setDtFim] = useState(fim);
  const [lojasFiltro, setLojasFiltro] = useState<string[]>([]);
  const [catFiltro, setCatFiltro] = useState("");
  const [subFiltro, setSubFiltro] = useState("");
  const [ccFiltro, setCcFiltro] = useState("");
  const [contaFiltro, setContaFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [tipoEntidadeFiltro, setTipoEntidadeFiltro] = useState("todos");
  const [entidadeFiltro, setEntidadeFiltro] = useState("");
  const [formaFiltro, setFormaFiltro] = useState("");
  const [dreFiltro, setDreFiltro] = useState("todos");
  const [tab, setTab] = useState("desp_cat");

  const [loading, setLoading] = useState(false);
  const [lancs, setLancs] = useState<LancRaw[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [centros, setCentros] = useState<CC[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [entidades, setEntidades] = useState<EntidadeOpt[]>([]);
  const [formas, setFormas] = useState<string[]>([]);

  useEffect(() => {
    if (selectedLojaId) setLojasFiltro([selectedLojaId]);
  }, [selectedLojaId]);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: cc }, { data: ct }, { data: cli }, { data: forn }, { data: par }] = await Promise.all([
        supabase.from("categorias_financeiras").select("id, nome, parent_id, contabilizar_dre"),
        supabase.from("centros_custo").select("id, nome").eq("ativo", true).order("ordem"),
        supabase.from("contas_bancarias").select("id, nome"),
        supabase.from("clientes").select("id, nome").limit(2000),
        supabase.from("fornecedores").select("id, nome").limit(2000),
        supabase.from("parceiros").select("id, nome").limit(2000),
      ]);
      setCats((c as Cat[]) || []);
      setCentros((cc as CC[]) || []);
      setContas((ct as Conta[]) || []);
      const ents: EntidadeOpt[] = [
        ...((cli as any[]) || []).map((x) => ({ id: x.id, nome: x.nome, tipo: "cliente" as const })),
        ...((forn as any[]) || []).map((x) => ({ id: x.id, nome: x.nome, tipo: "fornecedor" as const })),
        ...((par as any[]) || []).map((x) => ({ id: x.id, nome: x.nome, tipo: "parceiro" as const })),
      ];
      setEntidades(ents);
    })();
  }, []);

  async function buscar() {
    setLoading(true);
    let q = supabase
      .from("lancamentos_financeiros")
      .select("id, tipo, descricao, valor, data_vencimento, data_pagamento, status, categoria_id, centro_custo_id, conta_id, pedido_id, loja_id, entidade_tipo, entidade_id, entidade_nome, forma_pagamento_prevista")
      .gte("data_vencimento", dtIni)
      .lte("data_vencimento", dtFim);
    if (lojasFiltro.length) q = q.in("loja_id", lojasFiltro);
    const { data } = await q.order("data_vencimento", { ascending: false }).limit(10000);
    setLancs((data as LancRaw[]) || []);
    const fms = Array.from(new Set(((data as any[]) || []).map((x) => x.forma_pagamento_prevista).filter(Boolean)));
    setFormas(fms as string[]);
    setLoading(false);
  }

  useEffect(() => { buscar(); /* eslint-disable-next-line */ }, []);

  const enriched = useMemo(() => enrich(lancs, cats, centros, contas), [lancs, cats, centros, contas]);

  const filtrado = useMemo(() => {
    return enriched.filter((l) => {
      if (catFiltro) {
        if (l.categoria_id !== catFiltro && l.parentCategoriaId !== catFiltro) return false;
      }
      if (subFiltro && l.categoria_id !== subFiltro) return false;
      if (ccFiltro) {
        if (ccFiltro === "__none" ? !!l.centro_custo_id : l.centro_custo_id !== ccFiltro) return false;
      }
      if (contaFiltro && l.conta_id !== contaFiltro) return false;
      if (statusFiltro !== "todos") {
        if (statusFiltro === "pagos" && l.statusDerivado !== "pago") return false;
        if (statusFiltro === "nao_pagos" && l.statusDerivado === "pago") return false;
        if (statusFiltro === "vencidos" && l.statusDerivado !== "vencido") return false;
        if (statusFiltro === "pendentes" && l.statusDerivado !== "pendente") return false;
      }
      if (tipoEntidadeFiltro !== "todos" && l.entidade_tipo !== tipoEntidadeFiltro) return false;
      if (entidadeFiltro && l.entidade_id !== entidadeFiltro) return false;
      if (formaFiltro) {
        if (formaFiltro === "__none" ? !!l.forma_pagamento_prevista : l.forma_pagamento_prevista !== formaFiltro) return false;
      }
      if (dreFiltro === "dre" && !l.contabilizarDre) return false;
      if (dreFiltro === "nao_dre" && l.contabilizarDre) return false;
      return true;
    });
  }, [enriched, catFiltro, subFiltro, ccFiltro, contaFiltro, statusFiltro, tipoEntidadeFiltro, entidadeFiltro, formaFiltro, dreFiltro]);

  const receitas = useMemo(() => filtrado.filter((l) => l.natureza === "receita"), [filtrado]);
  const despesas = useMemo(() => filtrado.filter((l) => l.natureza === "despesa"), [filtrado]);

  const totR = useMemo(() => totalize(receitas), [receitas]);
  const totD = useMemo(() => totalize(despesas), [despesas]);
  const resultado = totR.total - totD.total;
  const margem = totR.total ? (resultado / totR.total) * 100 : 0;

  function limparFiltros() {
    setCatFiltro(""); setSubFiltro(""); setCcFiltro(""); setContaFiltro("");
    setStatusFiltro("todos"); setTipoEntidadeFiltro("todos"); setEntidadeFiltro("");
    setFormaFiltro(""); setDreFiltro("todos");
    const p = defaultPeriodo(); setDtIni(p.ini); setDtFim(p.fim);
  }

  // Agregações para cada relatório
  const desp_cat = useMemo(() => groupBy(despesas, (r) => ({
    key: (r.parentCategoriaId || "_") + ":" + (r.categoria_id || "_"),
    label: r.categoriaNome,
    sub: r.subcategoriaNome,
  })), [despesas]);

  const desp_contato = useMemo(() => groupBy(despesas, (r) => ({
    key: r.entidade_id || "__sem__",
    label: r.entidade_nome || "Sem contato",
    sub: r.entidade_tipo,
  })), [despesas]);

  const desp_cc = useMemo(() => groupBy(despesas, (r) => ({
    key: r.centro_custo_id || "__sem__",
    label: r.centroCustoNome,
  })), [despesas]);

  const rec_contato = useMemo(() => groupBy(receitas, (r) => ({
    key: r.entidade_id || "__sem__",
    label: r.entidade_nome || "Sem contato",
    sub: r.entidade_tipo,
  })), [receitas]);

  const rec_cat = useMemo(() => groupBy(receitas, (r) => ({
    key: (r.parentCategoriaId || "_") + ":" + (r.categoria_id || "_"),
    label: r.categoriaNome,
    sub: r.subcategoriaNome,
  })), [receitas]);

  // Export contextual
  function exportarAtual() {
    const map: Record<string, () => void> = {
      desp_cat: () => exportGrupos(desp_cat, "Despesas por Categoria", "relatorio_despesas_por_categoria.xlsx"),
      desp_mes: () => exportLancs(despesas, "Despesas Mês a Mês", "relatorio_despesas_mes_a_mes.xlsx"),
      desp_contato: () => exportGrupos(desp_contato, "Despesas por Contato", "relatorio_despesas_por_contato.xlsx"),
      desp_cc: () => exportGrupos(desp_cc, "Despesas por Centro de Custo", "relatorio_despesas_por_centro_custo.xlsx"),
      rec_pedido: () => exportLancs(receitas, "Receita por Pedido (lançamentos)", "relatorio_receita_por_pedido.xlsx"),
      rec_contato: () => exportGrupos(rec_contato, "Receitas por Contato", "relatorio_receitas_por_contato.xlsx"),
      rec_cat: () => exportGrupos(rec_cat, "Receitas por Categoria", "relatorio_receitas_por_categoria.xlsx"),
    };
    map[tab]?.();
  }

  function imprimirAtual() {
    const titulos: Record<string, string> = {
      desp_cat: "Despesas por Categoria",
      desp_mes: "Despesas Previstas Mês a Mês",
      desp_contato: "Despesas por Contato",
      desp_cc: "Despesas por Centro de Custo",
      rec_pedido: "Receita por Pedido",
      rec_contato: "Receitas por Contato",
      rec_cat: "Receitas por Categoria",
    };
    const filtros = `Período: ${dtIni} a ${dtFim}${statusFiltro !== "todos" ? ` · Status: ${statusFiltro}` : ""}`;
    const grupos: Record<string, any> = { desp_cat, desp_contato, desp_cc, rec_contato, rec_cat };
    const g = grupos[tab];
    let table = "";
    if (g) {
      table = `<table><thead><tr><th>${tab.startsWith("desp_cc") ? "Centro de Custo" : tab.includes("contato") ? "Contato" : "Categoria"}</th><th>Subgrupo</th><th class="right">Total</th><th class="right">Pago</th><th class="right">Pendente</th><th class="right">Vencido</th><th class="right">%</th><th class="right">Qtd</th></tr></thead><tbody>${
        (g as any[]).map((x) => `<tr class="group"><td>${x.label}</td><td>${x.sub || ""}</td><td class="right">${BRL(x.totals.total)}</td><td class="right">${BRL(x.totals.pago)}</td><td class="right">${BRL(x.totals.pendente)}</td><td class="right">${BRL(x.totals.vencido)}</td><td class="right">${x.pct.toFixed(1)}%</td><td class="right">${x.totals.qtd}</td></tr>`).join("")
      }</tbody></table>`;
    } else {
      const list = tab === "rec_pedido" ? receitas : despesas;
      table = `<table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Contato</th><th class="right">Valor</th><th>Status</th></tr></thead><tbody>${
        list.map((l) => `<tr><td>${l.data_vencimento || ""}</td><td>${(l.descricao || "").replace(/</g, "&lt;")}</td><td>${l.categoriaNome}</td><td>${l.entidade_nome || ""}</td><td class="right">${BRL(Number(l.valor))}</td><td>${l.statusDerivado}</td></tr>`).join("")
      }</tbody></table>`;
    }
    const cards = `<div class="meta">${filtros} · Receitas: ${BRL(totR.total)} · Despesas: ${BRL(totD.total)} · Resultado: ${BRL(resultado)}</div>`;
    imprimirRelatorio(cards + table, titulos[tab]);
  }

  const subcats = useMemo(() => cats.filter((c) => c.parent_id === catFiltro), [cats, catFiltro]);
  const entidadesFiltradas = useMemo(() => {
    if (tipoEntidadeFiltro === "todos") return entidades;
    return entidades.filter((e) => e.tipo === tipoEntidadeFiltro);
  }, [entidades, tipoEntidadeFiltro]);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap noprint">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => nav("/financeiro")}><ArrowLeft className="w-4 h-4" /></Button>
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <FileBarChart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Relatórios Financeiros</h1>
            <p className="text-sm text-muted-foreground">
              Análise de receitas, despesas, categorias, contatos, centros de custo e resultado por pedido.
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <LojasFilter value={lojasFiltro} onChange={setLojasFiltro} />
          <Button variant="outline" onClick={exportarAtual}><Download className="w-4 h-4 mr-1" /> Excel</Button>
          <Button variant="outline" onClick={imprimirAtual}><Printer className="w-4 h-4 mr-1" /> Imprimir</Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border bg-card p-3 noprint">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Data inicial</div>
            <Input type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Data final</div>
            <Input type="date" value={dtFim} onChange={(e) => setDtFim(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Categoria</div>
            <Select value={catFiltro || "all"} onValueChange={(v) => { setCatFiltro(v === "all" ? "" : v); setSubFiltro(""); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {cats.filter((c) => !c.parent_id).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Subcategoria</div>
            <Select value={subFiltro || "all"} onValueChange={(v) => setSubFiltro(v === "all" ? "" : v)} disabled={!catFiltro}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {subcats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Centro de custo</div>
            <Select value={ccFiltro || "all"} onValueChange={(v) => setCcFiltro(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="__none">Sem centro</SelectItem>
                {centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Conta bancária</div>
            <Select value={contaFiltro || "all"} onValueChange={(v) => setContaFiltro(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Status</div>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pagos">Pagos / Recebidos</SelectItem>
                <SelectItem value="nao_pagos">Não pagos / Não recebidos</SelectItem>
                <SelectItem value="vencidos">Vencidos</SelectItem>
                <SelectItem value="pendentes">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Tipo de entidade</div>
            <Select value={tipoEntidadeFiltro} onValueChange={(v) => { setTipoEntidadeFiltro(v); setEntidadeFiltro(""); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="fornecedor">Fornecedor</SelectItem>
                <SelectItem value="parceiro">Parceiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Contato / Entidade</div>
            <Select value={entidadeFiltro || "all"} onValueChange={(v) => setEntidadeFiltro(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {entidadesFiltradas.slice(0, 500).map((e) => (
                  <SelectItem key={`${e.tipo}-${e.id}`} value={e.id}>{e.nome} <span className="text-[10px] text-muted-foreground">({e.tipo})</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Forma pgto.</div>
            <Select value={formaFiltro || "all"} onValueChange={(v) => setFormaFiltro(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="__none">Não informado</SelectItem>
                {formas.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground mb-1">DRE</div>
            <Select value={dreFiltro} onValueChange={setDreFiltro}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="dre">Apenas contabiliza</SelectItem>
                <SelectItem value="nao_dre">Não contabiliza</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={buscar} disabled={loading}><Search className="w-3 h-3 mr-1" /> Buscar</Button>
          <Button size="sm" variant="ghost" onClick={limparFiltros}><X className="w-3 h-3 mr-1" /> Limpar filtros</Button>
          {loading && <span className="text-xs text-muted-foreground self-center">Carregando...</span>}
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
        <KpiSmall label="Receitas" valor={totR.total} cor="text-emerald-700" icon={<TrendingUp className="w-4 h-4" />} />
        <KpiSmall label="Despesas" valor={totD.total} cor="text-rose-700" icon={<TrendingDown className="w-4 h-4" />} />
        <KpiSmall label="Resultado" valor={resultado} cor={resultado >= 0 ? "text-emerald-700" : "text-rose-700"} />
        <KpiSmall label="Margem %" texto={`${margem.toFixed(1)}%`} cor={margem >= 0 ? "text-emerald-700" : "text-rose-700"} />
        <KpiSmall label="Recebidas" valor={totR.pago} />
        <KpiSmall label="Receitas pendentes" valor={totR.pendente} />
        <KpiSmall label="Pagas" valor={totD.pago} />
        <KpiSmall label="Despesas pendentes" valor={totD.pendente} />
        <KpiSmall label="Despesas vencidas" valor={totD.vencido} cor="text-rose-700" />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="noprint">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="desp_cat">Despesas · Categoria</TabsTrigger>
          <TabsTrigger value="desp_mes">Despesas · Mês a Mês</TabsTrigger>
          <TabsTrigger value="desp_contato">Despesas · Contato</TabsTrigger>
          <TabsTrigger value="desp_cc">Despesas · Centro de Custo</TabsTrigger>
          <TabsTrigger value="rec_pedido">Receita por Pedido</TabsTrigger>
          <TabsTrigger value="rec_contato">Receitas · Contato</TabsTrigger>
          <TabsTrigger value="rec_cat">Receitas · Categoria</TabsTrigger>
        </TabsList>
        <TabsContent value="desp_cat"><GroupedReport titulo="Despesas por Categoria" grupos={desp_cat} groupLabel="Categoria" natureza="despesa" /></TabsContent>
        <TabsContent value="desp_mes"><DespesasMesAMes lancs={despesas} /></TabsContent>
        <TabsContent value="desp_contato"><GroupedReport titulo="Despesas por Contato" grupos={desp_contato} groupLabel="Contato" natureza="despesa" /></TabsContent>
        <TabsContent value="desp_cc"><GroupedReport titulo="Despesas por Centro de Custo" grupos={desp_cc} groupLabel="Centro de Custo" natureza="despesa" /></TabsContent>
        <TabsContent value="rec_pedido"><ReceitaPorPedido dtIni={dtIni} dtFim={dtFim} lojaIds={lojasFiltro} /></TabsContent>
        <TabsContent value="rec_contato"><GroupedReport titulo="Receitas por Contato" grupos={rec_contato} groupLabel="Contato" natureza="receita" /></TabsContent>
        <TabsContent value="rec_cat"><GroupedReport titulo="Receitas por Categoria" grupos={rec_cat} groupLabel="Categoria" natureza="receita" /></TabsContent>
      </Tabs>
    </div>
  );
}

function KpiSmall({ label, valor, texto, cor = "text-foreground", icon }: { label: string; valor?: number; texto?: string; cor?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon} {label}</div>
        <div className={`text-base font-bold ${cor}`}>{texto ?? BRL(valor || 0)}</div>
      </CardContent>
    </Card>
  );
}
