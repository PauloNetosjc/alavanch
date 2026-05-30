import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Wallet, Search, Loader2, Printer, FileSpreadsheet, ArrowLeft, FileSignature, AlertTriangle,
} from "lucide-react";

type Base = { id: string; nome: string; cnpj: string | null; plano: string; status: string };
type Assinatura = { id: string; base_cliente_id: string; status_assinatura: string };
type Cobranca = {
  id: string;
  base_cliente_id: string;
  assinatura_id: string | null;
  contrato_id: string | null;
  tipo_cobranca: string;
  descricao: string | null;
  competencia_mes: number | null;
  competencia_ano: number | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  valor: number;
  status: string;
  forma_pagamento: string | null;
  observacoes: string | null;
};
type Contrato = { id: string; base_cliente_id: string; status: string; numero_contrato: string };

const TIPOS = [
  "implantacao", "mensalidade", "loja_adicional", "usuario_adicional",
  "armazenamento_adicional", "modulo_extra", "compra_avulsa", "customizacao",
  "treinamento", "suporte", "outro",
];
const STATUS = ["pendente", "pago", "vencido", "cancelado"];
const FORMAS = ["pix", "boleto", "cartao", "transferencia", "outro"];
const STATUS_AGUARDA = ["aguardando_assinatura", "enviado_para_assinatura"];

const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

function statusBadge(s: string) {
  const c: Record<string, string> = {
    pendente: "bg-amber-100 text-amber-800",
    pago: "bg-emerald-100 text-emerald-800",
    vencido: "bg-red-100 text-red-800",
    cancelado: "bg-zinc-200 text-zinc-700",
  };
  return <Badge className={`${c[s] || "bg-zinc-200 text-zinc-700"} border-0 capitalize`}>{s}</Badge>;
}

