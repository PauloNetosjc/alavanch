import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, ArrowDownCircle, AlertTriangle, Check, X, Info, RotateCcw, Printer, FileSpreadsheet, Pencil, Layers } from "lucide-react";
import { BRL } from "@/lib/financeiro";
import { toast } from "sonner";
import LancamentosFiltros from "@/components/financeiro/LancamentosFiltros";
import BaixaLancamentoDialog, { type BaixaPayload, TOLERANCIA_PERC } from "@/components/financeiro/BaixaLancamentoDialog";
import EditarLancamentoDialog, { type EditarPayload, FORMAS_PREVISTAS } from "@/components/financeiro/EditarLancamentoDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { exportarExcel, imprimirLista, type LancRow } from "@/lib/exportFinanceiro";
import { useLoja } from "@/contexts/LojaContext";
import { LojasFilter } from "@/components/financeiro/LojasFilter";

type Lanc = {
  id: string;
  tipo: string;
  descricao: string | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  categoria_id: string | null;
  centro_custo_id: string | null;
  conta_id: string | null;
  pedido_id: string | null;
  status: string | null;
  aprovacao_status: string | null;
  baixado_por: string | null;
  baixado_em: string | null;
  fornecedor_id: string | null;
  forma_pagamento: string | null;
  forma_pagamento_prevista: string | null;
  notas: string | null;
  loja_id: string | null;
  juros_previsto?: number | null;
  juros_real?: number | null;
  taxa_perc?: number | null;
  numero_parcela?: number | null;
  total_parcelas?: number | null;
  agrupado?: boolean | null;
  entidade_tipo?: string | null;
  entidade_id?: string | null;
  entidade_nome?: string | null;
};
type Cat = { id: string; nome: string; parent_id: string | null; tipo?: string | null; ativo?: boolean | null };
type Conta = { id: string; nome: string; banco: string | null };
type Pedido = { id: string; codigo: string; created_at: string | null; receita_codigo: string | null; pedido_pai_id: string | null; pedido_origem_complemento_id: string | null; cliente_id: string | null; orcamento_id: string | null };
type Cliente = { id: string; nome: string };
type Profile = { user_id: string; nome_completo: string | null };
type Orc = { id: string; parceiro_id: string | null };
type Parceiro = { id: string; nome: string };

