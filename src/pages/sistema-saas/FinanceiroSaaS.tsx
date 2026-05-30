import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { toast } from "sonner";
import {
  Wallet, FileSpreadsheet, Loader2, Plus, FileSignature, Building2, ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";
import CobrancasSaaS from "@/pages/CobrancasSaaS";
import { SaaSLancamentosTab } from "@/components/sistema-saas/SaaSLancamentosTab";
import { SaaSBancosTab, SaaSCategoriasTab, SaaSCentrosCustoTab } from "@/components/sistema-saas/SaaSConfigTabs";
import { RelatoriosFinanceiroSaaS } from "@/components/sistema-saas/RelatoriosFinanceiroSaaS";

type Base = { id: string; nome: string; plano: string; status: string; sistema_saas_id: string | null };
type Sistema = { id: string; nome: string };
type Cobranca = {
  id: string; base_cliente_id: string; tipo_cobranca: string; valor: number;
  status: string; data_vencimento: string | null; data_pagamento: string | null;
  competencia_mes: number | null; competencia_ano: number | null;
};
type Assinatura = { id: string; base_cliente_id: string; valor_mensal: number; status_assinatura: string };
type Contrato = { id: string; base_cliente_id: string; status: string };
type Compra = {
  id: string; base_cliente_id: string; tipo: string; descricao: string | null;
  valor: number; data_compra: string; status_pagamento: string; observacoes: string | null;
};

const TIPOS_COMPRA = [
  "usuario_adicional", "loja_adicional", "modulo_extra", "armazenamento_adicional",
  "treinamento", "suporte", "customizacao", "integracao", "outro",
];
const STATUS_COMPRA = ["pendente", "pago", "cancelado"];
const STATUS_AGUARDA = ["aguardando_assinatura", "enviado_para_assinatura", "rascunho", "pendente_assinatura"];
const STATUS_OK = ["assinado", "anexado_manual"];

const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PALETTE = ["#0f5132", "#15803d", "#65a30d", "#ca8a04", "#a16207", "#0c4a6e", "#7c2d12", "#9333ea"];

function statusBadge(s: string) {
  const c: Record<string, string> = {
    pendente: "bg-amber-100 text-amber-800",
    pago: "bg-emerald-100 text-emerald-800",
    cancelado: "bg-zinc-200 text-zinc-700",
  };
  return <Badge className={`${c[s] || "bg-zinc-200 text-zinc-700"} border-0 capitalize`}>{s}</Badge>;
}

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "emerald" | "red" | "amber" }) {
  const toneClass = tone === "emerald" ? "text-emerald-700" : tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-base font-display mt-1 ${toneClass}`}>{value}</div>
    </Card>
  );
}

function Chart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-sm font-medium mb-2">{title}</div>
      {children}
    </Card>
  );
}

export default function FinanceiroSaaS() {
  const { user } = useAuth();
  const [bases, setBases] = useState<Base[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    const [b, s, c, a, ct, cp] = await Promise.all([
      supabase.from("bases_clientes" as any).select("id,nome,plano,status,sistema_saas_id").order("nome"),
      supabase.from("sistemas_saas" as any).select("id,nome").order("nome"),
      supabase.from("base_cobrancas" as any).select("id,base_cliente_id,tipo_cobranca,valor,status,data_vencimento,data_pagamento,competencia_mes,competencia_ano"),
      supabase.from("base_assinaturas" as any).select("id,base_cliente_id,valor_mensal,status_assinatura"),
      supabase.from("base_contratos" as any).select("id,base_cliente_id,status"),
      supabase.from("base_compras_avulsas" as any).select("*").order("data_compra", { ascending: false }),
    ]);
    setBases((b.data || []) as any);
    setSistemas((s.data || []) as any);
    setCobrancas((c.data || []) as any);
    setAssinaturas((a.data || []) as any);
    setContratos((ct.data || []) as any);
    setCompras((cp.data || []) as any);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const baseById = useMemo(() => Object.fromEntries(bases.map((b) => [b.id, b])), [bases]);
  const sistemaById = useMemo(() => Object.fromEntries(sistemas.map((s) => [s.id, s])), [sistemas]);

  // ---- Visão Geral KPIs ----
  const hoje = new Date().toISOString().slice(0, 10);
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();
  const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fimMes = `${ano}-${String(mes).padStart(2, "0")}-31`;

  const kpi = useMemo(() => {
    const noMes = cobrancas.filter((c) => c.data_vencimento && c.data_vencimento >= inicioMes && c.data_vencimento <= fimMes && c.status !== "cancelado");
    const previsto = noMes.reduce((s, c) => s + Number(c.valor || 0), 0);
    const recebido = cobrancas.filter((c) => c.data_pagamento && c.data_pagamento >= inicioMes && c.data_pagamento <= fimMes).reduce((s, c) => s + Number(c.valor || 0), 0);
    const aberto = cobrancas.filter((c) => c.status === "pendente").reduce((s, c) => s + Number(c.valor || 0), 0);
    const vencido = cobrancas.filter((c) => c.status === "pendente" && c.data_vencimento && c.data_vencimento < hoje).reduce((s, c) => s + Number(c.valor || 0), 0);
    const implantacao = cobrancas.filter((c) => c.tipo_cobranca === "implantacao" && c.status === "pendente").reduce((s, c) => s + Number(c.valor || 0), 0);
    const mensalidades = cobrancas.filter((c) => c.tipo_cobranca === "mensalidade" && c.status === "pendente").reduce((s, c) => s + Number(c.valor || 0), 0);
    const avulsas = cobrancas.filter((c) => !["mensalidade", "implantacao"].includes(c.tipo_cobranca) && c.status === "pendente").reduce((s, c) => s + Number(c.valor || 0), 0);
    const mrr = assinaturas.filter((a) => a.status_assinatura === "ativa").reduce((s, a) => s + Number(a.valor_mensal || 0), 0);
    const basesInad = new Set(cobrancas.filter((c) => c.status === "pendente" && c.data_vencimento && c.data_vencimento < hoje).map((c) => c.base_cliente_id)).size;
    const contratosAguarda = contratos.filter((c) => STATUS_AGUARDA.includes(c.status)).length;
    return { previsto, recebido, aberto, vencido, implantacao, mensalidades, avulsas, mrr, basesInad, contratosAguarda };
  }, [cobrancas, assinaturas, contratos, inicioMes, fimMes, hoje]);

  // ---- Gráficos ----
  const dadosMes = useMemo(() => {
    const m: Record<string, { mes: string; previsto: number; recebido: number }> = {};
    cobrancas.forEach((c) => {
      if (c.data_vencimento && c.status !== "cancelado") {
        const k = c.data_vencimento.slice(0, 7);
        if (!m[k]) m[k] = { mes: k, previsto: 0, recebido: 0 };
        m[k].previsto += Number(c.valor || 0);
      }
      if (c.data_pagamento) {
        const k = c.data_pagamento.slice(0, 7);
        if (!m[k]) m[k] = { mes: k, previsto: 0, recebido: 0 };
        m[k].recebido += Number(c.valor || 0);
      }
    });
    return Object.values(m).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12);
  }, [cobrancas]);

  const dadosStatus = useMemo(() => {
    const m: Record<string, number> = {};
    cobrancas.forEach((c) => { m[c.status] = (m[c.status] || 0) + Number(c.valor || 0); });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [cobrancas]);

  const dadosTipo = useMemo(() => {
    const m: Record<string, number> = {};
    cobrancas.forEach((c) => { m[c.tipo_cobranca] = (m[c.tipo_cobranca] || 0) + Number(c.valor || 0); });
    return Object.entries(m).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [cobrancas]);

  const dadosSistema = useMemo(() => {
    const m: Record<string, number> = {};
    cobrancas.filter((c) => c.status === "pago").forEach((c) => {
      const sid = baseById[c.base_cliente_id]?.sistema_saas_id;
      const nome = sid ? sistemaById[sid]?.nome || "—" : "Sem sistema";
      m[nome] = (m[nome] || 0) + Number(c.valor || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [cobrancas, baseById, sistemaById]);

  const dadosPlano = useMemo(() => {
    const m: Record<string, number> = {};
    cobrancas.filter((c) => c.status === "pago").forEach((c) => {
      const p = baseById[c.base_cliente_id]?.plano || "—";
      m[p] = (m[p] || 0) + Number(c.valor || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [cobrancas, baseById]);

  const inadimplenciaPorBase = useMemo(() => {
    const m: Record<string, number> = {};
    cobrancas.filter((c) => c.status === "pendente" && c.data_vencimento && c.data_vencimento < hoje).forEach((c) => {
      const nome = baseById[c.base_cliente_id]?.nome || "—";
      m[nome] = (m[nome] || 0) + Number(c.valor || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [cobrancas, baseById, hoje]);

  const mrrPorSistema = useMemo(() => {
    const m: Record<string, number> = {};
    assinaturas.filter((a) => a.status_assinatura === "ativa").forEach((a) => {
      const sid = baseById[a.base_cliente_id]?.sistema_saas_id;
      const nome = sid ? sistemaById[sid]?.nome || "—" : "Sem sistema";
      m[nome] = (m[nome] || 0) + Number(a.valor_mensal || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [assinaturas, baseById, sistemaById]);

  // ---- Compras Avulsas ----
  const [editingCompra, setEditingCompra] = useState<Compra | null>(null);
  const [novaCompra, setNovaCompra] = useState(false);
  const [filtroBaseCompra, setFiltroBaseCompra] = useState("todas");

  const comprasFiltradas = useMemo(() => {
    return compras.filter((c) => filtroBaseCompra === "todas" || c.base_cliente_id === filtroBaseCompra);
  }, [compras, filtroBaseCompra]);

  const salvarCompra = async (c: Partial<Compra>) => {
    if (!c.base_cliente_id || !c.tipo || !c.valor) { toast.error("Preencha base, tipo e valor"); return; }
    if (c.id) {
      const { error } = await supabase.from("base_compras_avulsas" as any).update({
        tipo: c.tipo, descricao: c.descricao, valor: c.valor, data_compra: c.data_compra,
        status_pagamento: c.status_pagamento, observacoes: c.observacoes, atualizado_por: user?.id ?? null,
      }).eq("id", c.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Compra atualizada");
    } else {
      const { error } = await supabase.from("base_compras_avulsas" as any).insert({
        base_cliente_id: c.base_cliente_id, tipo: c.tipo, descricao: c.descricao || null,
        valor: c.valor, data_compra: c.data_compra || new Date().toISOString().slice(0, 10),
        status_pagamento: c.status_pagamento || "pendente", observacoes: c.observacoes || null,
        criado_por: user?.id ?? null,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Compra criada");
    }
    setEditingCompra(null); setNovaCompra(false);
    carregar();
  };

  const marcarCompraPaga = async (c: Compra) => {
    const { error } = await supabase.from("base_compras_avulsas" as any).update({ status_pagamento: "pago", atualizado_por: user?.id ?? null }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Compra paga"); carregar();
  };

  const cancelarCompra = async (c: Compra) => {
    if (!confirm("Cancelar esta compra avulsa?")) return;
    const { error } = await supabase.from("base_compras_avulsas" as any).update({ status_pagamento: "cancelado", atualizado_por: user?.id ?? null }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cancelada"); carregar();
  };

  const gerarCobrancaAvulsa = async (c: Compra) => {
    if (!confirm("Gerar cobrança vinculada a esta compra avulsa?")) return;
    const { error } = await supabase.from("base_cobrancas" as any).insert({
      base_cliente_id: c.base_cliente_id,
      tipo_cobranca: "compra_avulsa",
      descricao: `${c.tipo.replace(/_/g, " ")}${c.descricao ? " - " + c.descricao : ""}`,
      valor: c.valor,
      data_vencimento: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: "pendente",
      criado_por: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Cobrança gerada"); carregar();
  };

  // ---- Relatórios export ----
  const exportRelatorio = (rows: any[], nome: string) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 30));
    XLSX.writeFile(wb, `${nome}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const receitaPorSistemaRows = dadosSistema.map((d) => ({ Sistema: d.name, Receita: Number(d.value) }));
  const receitaPorPlanoRows = dadosPlano.map((d) => ({ Plano: d.name, Receita: Number(d.value) }));
  const receitaPorBaseRows = useMemo(() => {
    const m: Record<string, number> = {};
    cobrancas.filter((c) => c.status === "pago").forEach((c) => {
      const nome = baseById[c.base_cliente_id]?.nome || "—";
      m[nome] = (m[nome] || 0) + Number(c.valor || 0);
    });
    return Object.entries(m).map(([Base, Receita]) => ({ Base, Receita })).sort((a, b) => b.Receita - a.Receita);
  }, [cobrancas, baseById]);
  const receitaPorTipoRows = dadosTipo.map((d) => ({ Tipo: d.name, Receita: Number(d.value) }));
  const inadimplenciaRows = inadimplenciaPorBase.map((d) => ({ Base: d.name, EmAtraso: Number(d.value) }));
  const mrrPorSistemaRows = mrrPorSistema.map((d) => ({ Sistema: d.name, MRR: Number(d.value) }));
  const implantacaoAbertoRows = useMemo(() => {
    return cobrancas.filter((c) => c.tipo_cobranca === "implantacao" && c.status === "pendente").map((c) => ({
      Base: baseById[c.base_cliente_id]?.nome || "—",
      Vencimento: c.data_vencimento || "",
      Valor: Number(c.valor || 0),
    }));
  }, [cobrancas, baseById]);

  // ---- Navegação principal (A Receber / A Pagar) e abas secundárias ----
  // IMPORTANTE: todos os hooks devem ficar acima do early return de loading
  const [searchParams, setSearchParams] = useSearchParams();
  const abaParam = searchParams.get("aba");
  const initialMain: "receber" | "pagar" | null =
    abaParam === "pagar" ? "pagar" : "receber";
  const [vistaPrincipal, setVistaPrincipal] = useState<"receber" | "pagar" | null>(initialMain);
  const [abaSecundaria, setAbaSecundaria] = useState<string>("visao-geral");

  useEffect(() => {
    if (abaParam === "receber" || abaParam === "pagar") {
      setVistaPrincipal(abaParam);
    } else if (abaParam) {
      setVistaPrincipal(null);
      setAbaSecundaria(abaParam);
    }
  }, [abaParam]);

  const selecionarPrincipal = (v: "receber" | "pagar") => {
    setVistaPrincipal(v);
    setSearchParams({ aba: v }, { replace: true });
  };
  const selecionarSecundaria = (v: string) => {
    setVistaPrincipal(null);
    setAbaSecundaria(v);
    setSearchParams({ aba: v }, { replace: true });
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  // View ativa: receber | pagar | visao-geral | compras-avulsas | bancos | categorias | centros | relatorios
  const viewAtiva: string = vistaPrincipal ?? abaSecundaria;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display flex items-center gap-2">
            <Wallet className="w-5 h-5" /> Financeiro SaaS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Financeiro próprio da empresa SaaS — independente do financeiro operacional do ERP.
          </p>
        </div>
      </div>

      {/* Botões principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => selecionarPrincipal("receber")}
          className={`flex items-center gap-3 rounded-xl border p-4 text-left transition shadow-sm hover:shadow ${
            vistaPrincipal === "receber"
              ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
              : "border-border bg-card hover:border-emerald-300"
          }`}
        >
          <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-emerald-100 text-emerald-700">
            <ArrowDownCircle className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase text-muted-foreground">Receitas</div>
            <div className="text-base font-display">A Receber SaaS</div>
            <div className="text-xs text-muted-foreground">{brl(kpi.aberto)} em aberto • {brl(kpi.vencido)} vencido</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => selecionarPrincipal("pagar")}
          className={`flex items-center gap-3 rounded-xl border p-4 text-left transition shadow-sm hover:shadow ${
            vistaPrincipal === "pagar"
              ? "border-red-500 bg-red-50 ring-2 ring-red-200"
              : "border-border bg-card hover:border-red-300"
          }`}
        >
          <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-red-100 text-red-700">
            <ArrowUpCircle className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase text-muted-foreground">Despesas</div>
            <div className="text-base font-display">A Pagar SaaS</div>
            <div className="text-xs text-muted-foreground">Lançamentos do tipo despesa</div>
          </div>
        </button>
      </div>

      {/* Menu secundário fixo logo abaixo dos botões principais */}
      <Tabs value={vistaPrincipal ? "" : abaSecundaria} onValueChange={selecionarSecundaria}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="compras-avulsas">Compras Avulsas</TabsTrigger>
          <TabsTrigger value="bancos">Bancos</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="centros">Centros de Custo</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* A RECEBER — sem KPIs/gráficos da Visão Geral */}
      {viewAtiva === "receber" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Em aberto" value={brl(kpi.aberto)} tone="amber" />
            <Kpi label="Recebido no mês" value={brl(kpi.recebido)} tone="emerald" />
            <Kpi label="Vencido" value={brl(kpi.vencido)} tone="red" />
            <Kpi label="Previsto no mês" value={brl(kpi.previsto)} />
          </div>
          <Card className="p-4">
            <div className="text-sm font-medium mb-3">Lançamentos a receber</div>
            <SaaSLancamentosTab tipo="receita" />
          </Card>
        </div>
      )}

      {/* A PAGAR — sem KPIs/gráficos da Visão Geral */}
      {viewAtiva === "pagar" && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-sm font-medium mb-3">Lançamentos a pagar</div>
            <SaaSLancamentosTab tipo="despesa" />
          </Card>
        </div>
      )}

      {/* VISÃO GERAL */}
      {viewAtiva === "visao-geral" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Kpi label="Previsto no mês" value={brl(kpi.previsto)} />
            <Kpi label="Recebido no mês" value={brl(kpi.recebido)} tone="emerald" />
            <Kpi label="Em aberto" value={brl(kpi.aberto)} tone="amber" />
            <Kpi label="Vencido" value={brl(kpi.vencido)} tone="red" />
            <Kpi label="MRR estimado" value={brl(kpi.mrr)} tone="emerald" />
            <Kpi label="Implantação aberta" value={brl(kpi.implantacao)} />
            <Kpi label="Mensalidades em aberto" value={brl(kpi.mensalidades)} />
            <Kpi label="Avulsas em aberto" value={brl(kpi.avulsas)} />
            <Kpi label="Bases inadimplentes" value={String(kpi.basesInad)} tone="red" />
            <Kpi label="Contratos aguard. assinatura" value={String(kpi.contratosAguarda)} tone="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Chart title="Receita prevista x recebida (últimos 12 meses)">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={dadosMes}>
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => brl(v)} /><Legend />
                  <Line type="monotone" dataKey="previsto" stroke="#ca8a04" />
                  <Line type="monotone" dataKey="recebido" stroke="#15803d" />
                </LineChart>
              </ResponsiveContainer>
            </Chart>
            <Chart title="Cobranças por status">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={dadosStatus} dataKey="value" nameKey="name" outerRadius={90} label={(d: any) => `${d.name}: ${brl(d.value)}`}>
                    {dadosStatus.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </Chart>
            <Chart title="Receita por tipo de cobrança">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dadosTipo}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Bar dataKey="value" fill="#15803d" />
                </BarChart>
              </ResponsiveContainer>
            </Chart>
            <Chart title="Receita por sistema vendido">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={dadosSistema} dataKey="value" nameKey="name" outerRadius={90} label={(d: any) => `${d.name}: ${brl(d.value)}`}>
                    {dadosSistema.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </Chart>
          </div>
        </div>
      )}

      {viewAtiva === "bancos" && <SaaSBancosTab />}
      {viewAtiva === "categorias" && <SaaSCategoriasTab />}
      {viewAtiva === "centros" && <SaaSCentrosCustoTab />}

      {viewAtiva === "compras-avulsas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Base</Label>
              <Select value={filtroBaseCompra} onValueChange={setFiltroBaseCompra}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setNovaCompra(true)} className="gap-1"><Plus className="w-4 h-4" /> Nova compra avulsa</Button>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase">
                  <tr>
                    <th className="text-left p-2">Base</th>
                    <th className="text-left p-2">Sistema</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Descrição</th>
                    <th className="text-left p-2">Data</th>
                    <th className="text-right p-2">Valor</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-right p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {comprasFiltradas.length === 0 && (
                    <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma compra avulsa</td></tr>
                  )}
                  {comprasFiltradas.map((c) => {
                    const b = baseById[c.base_cliente_id];
                    const sis = b?.sistema_saas_id ? sistemaById[b.sistema_saas_id]?.nome : "—";
                    return (
                      <tr key={c.id} className="border-t hover:bg-muted/20">
                        <td className="p-2">{b?.nome || "—"}</td>
                        <td className="p-2">{sis || "—"}</td>
                        <td className="p-2 capitalize">{c.tipo.replace(/_/g, " ")}</td>
                        <td className="p-2">{c.descricao || "—"}</td>
                        <td className="p-2">{c.data_compra ? new Date(c.data_compra + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="p-2 text-right">{brl(Number(c.valor))}</td>
                        <td className="p-2">{statusBadge(c.status_pagamento)}</td>
                        <td className="p-2 text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            <Button size="sm" variant="ghost" onClick={() => setEditingCompra(c)}>Editar</Button>
                            {c.status_pagamento === "pendente" && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => marcarCompraPaga(c)}>Pagar</Button>
                                <Button size="sm" variant="ghost" onClick={() => gerarCobrancaAvulsa(c)}>Gerar cobrança</Button>
                                <Button size="sm" variant="ghost" onClick={() => cancelarCompra(c)}>Cancelar</Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {viewAtiva === "relatorios" && (
        <RelatoriosFinanceiroSaaS />
      )}


      {/* Modal Compra */}
      {(novaCompra || editingCompra) && (
        <CompraModal
          bases={bases}
          compra={editingCompra}
          onClose={() => { setNovaCompra(false); setEditingCompra(null); }}
          onSave={salvarCompra}
        />
      )}
    </div>
  );
}

function RelatorioCard({ title, rows, dataKey, labelKey, onExport, color = "#15803d" }: {
  title: string; rows: any[]; dataKey: string; labelKey: string; onExport: () => void; color?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{title}</div>
        <Button variant="outline" size="sm" onClick={onExport} className="gap-1">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Sem dados</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={rows} layout="vertical" margin={{ left: 30 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey={labelKey} tick={{ fontSize: 10 }} width={110} />
            <Tooltip formatter={(v: number) => brl(v)} />
            <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function CompraModal({ bases, compra, onClose, onSave }: {
  bases: Base[]; compra: Compra | null; onClose: () => void; onSave: (c: Partial<Compra>) => void;
}) {
  const [data, setData] = useState<Partial<Compra>>(compra || {
    base_cliente_id: "", tipo: "usuario_adicional", descricao: "", valor: 0,
    data_compra: new Date().toISOString().slice(0, 10), status_pagamento: "pendente", observacoes: "",
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{compra ? "Editar compra avulsa" : "Nova compra avulsa"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2">
            <Label className="text-xs flex items-center gap-1"><Building2 className="w-3 h-3" /> Base</Label>
            <Select value={data.base_cliente_id || ""} onValueChange={(v) => setData({ ...data, base_cliente_id: v })} disabled={!!compra}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={data.tipo || ""} onValueChange={(v) => setData({ ...data, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_COMPRA.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Valor</Label>
            <Input type="number" step="0.01" value={data.valor || 0} onChange={(e) => setData({ ...data, valor: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Data</Label>
            <Input type="date" value={data.data_compra || ""} onChange={(e) => setData({ ...data, data_compra: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={data.status_pagamento || "pendente"} onValueChange={(v) => setData({ ...data, status_pagamento: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_COMPRA.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Descrição</Label>
            <Input value={data.descricao || ""} onChange={(e) => setData({ ...data, descricao: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea value={data.observacoes || ""} onChange={(e) => setData({ ...data, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(data)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