export default function CobrancasSaaS() {
  const { user } = useAuth();
  const [bases, setBases] = useState<Base[]>([]);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fBase, setFBase] = useState("todas");
  const [fPlano, setFPlano] = useState("todos");
  const [fTipo, setFTipo] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [fForma, setFForma] = useState("todas");
  const [fContrato, setFContrato] = useState("todos"); // todos | assinado | sem | aguardando
  const [busca, setBusca] = useState("");

  // Edição
  const [editing, setEditing] = useState<Cobranca | null>(null);
  const [pagandoId, setPagandoId] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const [b, sub, cob, ct] = await Promise.all([
      supabase.from("bases_clientes" as any).select("id,nome,cnpj,plano,status").order("nome"),
      supabase.from("base_assinaturas" as any).select("id,base_cliente_id,status_assinatura"),
      supabase.from("base_cobrancas" as any).select("*").order("data_vencimento", { ascending: false }),
      supabase.from("base_contratos" as any).select("id,base_cliente_id,status,numero_contrato"),
    ]);
    setBases((b.data || []) as any);
    setAssinaturas((sub.data || []) as any);
    setCobrancas((cob.data || []) as any);
    setContratos((ct.data || []) as any);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const baseById = useMemo(() => Object.fromEntries(bases.map((b) => [b.id, b])), [bases]);
  const contratoById = useMemo(() => Object.fromEntries(contratos.map((c) => [c.id, c])), [contratos]);
  const contratoAssinadoPorBase = useMemo(() => {
    const map: Record<string, boolean> = {};
    contratos.forEach((c) => {
      if (c.status === "assinado" || c.status === "anexado_manual") map[c.base_cliente_id] = true;
    });
    return map;
  }, [contratos]);
  const aguardandoPorBase = useMemo(() => {
    const map: Record<string, boolean> = {};
    contratos.forEach((c) => {
      if (STATUS_AGUARDA.includes(c.status)) map[c.base_cliente_id] = true;
    });
    return map;
  }, [contratos]);

  const planosDistintos = useMemo(() => Array.from(new Set(bases.map((b) => b.plano).filter(Boolean))), [bases]);

  const filtradas = useMemo(() => {
    return cobrancas.filter((c) => {
      const b = baseById[c.base_cliente_id];
      if (!b) return false;
      if (from && (!c.data_vencimento || c.data_vencimento < from)) return false;
      if (to && (!c.data_vencimento || c.data_vencimento > to)) return false;
      if (fBase !== "todas" && c.base_cliente_id !== fBase) return false;
      if (fPlano !== "todos" && b.plano !== fPlano) return false;
      if (fTipo !== "todos" && c.tipo_cobranca !== fTipo) return false;
      if (fStatus !== "todos" && c.status !== fStatus) return false;
      if (fForma !== "todas" && c.forma_pagamento !== fForma) return false;
      if (fContrato === "assinado" && !contratoAssinadoPorBase[c.base_cliente_id]) return false;
      if (fContrato === "sem" && contratoAssinadoPorBase[c.base_cliente_id]) return false;
      if (fContrato === "aguardando" && !aguardandoPorBase[c.base_cliente_id]) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const comp = c.competencia_mes ? `${String(c.competencia_mes).padStart(2, "0")}/${c.competencia_ano}` : "";
        const hit = b.nome.toLowerCase().includes(q) ||
          (b.cnpj || "").toLowerCase().includes(q) ||
          (c.descricao || "").toLowerCase().includes(q) ||
          comp.includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [cobrancas, baseById, from, to, fBase, fPlano, fTipo, fStatus, fForma, fContrato, busca, contratoAssinadoPorBase, aguardandoPorBase]);

  const limparFiltros = () => {
    setFrom(""); setTo(""); setFBase("todas"); setFPlano("todos");
    setFTipo("todos"); setFStatus("todos"); setFForma("todas"); setFContrato("todos"); setBusca("");
  };

  // KPIs
  const hoje = new Date().toISOString().slice(0, 10);
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();
  const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fimMes = `${ano}-${String(mes).padStart(2, "0")}-31`;

  const kpi = useMemo(() => {
    const noMes = cobrancas.filter((c) => c.data_vencimento && c.data_vencimento >= inicioMes && c.data_vencimento <= fimMes && c.status !== "cancelado");
    const previstoMes = noMes.reduce((s, c) => s + Number(c.valor || 0), 0);
    const recebidoMes = cobrancas.filter((c) => c.data_pagamento && c.data_pagamento >= inicioMes && c.data_pagamento <= fimMes).reduce((s, c) => s + Number(c.valor || 0), 0);
    const aberto = cobrancas.filter((c) => c.status === "pendente").reduce((s, c) => s + Number(c.valor || 0), 0);
    const vencido = cobrancas.filter((c) => c.status === "pendente" && c.data_vencimento && c.data_vencimento < hoje).reduce((s, c) => s + Number(c.valor || 0), 0);
    const implantacaoAberto = cobrancas.filter((c) => c.tipo_cobranca === "implantacao" && c.status === "pendente").reduce((s, c) => s + Number(c.valor || 0), 0);
    const mensalidadesAberto = cobrancas.filter((c) => c.tipo_cobranca === "mensalidade" && c.status === "pendente").reduce((s, c) => s + Number(c.valor || 0), 0);
    const avulsasAberto = cobrancas.filter((c) => !["mensalidade", "implantacao"].includes(c.tipo_cobranca) && c.status === "pendente").reduce((s, c) => s + Number(c.valor || 0), 0);
    const contratosAguardando = contratos.filter((c) => STATUS_AGUARDA.includes(c.status)).length;
    return { previstoMes, recebidoMes, aberto, vencido, implantacaoAberto, mensalidadesAberto, avulsasAberto, contratosAguardando };
  }, [cobrancas, contratos, inicioMes, fimMes, hoje]);

  // Gráficos (com base no filtro)
  const dadosStatus = useMemo(() => {
    const m: Record<string, number> = {};
    filtradas.forEach((c) => { m[c.status] = (m[c.status] || 0) + Number(c.valor || 0); });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtradas]);

  const dadosMes = useMemo(() => {
    const m: Record<string, { mes: string; previsto: number; recebido: number }> = {};
    filtradas.forEach((c) => {
      if (!c.data_vencimento) return;
      const k = c.data_vencimento.slice(0, 7);
      if (!m[k]) m[k] = { mes: k, previsto: 0, recebido: 0 };
      if (c.status !== "cancelado") m[k].previsto += Number(c.valor || 0);
    });
    filtradas.forEach((c) => {
      if (!c.data_pagamento) return;
      const k = c.data_pagamento.slice(0, 7);
      if (!m[k]) m[k] = { mes: k, previsto: 0, recebido: 0 };
      m[k].recebido += Number(c.valor || 0);
    });
    return Object.values(m).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [filtradas]);

  const dadosTipo = useMemo(() => {
    const m: Record<string, number> = {};
    filtradas.forEach((c) => { m[c.tipo_cobranca] = (m[c.tipo_cobranca] || 0) + Number(c.valor || 0); });
    return Object.entries(m).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [filtradas]);

  const dadosPlano = useMemo(() => {
    const m: Record<string, number> = {};
    filtradas.forEach((c) => {
      const p = baseById[c.base_cliente_id]?.plano || "—";
      m[p] = (m[p] || 0) + Number(c.valor || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtradas, baseById]);

  const dadosInadimplencia = useMemo(() => {
    const m: Record<string, number> = {};
    filtradas.filter((c) => c.status === "pendente" && c.data_vencimento && c.data_vencimento < hoje).forEach((c) => {
      const nome = baseById[c.base_cliente_id]?.nome || "—";
      m[nome] = (m[nome] || 0) + Number(c.valor || 0);
    });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filtradas, baseById, hoje]);

  const STATUS_COLORS: Record<string, string> = { pendente: "#f59e0b", pago: "#16a34a", vencido: "#dc2626", cancelado: "#9ca3af" };
  const PALETTE = ["#0f5132", "#15803d", "#65a30d", "#ca8a04", "#a16207", "#0c4a6e", "#7c2d12"];

  // Ações
  const registrarHist = async (baseId: string, evento: string, descricao: string) => {
    await supabase.from("bases_clientes_historico" as any).insert({
      base_id: baseId, evento, descricao, usuario_id: user?.id ?? null,
    } as any);
  };

  const marcarPaga = async (c: Cobranca, forma?: string) => {
    setPagandoId(c.id);
    const { error } = await supabase.from("base_cobrancas" as any).update({
      status: "pago",
      data_pagamento: new Date().toISOString().slice(0, 10),
      forma_pagamento: forma || c.forma_pagamento || null,
      atualizado_por: user?.id ?? null,
    }).eq("id", c.id);
    setPagandoId(null);
    if (error) { toast.error(error.message); return; }
    await registrarHist(c.base_cliente_id, "cobranca_paga", `Cobrança ${c.descricao || c.tipo_cobranca} marcada como paga`);
    toast.success("Cobrança paga");
    carregar();
  };

  const cancelar = async (c: Cobranca) => {
    if (!confirm("Cancelar esta cobrança?")) return;
    const { error } = await supabase.from("base_cobrancas" as any).update({ status: "cancelado", atualizado_por: user?.id ?? null }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    await registrarHist(c.base_cliente_id, "cobranca_cancelada", `Cobrança ${c.descricao || c.tipo_cobranca} cancelada`);
    toast.success("Cancelada"); carregar();
  };

  const excluir = async (c: Cobranca) => {
    if (c.status === "pago" || c.data_pagamento) { toast.error("Não é possível excluir cobrança paga"); return; }
    if (!confirm("Excluir esta cobrança?")) return;
    const { error } = await supabase.from("base_cobrancas" as any).delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluída"); carregar();
  };

  const salvarEdicao = async () => {
    if (!editing) return;
    const { error } = await supabase.from("base_cobrancas" as any).update({
      data_vencimento: editing.data_vencimento,
      valor: editing.valor,
      forma_pagamento: editing.forma_pagamento,
      descricao: editing.descricao,
      observacoes: editing.observacoes,
      atualizado_por: user?.id ?? null,
    }).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    await registrarHist(editing.base_cliente_id, "cobranca_editada", `Cobrança ${editing.descricao || editing.tipo_cobranca} editada (venc ${editing.data_vencimento}, valor ${brl(editing.valor)})`);
    toast.success("Cobrança atualizada");
    setEditing(null);
    carregar();
  };

  const exportarXlsx = () => {
    const rows = filtradas.map((c) => {
      const b = baseById[c.base_cliente_id];
      const ct = c.contrato_id ? contratoById[c.contrato_id] : null;
      return {
        Base: b?.nome || "—",
        CNPJ: b?.cnpj || "",
        Plano: b?.plano || "",
        Tipo: c.tipo_cobranca,
        Descricao: c.descricao || "",
        Competencia: c.competencia_mes ? `${String(c.competencia_mes).padStart(2, "0")}/${c.competencia_ano}` : "",
        Vencimento: c.data_vencimento || "",
        Valor: Number(c.valor || 0),
        Status: c.status,
        Pagamento: c.data_pagamento || "",
        Forma: c.forma_pagamento || "",
        Contrato: ct?.numero_contrato || "",
        ContratoStatus: ct?.status || "",
        Observacoes: c.observacoes || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cobrancas SaaS");
    XLSX.writeFile(wb, `cobrancas_saas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 print:p-0">
      {/* Header */}
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-display flex items-center gap-2">
            <Wallet className="w-5 h-5" /> Cobranças SaaS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle de mensalidades, implantação, compras avulsas, armazenamento e recorrências das bases.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/sistema/gestao-bases"><ArrowLeft className="w-4 h-4 mr-1" /> Gestão de Bases</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Kpi label="Previsto no mês" value={brl(kpi.previstoMes)} />
        <Kpi label="Recebido no mês" value={brl(kpi.recebidoMes)} tone="emerald" />
        <Kpi label="Em aberto" value={brl(kpi.aberto)} tone="amber" />
        <Kpi label="Vencido" value={brl(kpi.vencido)} tone="red" />
        <Kpi label="Implantação aberta" value={brl(kpi.implantacaoAberto)} />
        <Kpi label="Mensalidades em aberto" value={brl(kpi.mensalidadesAberto)} />
        <Kpi label="Avulsas em aberto" value={brl(kpi.avulsasAberto)} />
        <Kpi label="Contratos aguard. assinatura" value={String(kpi.contratosAguardando)} icon={FileSignature} tone="amber" />
      </div>

      {/* Filtros */}
      <Card className="p-4 print:hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
          <div><Label className="text-xs">Vencimento de</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Vencimento até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Base</Label>
            <Select value={fBase} onValueChange={setFBase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Plano</Label>
            <Select value={fPlano} onValueChange={setFPlano}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {planosDistintos.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {TIPOS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {STATUS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Forma pagto</Label>
            <Select value={fForma} onValueChange={setFForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {FORMAS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Contrato</Label>
            <Select value={fContrato} onValueChange={setFContrato}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="assinado">Com contrato assinado</SelectItem>
                <SelectItem value="sem">Sem contrato assinado</SelectItem>
                <SelectItem value="aguardando">Aguardando assinatura</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 lg:col-span-2">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-7" placeholder="Base, CNPJ, descrição, competência (MM/AAAA)" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={limparFiltros}>Limpar</Button>
            <Button variant="outline" onClick={exportarXlsx} className="gap-1"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</Button>
            <Button variant="outline" onClick={() => window.print()} className="gap-1"><Printer className="w-3.5 h-3.5" /> Imprimir</Button>
          </div>
        </div>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:hidden">
        <Chart title="Cobranças por status">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={dadosStatus} dataKey="value" nameKey="name" outerRadius={80} label={(d: any) => `${d.name}: ${brl(d.value)}`}>
                {dadosStatus.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.name] || "#888"} />)}
              </Pie>
              <Tooltip formatter={(v: number) => brl(v)} /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </Chart>
        <Chart title="Receita prevista x recebida (mês a mês)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dadosMes}>
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => brl(v)} /><Legend />
              <Line type="monotone" dataKey="previsto" stroke="#ca8a04" />
              <Line type="monotone" dataKey="recebido" stroke="#15803d" />
            </LineChart>
          </ResponsiveContainer>
        </Chart>
        <Chart title="Inadimplência por base (top 10)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dadosInadimplencia} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Chart>
        <Chart title="Receita por tipo de cobrança">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dadosTipo}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Bar dataKey="value" fill="#15803d" />
            </BarChart>
          </ResponsiveContainer>
        </Chart>
        <Chart title="Receita por plano">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={dadosPlano} dataKey="value" nameKey="name" outerRadius={80} label={(d: any) => `${d.name}: ${brl(d.value)}`}>
                {dadosPlano.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => brl(v)} /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </Chart>
      </div>

      {/* Tabela */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
          <span>Cobranças ({filtradas.length})</span>
          <span className="text-xs text-muted-foreground">
            Total filtrado: {brl(filtradas.reduce((s, c) => s + Number(c.valor || 0), 0))}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase">
              <tr>
                <th className="text-left p-2">Base</th>
                <th className="text-left p-2">Plano</th>
                <th className="text-left p-2">Tipo</th>
                <th className="text-left p-2">Descrição</th>
                <th className="text-left p-2">Comp.</th>
                <th className="text-left p-2">Venc.</th>
                <th className="text-right p-2">Valor</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Pagto</th>
                <th className="text-left p-2">Forma</th>
                <th className="text-left p-2">Contrato</th>
                <th className="text-right p-2 print:hidden">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">Nenhuma cobrança encontrada</td></tr>
              )}
              {filtradas.map((c) => {
                const b = baseById[c.base_cliente_id];
                const ct = c.contrato_id ? contratoById[c.contrato_id] : null;
                const baseAguardaContrato = !contratoAssinadoPorBase[c.base_cliente_id];
                const vencidoVisual = c.status === "pendente" && c.data_vencimento && c.data_vencimento < hoje;
                return (
                  <tr key={c.id} className="border-t hover:bg-muted/20">
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <span>{b?.nome || "—"}</span>
                        {baseAguardaContrato && (
                          <span title="Base sem contrato assinado">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                          </span>
                        )}
                      </div>
                      {b?.cnpj && <div className="text-[10px] text-muted-foreground">{b.cnpj}</div>}
                    </td>
                    <td className="p-2 capitalize">{b?.plano || "—"}</td>
                    <td className="p-2 capitalize">{c.tipo_cobranca.replace(/_/g, " ")}</td>
                    <td className="p-2">{c.descricao || "—"}</td>
                    <td className="p-2">{c.competencia_mes ? `${String(c.competencia_mes).padStart(2, "0")}/${c.competencia_ano}` : "—"}</td>
                    <td className={`p-2 ${vencidoVisual ? "text-red-600 font-medium" : ""}`}>{fmtDate(c.data_vencimento)}</td>
                    <td className="p-2 text-right">{brl(Number(c.valor))}</td>
                    <td className="p-2">{statusBadge(vencidoVisual ? "vencido" : c.status)}</td>
                    <td className="p-2">{fmtDate(c.data_pagamento)}</td>
                    <td className="p-2 capitalize">{c.forma_pagamento || "—"}</td>
                    <td className="p-2">{ct ? <span title={ct.status}>{ct.numero_contrato}</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-2 text-right print:hidden">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Editar</Button>
                        {c.status === "pendente" && (
                          <Button size="sm" variant="ghost" disabled={pagandoId === c.id} onClick={() => marcarPaga(c)}>
                            {pagandoId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Pagar"}
                          </Button>
                        )}
                        {c.status !== "cancelado" && c.status !== "pago" && (
                          <Button size="sm" variant="ghost" onClick={() => cancelar(c)}>Cancelar</Button>
                        )}
                        {c.status !== "pago" && !c.data_pagamento && (
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => excluir(c)}>Excluir</Button>
                        )}
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/sistema/gestao-bases?base=${c.base_cliente_id}`}>Ver base</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dialog edição */}
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar cobrança</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <Label className="text-xs">Descrição</Label>
                <Input value={editing.descricao || ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" value={editing.data_vencimento || ""} onChange={(e) => setEditing({ ...editing, data_vencimento: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Valor</Label>
                <Input type="number" step="0.01" value={editing.valor} onChange={(e) => setEditing({ ...editing, valor: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Forma de pagamento</Label>
                <Select value={editing.forma_pagamento || ""} onValueChange={(v) => setEditing({ ...editing, forma_pagamento: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {FORMAS.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Observações</Label>
                <Textarea value={editing.observacoes || ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={salvarEdicao}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <style>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          aside, nav, header { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Kpi({ label, value, tone, icon: Icon }: { label: string; value: React.ReactNode; tone?: "emerald" | "red" | "amber"; icon?: any }) {
  const toneClass = tone === "emerald" ? "text-emerald-700" : tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}{label}
      </div>
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