function fmt(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d + "T00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}

export default function ContasAPagar() {
  const { user, role } = useAuth();
  const [souAprovador, setSouAprovador] = useState(false);
  const { can } = usePermissions();
  const podeEditar = can("lancamentos", "edit");
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [fornecedores, setFornecedores] = useState<{ id: string; nome: string }[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orc[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);

  // Filtros
  const hoje = new Date();
  const [busca, setBusca] = useState("");
  const [dtIni, setDtIni] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10));
  const [dtFim, setDtFim] = useState(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10));
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [fornecedorFiltro, setFornecedorFiltro] = useState("");
  const [formaPrevFiltro, setFormaPrevFiltro] = useState("");
  const [centroCustoFiltro, setCentroCustoFiltro] = useState("");
  const [centros, setCentros] = useState<{ id: string; nome: string; ativo?: boolean | null }[]>([]);
  const [incluirPendentes, setIncluirPendentes] = useState(true);
  const [incluirLiquidadas, setIncluirLiquidadas] = useState(true);
  const [mostrarCancelados, setMostrarCancelados] = useState(false);
  const [incluirAprovadas, setIncluirAprovadas] = useState(true);
  const [incluirNaoAprovadas, setIncluirNaoAprovadas] = useState(false);

  const { selectedLojaId } = useLoja();
  const [lojasFiltro, setLojasFiltro] = useState<string[]>([]);
  useEffect(() => {
    if (selectedLojaId) setLojasFiltro([selectedLojaId]); else setLojasFiltro([]);
  }, [selectedLojaId]);

  async function load() {
    const [{ data: l }, { data: c }, { data: ct }, { data: pd }, { data: cl }, { data: pf }, { data: fr }, { data: oc }, { data: pa }, { data: cc }] = await Promise.all([
      supabase.from("lancamentos_financeiros").select("*").eq("tipo", "saida").order("data_vencimento", { ascending: true }).limit(2000),
      supabase.from("categorias_financeiras").select("id,nome,parent_id,tipo,ativo").order("nome"),
      supabase.from("contas_bancarias").select("id,nome,banco").order("nome"),
      supabase.from("pedidos").select("id,codigo,created_at,receita_codigo,pedido_pai_id,pedido_origem_complemento_id,cliente_id,orcamento_id").limit(2000),
      supabase.from("clientes").select("id,nome").limit(5000),
      supabase.from("profiles").select("user_id,nome_completo"),
      supabase.from("fornecedores").select("id,nome").order("nome"),
      supabase.from("orcamentos").select("id,parceiro_id").limit(5000),
      supabase.from("parceiros").select("id,nome").limit(2000),
      supabase.from("centros_custo").select("id,nome").order("ordem").order("nome"),
    ]);
    setLancs((l as Lanc[]) || []);
    setCats((c as Cat[]) || []);
    setContas((ct as Conta[]) || []);
    setPedidos((pd as Pedido[]) || []);
    setClientes((cl as Cliente[]) || []);
    setProfiles((pf as Profile[]) || []);
    setFornecedores((fr as any[]) || []);
    setOrcamentos((oc as Orc[]) || []);
    setParceiros((pa as Parceiro[]) || []);
    setCentros(((cc as any[]) || []));
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    (async () => {
      if (!user) return;
      if (role === "admin") { setSouAprovador(true); return; }
      const { data } = await supabase.from("aprovadores_financeiros" as any)
        .select("aprova_pagar").eq("user_id", user.id);
      setSouAprovador(((data as any[]) || []).some((r) => r.aprova_pagar));
    })();
  }, [user, role]);

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.nome || "—";
  const ccName = (id: string | null) => centros.find((c) => c.id === id)?.nome || "—";
  const contaName = (id: string | null) => contas.find((c) => c.id === id)?.nome || "—";
  const pedidoCod = (id: string | null) => pedidos.find((p) => p.id === id)?.codigo || null;
  const pedidoData = (id: string | null) => {
    const p = pedidos.find((x) => x.id === id);
    if (!p?.created_at) return "—";
    try { return new Date(p.created_at).toLocaleDateString("pt-BR"); } catch { return "—"; }
  };
  const userName = (id: string | null) => profiles.find((p) => p.user_id === id)?.nome_completo || "Usuário";

  // Mapa pedido -> família (raiz + adendos + complementos)
  const pedidoFamilia = useMemo(() => {
    const byId = new Map(pedidos.map((p) => [p.id, p]));
    const map = new Map<string, { receitas: string[]; codigos: string[]; clienteNome: string; parceiroNome: string }>();
    for (const p of pedidos) {
      const raizId = p.pedido_pai_id || p.pedido_origem_complemento_id || p.id;
      const raiz = byId.get(raizId) || p;
      const familia = pedidos.filter(
        (x) => x.id === raizId
          || x.pedido_pai_id === raizId
          || x.pedido_origem_complemento_id === raizId,
      );
      const receitas = Array.from(new Set(familia.map((x) => x.receita_codigo).filter(Boolean) as string[]));
      const codigos = Array.from(new Set(familia.map((x) => x.codigo).filter(Boolean)));
      const cliente = clientes.find((c) => c.id === raiz.cliente_id)?.nome || "";
      const orc = orcamentos.find((o) => o.id === raiz.orcamento_id);
      const parc = orc?.parceiro_id ? parceiros.find((x) => x.id === orc.parceiro_id)?.nome || "" : "";
      map.set(p.id, { receitas, codigos, clienteNome: cliente, parceiroNome: parc });
    }
    return map;
  }, [pedidos, clientes, orcamentos, parceiros]);

  // Mapa lancamento.id -> { numero, total, receitaCodigo }
  const parcelaInfo = useMemo(() => {
    const map = new Map<string, { numero: number; total: number; receitaCodigo: string | null }>();
    const porPedido = new Map<string, Lanc[]>();
    for (const l of lancs) {
      if (!l.pedido_id) continue;
      if (!porPedido.has(l.pedido_id)) porPedido.set(l.pedido_id, []);
      porPedido.get(l.pedido_id)!.push(l);
    }
    for (const [pid, arr] of porPedido) {
      const ordenado = [...arr].sort((a, b) => {
        const da = a.data_vencimento || "";
        const db = b.data_vencimento || "";
        if (da !== db) return da < db ? -1 : 1;
        return a.id < b.id ? -1 : 1;
      });
      const total = ordenado.length;
      const ped = pedidos.find((p) => p.id === pid);
      const receitaCodigo = ped?.receita_codigo || ped?.codigo || null;
      ordenado.forEach((l, idx) => {
        const m = (l.descricao || "").match(/Parcela\s+(\d+)\s*\/\s*(\d+)/i);
        const numero = m ? parseInt(m[1], 10) : idx + 1;
        const tot = m ? parseInt(m[2], 10) : total;
        map.set(l.id, { numero, total: tot, receitaCodigo });
      });
    }
    return map;
  }, [lancs, pedidos]);

  const parceiroFornecedor = (l: Lanc): string => {
    if (l.entidade_nome) return l.entidade_nome;
    const fam = l.pedido_id ? pedidoFamilia.get(l.pedido_id) : null;
    if (fam?.parceiroNome) return fam.parceiroNome;
    const f = fornecedores.find((x) => x.id === l.fornecedor_id)?.nome;
    return f || "—";
  };
  const entidadeTipoLabel = (t: string | null | undefined): string | null => {
    if (!t) return null;
    if (t === "cliente") return "Cliente";
    if (t === "fornecedor") return "Fornecedor";
    if (t === "parceiro") return "Parceiro";
    return null;
  };
  const clienteName = (l: Lanc): string => {
    const fam = l.pedido_id ? pedidoFamilia.get(l.pedido_id) : null;
    return fam?.clienteNome || "—";
  };

  const filtrados = useMemo(() => {
    return lancs.filter((l) => {
      if (lojasFiltro.length > 0 && !lojasFiltro.includes(l.loja_id || "")) return false;
      const isAprov = l.aprovacao_status === "aprovado";
      if (!incluirAprovadas && !incluirNaoAprovadas) return false;
      if (isAprov && !incluirAprovadas) return false;
      if (!isAprov && !incluirNaoAprovadas) return false;
      const d = l.data_pagamento || l.data_vencimento;
      if (d) {
        if (dtIni && d < dtIni) return false;
        if (dtFim && d > dtFim) return false;
      }
      if (categoriaFiltro && l.categoria_id !== categoriaFiltro) return false;
      if (centroCustoFiltro) {
        if (centroCustoFiltro === "__none") { if (l.centro_custo_id) return false; }
        else if (l.centro_custo_id !== centroCustoFiltro) return false;
      }
      if (fornecedorFiltro && l.fornecedor_id !== fornecedorFiltro) return false;
      if (formaPrevFiltro) {
        if (formaPrevFiltro === "__none") { if (l.forma_pagamento_prevista) return false; }
        else if ((l.forma_pagamento_prevista || "") !== formaPrevFiltro) return false;
      }
      const isLiquidada = ["pago", "recebido", "conciliado"].includes(l.status || "");
      if (l.status !== "cancelado") {
        if (isLiquidada && !incluirLiquidadas) return false;
        if (!isLiquidada && !incluirPendentes) return false;
      }
      if (!mostrarCancelados && l.status === "cancelado") return false;
      if (busca) {
        const t = busca.toLowerCase().replace(/^#/, "");
        const fam = l.pedido_id ? pedidoFamilia.get(l.pedido_id) : null;
        const ok = (l.descricao || "").toLowerCase().includes(t)
          || catName(l.categoria_id).toLowerCase().includes(t)
          || ccName(l.centro_custo_id).toLowerCase().includes(t)
          || contaName(l.conta_id).toLowerCase().includes(t)
          || (pedidoCod(l.pedido_id) || "").toLowerCase().includes(t)
          || (fam?.receitas || []).some((r) => r.toLowerCase().includes(t))
          || (fam?.codigos || []).some((c) => c.toLowerCase().includes(t))
          || (fam?.clienteNome || "").toLowerCase().includes(t)
          || (fam?.parceiroNome || "").toLowerCase().includes(t)
          || parceiroFornecedor(l).toLowerCase().includes(t)
          || (l.entidade_nome || "").toLowerCase().includes(t)
          || (entidadeTipoLabel(l.entidade_tipo) || "").toLowerCase().includes(t)
          || (l.status || "").toLowerCase().includes(t)
          || (l.forma_pagamento_prevista || "").toLowerCase().includes(t);
        if (!ok) return false;
      }
      return true;
    });
  }, [lancs, dtIni, dtFim, categoriaFiltro, fornecedorFiltro, formaPrevFiltro, centroCustoFiltro, incluirPendentes, incluirLiquidadas, mostrarCancelados, incluirAprovadas, incluirNaoAprovadas, busca, cats, centros, pedidos, pedidoFamilia, lojasFiltro, fornecedores]);

  const [baixaOpen, setBaixaOpen] = useState(false);
  const [baixaAlvo, setBaixaAlvo] = useState<Lanc | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editAlvo, setEditAlvo] = useState<Lanc | null>(null);

  function abrirEdicao(l: Lanc) { setEditAlvo(l); setEditOpen(true); }
  const reapprovalPatch = () => souAprovador ? {} : { aprovacao_status: "pendente_aprovacao", aprovado_por: null, aprovado_em: null };

  async function salvarEdicao(p: EditarPayload) {
    if (!editAlvo) return;
    const { error } = await supabase.from("lancamentos_financeiros").update({
      data_vencimento: p.data_vencimento,
      data_pagamento: p.data_pagamento,
      valor: p.valor,
      forma_pagamento: p.forma_pagamento,
      forma_pagamento_prevista: p.forma_pagamento_prevista,
      notas: p.notas,
      ...reapprovalPatch(),
    } as any).eq("id", editAlvo.id);
    if (error) { toast.error(error.message); return; }
    toast.success(souAprovador ? "Parcela atualizada" : "Parcela atualizada — enviada para aprovação"); load();
  }

  function abrirBaixa(l: Lanc) {
    setBaixaAlvo(l);
    setBaixaOpen(true);
  }

  async function confirmarBaixa(p: BaixaPayload) {
    if (!baixaAlvo) return;
    const agora = new Date();
    const bruto = Number(baixaAlvo.valor || 0);
    const juros = Number(baixaAlvo.juros_previsto || 0);
    const liquidoPrev = Math.max(0, Math.round((bruto + juros) * 100) / 100); // em despesa, juros aumenta o pago
    const pago = Number(p.valor) || 0;
    const jurosReal = Math.round((pago - bruto) * 100) / 100; // pago acima do bruto = juros real positivo
    const diff = Math.round((pago - liquidoPrev) * 100) / 100;
    const percDiff = liquidoPrev > 0 ? Math.abs(diff) / liquidoPrev * 100 : 0;

    // Exige aprovação quando paga mais do que o previsto acima da tolerância
    const exigeAprov = !souAprovador && diff > 0.005 && percDiff > TOLERANCIA_PERC;

    const contaTrocada = (baixaAlvo.conta_id || "") !== (p.conta_id || "");
    const contaAnt = contas.find((c) => c.id === baixaAlvo.conta_id)?.nome || "—";
    const contaNova = contas.find((c) => c.id === p.conta_id)?.nome || "—";
    const auditoria: string[] = [];
    if (contaTrocada) auditoria.push(`Conta alterada de "${contaAnt}" para "${contaNova}" por ${userName(user?.id ?? null)} em ${agora.toLocaleString("pt-BR")}.`);
    auditoria.push(`Pago ${BRL(pago)} sobre bruto ${BRL(bruto)} (juros previsto ${BRL(juros)}, juros real ${BRL(jurosReal)}).`);
    if (diff > 0.005) auditoria.push(`Diferença positiva (pago a mais): ${BRL(diff)}${exigeAprov ? " — enviado para Aprovador" : " — dentro da tolerância"}.`);
    else if (diff < -0.005) auditoria.push(`Diferença negativa (pago a menos): ${BRL(Math.abs(diff))}.`);
    const notasNovas = [baixaAlvo.notas, ...auditoria].filter(Boolean).join("\n");

    const { error } = await supabase.from("lancamentos_financeiros")
      .update({
        status: "pago",
        data_pagamento: p.data_pagamento,
        conta_id: p.conta_id,
        forma_pagamento: p.forma_pagamento,
        juros_real: jurosReal,
        baixado_por: user?.id ?? null,
        baixado_em: agora.toISOString(),
        notas: notasNovas,
        ...(exigeAprov ? { aprovacao_status: "pendente_aprovacao", aprovado_por: null, aprovado_em: null } : {}),
      })
      .eq("id", baixaAlvo.id);
    if (error) { toast.error(error.message); return; }

    if (diff < -0.005) toast.success(`Pago. Diferença a menos: ${BRL(Math.abs(diff))}.`);
    else if (exigeAprov) toast.success("Baixa registrada — enviada para Aprovador (diferença acima da tolerância).");
    else if (diff > 0.005) toast.success(`Pago. Diferença ${BRL(diff)} dentro da tolerância.`);
    else toast.success("Pago");
    load();
  }

  async function estornar(l: Lanc) {
    if (!confirm("Estornar este pagamento? A parcela voltará para pendente.")) return;
    const { error } = await supabase.from("lancamentos_financeiros")
      .update({ status: "pendente", data_pagamento: null, baixado_por: null, baixado_em: null, forma_pagamento: null, juros_real: 0, ...reapprovalPatch() })
      .eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    toast.success(souAprovador ? "Estornado" : "Estornado — enviado para aprovação"); load();
  }

  async function cancelar(l: Lanc) {
    if (!confirm("Cancelar este lançamento?")) return;
    const { error } = await supabase.from("lancamentos_financeiros")
      .update({ status: "cancelado", ...reapprovalPatch() }).eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    toast.success(souAprovador ? "Cancelado" : "Cancelado — enviado para aprovação"); load();
  }

  const total = filtrados
    .filter((l) => !["pago", "recebido", "conciliado", "cancelado"].includes(l.status || ""))
    .reduce((s, l) => s + Number(l.valor || 0), 0);

  const toRows = (): LancRow[] => filtrados.map((l) => ({
    data: l.data_pagamento || l.data_vencimento || "",
    descricao: l.descricao || "",
    cliente: clienteName(l) !== "—" ? clienteName(l) : parceiroFornecedor(l),
    categoria: catName(l.categoria_id),
    centro_custo: ccName(l.centro_custo_id),
    conta: contaName(l.conta_id),
    tipo: l.tipo,
    status: l.status || "",
    valor: Number(l.valor || 0),
    forma_pagamento_prevista: l.forma_pagamento_prevista,
  }));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/financeiro">
            <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao Financeiro</Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-rose-500/15 flex items-center justify-center">
              <ArrowDownCircle className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Contas a Pagar</h1>
              <p className="text-sm text-muted-foreground">Saídas e despesas</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <LojasFilter value={lojasFiltro} onChange={setLojasFiltro} />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => imprimirLista(toRows(), "Contas a Pagar")}>
              <Printer className="w-4 h-4 mr-1" /> Imprimir
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportarExcel(toRows(), `contas-a-pagar-${dtIni}_a_${dtFim}.xlsx`)}>
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
            </Button>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total Pendente</div>
            <div className="text-2xl font-bold text-rose-700">{BRL(total)}</div>
          </div>
        </div>
      </div>

      <LancamentosFiltros
        busca={busca} setBusca={setBusca}
        dtIni={dtIni} setDtIni={setDtIni}
        dtFim={dtFim} setDtFim={setDtFim}
        cats={cats}
        categoriaFiltro={categoriaFiltro} setCategoriaFiltro={setCategoriaFiltro}
        fornecedores={fornecedores}
        fornecedorFiltro={fornecedorFiltro} setFornecedorFiltro={setFornecedorFiltro}
        formaPrevFiltro={formaPrevFiltro} setFormaPrevFiltro={setFormaPrevFiltro}
        centrosCusto={centros} centroCustoFiltro={centroCustoFiltro} setCentroCustoFiltro={setCentroCustoFiltro}
        formasPrevistas={FORMAS_PREVISTAS}
        incluirPendentes={incluirPendentes} setIncluirPendentes={setIncluirPendentes}
        incluirLiquidadas={incluirLiquidadas} setIncluirLiquidadas={setIncluirLiquidadas}
        mostrarCancelados={mostrarCancelados} setMostrarCancelados={setMostrarCancelados}
        incluirAprovadas={incluirAprovadas} setIncluirAprovadas={setIncluirAprovadas}
        incluirNaoAprovadas={incluirNaoAprovadas} setIncluirNaoAprovadas={setIncluirNaoAprovadas}
      />

      <TooltipProvider delayDuration={150}>
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
                <th className="text-left py-3 px-5 font-medium">Código</th>
                <th className="text-left py-3 font-medium">Cliente</th>
                <th className="text-left py-3 font-medium">Pagar para</th>
                <th className="text-left py-3 font-medium">Data Origem</th>
                <th className="text-left py-3 font-medium">Vencimento</th>
                <th className="text-left py-3 font-medium">Descrição</th>
                <th className="text-left py-3 font-medium">Categoria</th>
                <th className="text-left py-3 font-medium">Centro de Custo</th>
                <th className="text-left py-3 font-medium">Conta</th>
                <th className="text-right py-3 font-medium">Valor bruto</th>
                <th className="text-right py-3 font-medium">Juros / Taxa</th>
                <th className="text-right py-3 font-medium">Pago</th>
                <th className="text-right py-3 font-medium">Juros Real</th>
                <th className="text-right py-3 font-medium">Saldo</th>
                <th className="text-center py-3 font-medium">Status</th>
                <th className="text-left py-3 font-medium">Forma Pgto. Prevista</th>
                <th className="text-left py-3 font-medium">Notas</th>
                <th className="text-right py-3 px-5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => {
                const cod = pedidoCod(l.pedido_id);
                const pago = ["pago", "recebido", "conciliado"].includes(l.status || "");
                const cancelado = l.status === "cancelado";
                const vencido = !pago && !cancelado && l.data_vencimento && l.data_vencimento < new Date().toISOString().slice(0, 10);
                const baixaInfo = pago && l.baixado_em ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center ml-1 cursor-help">
                        <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      <div className="font-semibold mb-1">Baixa registrada</div>
                      <div><span className="text-muted-foreground">Por:</span> {userName(l.baixado_por)}</div>
                      <div><span className="text-muted-foreground">Em:</span> {new Date(l.baixado_em).toLocaleString("pt-BR")}</div>
                    </TooltipContent>
                  </Tooltip>
                ) : null;
                return (
                  <tr key={l.id} className={`border-b hover:bg-muted/30 ${cancelado ? "opacity-60" : ""}`}>
                    <td className="py-4 px-5 whitespace-nowrap">
                      {(() => {
                        const info = parcelaInfo.get(l.id);
                        if (info && info.receitaCodigo) {
                          return (
                            <Link to={`/pedidos/${l.pedido_id}/receita`} className="font-mono text-[12px] text-primary hover:underline" title="Ver receita agrupada">
                              #{info.receitaCodigo}-{info.numero}/{info.total}
                            </Link>
                          );
                        }
                        return <span className="font-mono text-[12px] text-muted-foreground">#{l.id.slice(0, 6)}</span>;
                      })()}
                    </td>
                    <td className="py-4 whitespace-nowrap max-w-[180px] truncate" title={clienteName(l)}>
                      {clienteName(l)}
                    </td>
                    <td className="whitespace-nowrap max-w-[200px] truncate" title={parceiroFornecedor(l)}>
                      <div className="font-medium truncate">{parceiroFornecedor(l)}</div>
                      {entidadeTipoLabel(l.entidade_tipo) && (
                        <div className="text-[10px] text-muted-foreground">{entidadeTipoLabel(l.entidade_tipo)}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">{pedidoData(l.pedido_id)}</td>
                    <td className="whitespace-nowrap">{fmt(l.data_vencimento)}</td>
                    <td>
                      <div className="font-medium">{l.descricao || "—"}</div>
                      {cod && (
                        <div className="text-[11px] text-muted-foreground">
                          <Link to={`/pedidos/${l.pedido_id}`} className="text-primary hover:underline">[{cod}]</Link>
                        </div>
                      )}
                    </td>
                    <td>{catName(l.categoria_id)}</td>
                    <td className="text-muted-foreground">{ccName(l.centro_custo_id)}</td>
                    <td>{contaName(l.conta_id)}</td>
                    <td className="text-right font-semibold whitespace-nowrap text-rose-700">
                      {BRL(Number(l.valor || 0))}
                      {l.agrupado && (
                        <div className="mt-1 inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">
                          Agrupado{l.total_parcelas ? ` ${l.total_parcelas}x` : ""}
                        </div>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap text-amber-700">
                      {Number(l.juros_previsto || 0) > 0 ? BRL(Number(l.juros_previsto || 0)) : "—"}
                      {l.taxa_perc != null && Number(l.taxa_perc) > 0 && (
                        <div className="text-[10px] text-muted-foreground">{Number(l.taxa_perc).toFixed(2)}%</div>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {pago ? <span className="font-medium text-rose-700">{BRL(Number(l.valor || 0) + Number(l.juros_real || 0))}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {pago ? (() => {
                        const jr = Number(l.juros_real || 0);
                        if (Math.abs(jr) < 0.005) return <span className="text-muted-foreground">R$ 0,00</span>;
                        if (jr > 0) return <span className="text-amber-700" title="Pago acima do bruto">{BRL(jr)}</span>;
                        return <span className="text-emerald-700" title="Pago abaixo do bruto">-{BRL(Math.abs(jr))}</span>;
                      })() : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="text-right font-medium whitespace-nowrap">
                      {(() => {
                        if (pago || cancelado) return BRL(0);
                        const valor = Number(l.valor || 0);
                        const juros = Number(l.juros_previsto || 0);
                        return BRL(valor + juros);
                      })()}
                    </td>
                    <td className="text-center">
                      <div className="inline-flex items-center">
                        {cancelado ? <Badge variant="destructive">CANCELADO</Badge>
                          : pago ? <Badge className="bg-emerald-500/15 text-emerald-700">PAGO</Badge>
                          : vencido ? <Badge className="bg-rose-500/15 text-rose-700">VENCIDO</Badge>
                          : <Badge className="bg-violet-500/15 text-violet-700">PENDENTE</Badge>}
                        {baixaInfo}
                      </div>
                    </td>
                    <td className="text-xs text-muted-foreground whitespace-nowrap">
                      {l.forma_pagamento_prevista || "—"}
                    </td>
                    <td className="max-w-[180px] text-xs text-muted-foreground truncate" title={l.notas || ""}>
                      {l.notas || "—"}
                    </td>
                    <td className="text-right px-5">
                      <div className="flex justify-end gap-1">
                        {l.pedido_id && (
                          <Button size="icon" variant="ghost" title="Ver pedido / receita" asChild>
                            <Link to={`/pedidos/${l.pedido_id}/receita`}>
                              <Layers className="w-4 h-4 text-primary" />
                            </Link>
                          </Button>
                        )}
                        {!pago && !cancelado && (
                          <>
                            <Button size="icon" variant="ghost" title="Pagar / Liquidar" onClick={() => abrirBaixa(l)}>
                              <Check className="w-4 h-4 text-emerald-600" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Cancelar" onClick={() => cancelar(l)}>
                              <X className="w-4 h-4 text-rose-500" />
                            </Button>
                          </>
                        )}
                        {pago && !cancelado && podeEditar && (
                          <Button size="icon" variant="ghost" title="Estornar pagamento" onClick={() => estornar(l)}>
                            <RotateCcw className="w-4 h-4 text-amber-600" />
                          </Button>
                        )}
                        {podeEditar && !cancelado && (
                          <Button size="icon" variant="ghost" title="Alterar parcela" onClick={() => abrirEdicao(l)}>
                            <Pencil className="w-4 h-4 text-primary" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtrados.length && (
                <tr><td colSpan={18} className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-60" />
                  Nenhuma conta a pagar
                </td></tr>
              )}
            </tbody>
            {filtrados.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/40 font-semibold">
                  <td colSpan={9} className="py-3 px-5 text-right text-xs uppercase tracking-wider text-muted-foreground">
                    Total ({filtrados.length} {filtrados.length === 1 ? "parcela" : "parcelas"})
                  </td>
                  <td className="py-3 text-right text-rose-700 whitespace-nowrap">
                    {BRL(filtrados.reduce((s, l) => s + Number(l.valor || 0), 0))}
                  </td>
                  <td className="py-3 text-right text-amber-700 whitespace-nowrap">
                    {BRL(filtrados.reduce((s, l) => s + Number(l.juros_previsto || 0), 0))}
                  </td>
                  <td className="py-3 text-right text-rose-700 whitespace-nowrap">
                    {BRL(filtrados.reduce((s, l) => {
                      const p = ["pago","recebido","conciliado"].includes(l.status||"");
                      if (!p) return s;
                      return s + Number(l.valor || 0) + Number(l.juros_real || 0);
                    }, 0))}
                  </td>
                  <td className="py-3 text-right text-amber-700 whitespace-nowrap">
                    {BRL(filtrados.reduce((s, l) => {
                      const p = ["pago","recebido","conciliado"].includes(l.status||"");
                      return p ? s + Number(l.juros_real || 0) : s;
                    }, 0))}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    {BRL(filtrados.reduce((s, l) => {
                      const p = ["pago","recebido","conciliado"].includes(l.status||"");
                      const cancel = l.status === "cancelado";
                      if (p || cancel) return s;
                      return s + Number(l.valor || 0) + Number(l.juros_previsto || 0);
                    }, 0))}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      </TooltipProvider>

      <BaixaLancamentoDialog
        open={baixaOpen}
        onOpenChange={setBaixaOpen}
        tipo="saida"
        descricao={baixaAlvo?.descricao ?? null}
        valorOriginal={Number(baixaAlvo?.valor || 0)}
        jurosPrevisto={Number(baixaAlvo?.juros_previsto || 0)}
        contaIdAtual={baixaAlvo?.conta_id ?? null}
        contas={contas}
        onConfirm={confirmarBaixa}
      />

      <EditarLancamentoDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tipo="saida"
        lanc={editAlvo ? {
          id: editAlvo.id,
          descricao: editAlvo.descricao,
          data_vencimento: editAlvo.data_vencimento,
          data_pagamento: editAlvo.data_pagamento,
          valor: Number(editAlvo.valor || 0),
          forma_pagamento: editAlvo.forma_pagamento,
          forma_pagamento_prevista: editAlvo.forma_pagamento_prevista,
          notas: editAlvo.notas,
          status: editAlvo.status,
        } : null}
        onSave={salvarEdicao}
        onEstornar={editAlvo ? () => estornar(editAlvo) : undefined}
      />
    </div>
  );
}
