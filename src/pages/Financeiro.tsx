import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wallet,
  Plus,
  Search,
  Printer,
  FileSpreadsheet,
  FileText,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarRange,
  Pencil,
  Check,
  X,
  Link2,
  Building2,
  AlertTriangle,
  BarChart3,
  FileBarChart,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { BRL } from "@/lib/financeiro";
import { exportarCSV, type LancRow } from "@/lib/exportFinanceiro";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useLoja } from "@/contexts/LojaContext";
import { LojasFilter } from "@/components/financeiro/LojasFilter";
import EntidadeSelector, { type EntidadeRef } from "@/components/financeiro/EntidadeSelector";

type Lanc = {
  id: string;
  tipo: "entrada" | "saida" | string;
  descricao: string | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  categoria_id: string | null;
  conta_id: string | null;
  pedido_id: string | null;
  status: string | null;
  aprovacao_status: string | null;
  fornecedor_id: string | null;
  loja_id: string | null;
};
type Cat = { id: string; nome: string; tipo: string | null; parent_id: string | null };
type Conta = { id: string; nome: string };
type Pedido = { id: string; codigo: string; cliente_id?: string | null; cliente_nome?: string | null };
type Parceiro = { id: string; nome: string };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function fmt(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00").toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

export default function Financeiro() {
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [fornecedores, setFornecedores] = useState<{ id: string; nome: string }[]>([]);

  // Filtros
  const [searchParams] = useSearchParams();
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "entrada" | "saida">("todos");
  const [busca, setBusca] = useState(searchParams.get("busca") || "");
  useEffect(() => {
    const q = searchParams.get("busca");
    if (q) setBusca(q);
  }, [searchParams]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("");
  const [fornecedorFiltro, setFornecedorFiltro] = useState<string>("");
  const [incluirPendentes, setIncluirPendentes] = useState(true);
  const [incluirLiquidadas, setIncluirLiquidadas] = useState(true);
  const [mostrarCancelados, setMostrarCancelados] = useState(false);
  const [incluirAprovadas, setIncluirAprovadas] = useState(true);
  const [incluirNaoAprovadas, setIncluirNaoAprovadas] = useState(false);

  // Filtro multi-loja (inicializa com a loja ativa no topbar)
  const { selectedLojaId } = useLoja();
  const [lojasFiltro, setLojasFiltro] = useState<string[]>([]);
  useEffect(() => {
    if (selectedLojaId) setLojasFiltro([selectedLojaId]);
    else setLojasFiltro([]);
  }, [selectedLojaId]);


  // Período
  const hoje = new Date();
  const primeiroMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const ultimoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [dtIni, setDtIni] = useState(primeiroMes);
  const [dtFim, setDtFim] = useState(ultimoMes);

  function setPreset(p: "hoje" | "semana" | "mes" | "passado" | "ano") {
    const t = new Date();
    if (p === "hoje") { const d = t.toISOString().slice(0, 10); setDtIni(d); setDtFim(d); }
    if (p === "semana") {
      const dia = t.getDay();
      const ini = new Date(t); ini.setDate(t.getDate() - dia);
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
      setDtIni(ini.toISOString().slice(0, 10)); setDtFim(fim.toISOString().slice(0, 10));
    }
    if (p === "mes") {
      setDtIni(new Date(t.getFullYear(), t.getMonth(), 1).toISOString().slice(0, 10));
      setDtFim(new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString().slice(0, 10));
    }
    if (p === "passado") {
      setDtIni(new Date(t.getFullYear(), t.getMonth() - 1, 1).toISOString().slice(0, 10));
      setDtFim(new Date(t.getFullYear(), t.getMonth(), 0).toISOString().slice(0, 10));
    }
    if (p === "ano") {
      setDtIni(new Date(t.getFullYear(), 0, 1).toISOString().slice(0, 10));
      setDtFim(new Date(t.getFullYear(), 11, 31).toISOString().slice(0, 10));
    }
  }

  // Dialogs
  const [lancarOpen, setLancarOpen] = useState(false);
  const [editLanc, setEditLanc] = useState<any>(null);
  const [liquidarOpen, setLiquidarOpen] = useState(false);
  const [liquidando, setLiquidando] = useState<Lanc | null>(null);

  async function load() {
    const [{ data: l }, { data: c }, { data: ct }, { data: pd }, { data: pa }, { data: fr }] = await Promise.all([
      supabase.from("lancamentos_financeiros").select("*").order("data_vencimento", { ascending: true }).limit(2000),
      supabase.from("categorias_financeiras").select("id,nome,tipo,parent_id").order("nome"),
      supabase.from("contas_bancarias").select("id,nome").order("nome"),
      supabase.from("pedidos").select("id,codigo,cliente_id, cliente:cliente_id(nome)").order("created_at", { ascending: false }).limit(500),
      supabase.from("parceiros").select("id,nome").order("nome"),
      supabase.from("fornecedores").select("id,nome").order("nome"),
    ]);
    setLancs((l as Lanc[]) || []);
    setCats((c as Cat[]) || []);
    setContas((ct as Conta[]) || []);
    setPedidos(((pd as any[]) || []).map((p) => ({ id: p.id, codigo: p.codigo, cliente_id: p.cliente_id, cliente_nome: p.cliente?.nome ?? null })));
    setParceiros((pa as Parceiro[]) || []);
    setFornecedores((fr as any[]) || []);
  }
  useEffect(() => { load(); }, []);

  // Mapas
  const catName = (id: string | null) => cats.find((c) => c.id === id)?.nome || "—";
  const catParent = (id: string | null) => {
    const c = cats.find((x) => x.id === id);
    if (!c) return null;
    if (!c.parent_id) return null;
    return cats.find((p) => p.id === c.parent_id)?.nome || null;
  };
  const contaName = (id: string | null) => contas.find((c) => c.id === id)?.nome || "—";
  const pedidoCod = (id: string | null) => pedidos.find((p) => p.id === id)?.codigo || null;

  // Filtragem
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
      if (tipoFiltro !== "todos" && l.tipo !== tipoFiltro) return false;
      if (categoriaFiltro && l.categoria_id !== categoriaFiltro) return false;
      if (fornecedorFiltro && l.fornecedor_id !== fornecedorFiltro) return false;
      const isLiquidada = l.status === "pago" || l.status === "recebido" || l.status === "conciliado";
      if (l.status !== "cancelado") {
        if (isLiquidada && !incluirLiquidadas) return false;
        if (!isLiquidada && !incluirPendentes) return false;
      }
      if (!mostrarCancelados && l.status === "cancelado") return false;
      if (busca) {
        const t = busca.toLowerCase();
        const ok = (l.descricao || "").toLowerCase().includes(t)
          || catName(l.categoria_id).toLowerCase().includes(t)
          || (pedidoCod(l.pedido_id) || "").toLowerCase().includes(t);
        if (!ok) return false;
      }
      return true;
    });
  }, [lancs, dtIni, dtFim, tipoFiltro, categoriaFiltro, fornecedorFiltro, incluirPendentes, incluirLiquidadas, mostrarCancelados, incluirAprovadas, incluirNaoAprovadas, busca, cats, pedidos, lojasFiltro]);

  // KPIs
  const pendenteReceber = filtrados
    .filter((l) => l.tipo === "entrada" && !["pago", "recebido", "conciliado", "cancelado"].includes(l.status || ""))
    .reduce((s, l) => s + Number(l.valor || 0), 0);
  const pendentePagar = filtrados
    .filter((l) => l.tipo === "saida" && !["pago", "recebido", "conciliado", "cancelado"].includes(l.status || ""))
    .reduce((s, l) => s + Number(l.valor || 0), 0);
  const recebido = filtrados
    .filter((l) => l.tipo === "entrada" && ["pago", "recebido", "conciliado"].includes(l.status || ""))
    .reduce((s, l) => s + Number(l.valor || 0), 0);
  const pago = filtrados
    .filter((l) => l.tipo === "saida" && ["pago", "recebido", "conciliado"].includes(l.status || ""))
    .reduce((s, l) => s + Number(l.valor || 0), 0);
  const saldoProjetado = pendenteReceber - pendentePagar;

  const rows: LancRow[] = filtrados.map((l) => ({
    data: l.data_pagamento || l.data_vencimento || "",
    descricao: l.descricao || "",
    categoria: catName(l.categoria_id),
    conta: contaName(l.conta_id),
    tipo: l.tipo,
    status: l.status || "",
    valor: Number(l.valor || 0),
  }));

  function exportarExcel() {
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        Data: r.data ? new Date(r.data).toLocaleDateString("pt-BR") : "",
        Descrição: r.descricao,
        Categoria: r.categoria,
        Conta: r.conta,
        Tipo: r.tipo,
        Status: r.status,
        Valor: r.valor,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financeiro");
    XLSX.writeFile(wb, `financeiro-${dtIni}_a_${dtFim}.xlsx`);
  }

  function imprimir() {
    window.print();
  }

  // CRUD lançamento
  const [novoFornOpen, setNovoFornOpen] = useState(false);
  const [novoFornNome, setNovoFornNome] = useState("");
  const [novoFornDoc, setNovoFornDoc] = useState("");
  const [novoFornIE, setNovoFornIE] = useState("");
  const [novoFornTel, setNovoFornTel] = useState("");
  const [novoFornEmail, setNovoFornEmail] = useState("");
  const [novoFornEndCob, setNovoFornEndCob] = useState("");
  const [novoFornEndEnt, setNovoFornEndEnt] = useState("");
  const [novoFornObs, setNovoFornObs] = useState("");

  function novoLancamento() {
    setEditLanc({
      tipo: "saida",
      tipo_transacao: "unico",
      descricao: "",
      valor: "",
      data_vencimento: todayISO(),
      categoria_id: "",
      conta_id: "",
      pedido_id: "",
      parceiro_id: "",
      fornecedor_id: "",
      forma_pagamento_prevista: "",
      parcelas: 2,
      vincular_contrato: false,
      informar_parceiro: false,
    });
    setLancarOpen(true);
  }

  async function criarFornecedorRapido() {
    const nome = novoFornNome.trim();
    if (!nome) return toast.error("Informe o nome do fornecedor");
    const email = novoFornEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return toast.error("E-mail inválido");
    }
    const doc = novoFornDoc.trim();
    const onlyDigits = doc.replace(/\D/g, "");
    const tipo_documento = onlyDigits.length === 11 ? "CPF" : onlyDigits.length === 14 ? "CNPJ" : null;
    const { data, error } = await supabase
      .from("fornecedores")
      .insert({
        nome,
        documento: doc || null,
        tipo_documento,
        inscricao_estadual: novoFornIE.trim() || null,
        telefone: novoFornTel.trim() || null,
        email: email || null,
        endereco_cobranca: novoFornEndCob.trim() || null,
        endereco_entrega: novoFornEndEnt.trim() || null,
        observacoes: novoFornObs.trim() || null,
        ativo: true,
      } as any)
      .select("id,nome")
      .single();
    if (error) return toast.error(error.message);
    setFornecedores((prev) => [...prev, { id: data!.id, nome: data!.nome }].sort((a, b) => a.nome.localeCompare(b.nome)));
    setEditLanc((prev: any) => ({ ...prev, fornecedor_id: data!.id }));
    setNovoFornNome(""); setNovoFornDoc(""); setNovoFornIE("");
    setNovoFornTel(""); setNovoFornEmail("");
    setNovoFornEndCob(""); setNovoFornEndEnt(""); setNovoFornObs("");
    setNovoFornOpen(false);
    toast.success("Fornecedor cadastrado");
  }

  async function salvarLancamento() {
    if (!editLanc?.descricao) return toast.error("Descrição obrigatória");
    const v = Number(editLanc.valor);
    if (!v || v <= 0) return toast.error("Informe um valor válido");

    // Fornecedor obrigatório:
    // - Toda despesa precisa de fornecedor
    // - Receita só dispensa fornecedor quando vinculada a um contrato (o cliente do pedido é o pagador)
    const isReceitaComContrato =
      editLanc.tipo === "entrada" && editLanc.vincular_contrato && editLanc.pedido_id;
    if (!isReceitaComContrato && !editLanc.fornecedor_id) {
      return toast.error(
        editLanc.tipo === "saida"
          ? "Selecione ou cadastre o fornecedor da despesa"
          : "Selecione ou cadastre o pagador (fornecedor) da receita"
      );
    }

    const base: any = {
      tipo: editLanc.tipo,
      descricao: editLanc.descricao,
      categoria_id: editLanc.categoria_id || null,
      conta_id: editLanc.conta_id || null,
      pedido_id: editLanc.vincular_contrato ? editLanc.pedido_id || null : null,
      fornecedor_id: editLanc.fornecedor_id || null,
      forma_pagamento_prevista: editLanc.forma_pagamento_prevista || null,
      status: "pendente",
    };

    if (editLanc.tipo_transacao === "unico" || editLanc.tipo_transacao === "cartao") {
      const { error } = await supabase.from("lancamentos_financeiros").insert({
        ...base,
        valor: v,
        data_vencimento: editLanc.data_vencimento,
      });
      if (error) return toast.error(error.message);
    } else if (editLanc.tipo_transacao === "parcelado") {
      const n = Math.max(2, Number(editLanc.parcelas) || 2);
      const valorParcela = Math.round((v / n) * 100) / 100;
      const dataBase = new Date(editLanc.data_vencimento + "T00:00");
      const inserts = Array.from({ length: n }).map((_, i) => {
        const d = new Date(dataBase);
        d.setMonth(d.getMonth() + i);
        return {
          ...base,
          descricao: `${editLanc.descricao} - Parcela ${i + 1}/${n}`,
          valor: valorParcela,
          data_vencimento: d.toISOString().slice(0, 10),
        };
      });
      const { error } = await supabase.from("lancamentos_financeiros").insert(inserts);
      if (error) return toast.error(error.message);
    } else if (editLanc.tipo_transacao === "recorrente") {
      const dataBase = new Date(editLanc.data_vencimento + "T00:00");
      const inserts = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(dataBase);
        d.setMonth(d.getMonth() + i);
        return {
          ...base,
          descricao: `${editLanc.descricao} (recorrente)`,
          valor: v,
          data_vencimento: d.toISOString().slice(0, 10),
          recorrente: true,
        };
      });
      const { error } = await supabase.from("lancamentos_financeiros").insert(inserts);
      if (error) return toast.error(error.message);
    }

    toast.success("Lançamento criado");
    setLancarOpen(false);
    setEditLanc(null);
    load();
  }

  async function cancelar(l: Lanc) {
    if (!confirm("Cancelar este lançamento?")) return;
    const { error } = await supabase.from("lancamentos_financeiros").update({ status: "cancelado" }).eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Cancelado");
    load();
  }

  function abrirLiquidar(l: Lanc) {
    setLiquidando(l);
    setLiquidarOpen(true);
  }

  return (
    <div className="p-8 space-y-6">
      {/* CABEÇALHO */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Financeiro</h1>
              <p className="text-sm text-muted-foreground">Gestão de receitas e despesas</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/contas"><Button variant="outline"><Wallet className="w-4 h-4 mr-1" /> Contas Correntes</Button></Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary"><FileBarChart className="w-4 h-4 mr-1" /> Relatórios</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/financeiro/analise"><BarChart3 className="w-4 h-4 mr-2" /> Resultado por Contrato</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/auditoria-parceiros">
              <Button variant="outline"><ClipboardCheck className="w-4 h-4 mr-1" /> Auditoria de Parceiros</Button>
            </Link>
            <Link to="/financeiro/aprovador">
              <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                <ShieldCheck className="w-4 h-4 mr-1" /> Aprovador
              </Button>
            </Link>
            <LojasFilter value={lojasFiltro} onChange={setLojasFiltro} />
            <Button onClick={novoLancamento} className="bg-violet-600 hover:bg-violet-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> Lançar Conta
            </Button>
          </div>
        </div>
      </div>


      {/* ATALHOS GRANDES: A PAGAR / A RECEBER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/financeiro/a-pagar" className="group">
          <div className="rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-rose-100/50 p-8 hover:shadow-xl hover:border-rose-500 transition-all flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowDownCircle className="w-9 h-9 text-rose-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-700">A Pagar</div>
              <div className="text-sm text-rose-700/70">Acessar contas a pagar</div>
            </div>
          </div>
        </Link>
        <Link to="/financeiro/a-receber" className="group">
          <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-8 hover:shadow-xl hover:border-emerald-500 transition-all flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowUpCircle className="w-9 h-9 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-700">A Receber</div>
              <div className="text-sm text-emerald-700/70">Acessar contas a receber</div>
            </div>
          </div>
        </Link>
      </div>


      {/* FILTROS: TIPO E BUSCA + PERÍODO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo e Busca</div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setTipoFiltro("todos")}
              className={`py-2 rounded-md text-sm font-medium ${tipoFiltro === "todos" ? "bg-foreground text-background" : "bg-muted"}`}>Todos</button>
            <button onClick={() => setTipoFiltro("entrada")}
              className={`py-2 rounded-md text-sm font-medium ${tipoFiltro === "entrada" ? "bg-emerald-600 text-white" : "bg-muted"}`}>Entradas</button>
            <button onClick={() => setTipoFiltro("saida")}
              className={`py-2 rounded-md text-sm font-medium ${tipoFiltro === "saida" ? "bg-rose-600 text-white" : "bg-muted"}`}>Saídas</button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Período</div>
            <CalendarRange className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { k: "hoje", l: "Hoje" }, { k: "semana", l: "Semana" }, { k: "mes", l: "Mês" },
              { k: "passado", l: "Passado" }, { k: "ano", l: "Ano" },
            ].map((p) => (
              <button key={p.k} onClick={() => setPreset(p.k as any)} className="px-3 py-1.5 rounded-md text-sm bg-muted hover:bg-muted/70">
                {p.l}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)} />
            <Input type="date" value={dtFim} onChange={(e) => setDtFim(e.target.value)} />
          </div>
        </div>
      </div>

      {/* CATEGORIA + OPÇÕES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Categoria</div>
          <Select value={categoriaFiltro || "all"} onValueChange={(v) => setCategoriaFiltro(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {cats.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.parent_id ? `↳ ${c.nome}` : c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground pt-2">Fornecedor</div>
          <Select value={fornecedorFiltro || "all"} onValueChange={(v) => setFornecedorFiltro(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos os fornecedores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fornecedores</SelectItem>
              {fornecedores.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Opções</div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={incluirPendentes} onCheckedChange={(v) => setIncluirPendentes(!!v)} />
            Contas Pendentes
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={incluirLiquidadas} onCheckedChange={(v) => setIncluirLiquidadas(!!v)} />
            Contas Liquidadas
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={mostrarCancelados} onCheckedChange={(v) => setMostrarCancelados(!!v)} />
            Mostrar Cancelados
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={incluirAprovadas} onCheckedChange={(v) => setIncluirAprovadas(!!v)} />
            Contas Aprovadas
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={incluirNaoAprovadas} onCheckedChange={(v) => setIncluirNaoAprovadas(!!v)} />
            Contas Não Aprovadas
          </label>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-5">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-emerald-700" />
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-700">Em Aberto</Badge>
          </div>
          <div className="text-xs uppercase tracking-wider text-emerald-800/80 mt-4">Pendente a Receber</div>
          <div className="text-3xl font-bold text-emerald-700 mt-1">{BRL(pendenteReceber)}</div>
        </div>
        <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/60 p-5">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5 text-rose-700" />
            </div>
            <Badge className="bg-rose-500/15 text-rose-700">Em aberto</Badge>
          </div>
          <div className="text-xs uppercase tracking-wider text-rose-800/80 mt-4">Pendente a Pagar</div>
          <div className="text-3xl font-bold text-rose-700 mt-1">{BRL(pendentePagar)}</div>
        </div>
        <div className="rounded-2xl border-2 border-teal-300 bg-teal-50/60 p-5">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-teal-700" />
            </div>
            <Badge className="bg-teal-500/15 text-teal-700">Liquidado</Badge>
          </div>
          <div className="text-xs uppercase tracking-wider text-teal-800/80 mt-4">Contas Recebidas</div>
          <div className="text-3xl font-bold text-teal-700 mt-1">{BRL(recebido)}</div>
        </div>
        <div className="rounded-2xl border-2 border-orange-200 bg-orange-50/60 p-5">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5 text-orange-700" />
            </div>
            <Badge className="bg-orange-500/15 text-orange-700">Liquidado</Badge>
          </div>
          <div className="text-xs uppercase tracking-wider text-orange-800/80 mt-4">Contas Pagas</div>
          <div className="text-3xl font-bold text-orange-700 mt-1">{BRL(pago)}</div>
        </div>
        <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/60 p-5">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-violet-700" />
            </div>
            <span className="text-xs text-violet-700">Projetado</span>
          </div>
          <div className="text-xs uppercase tracking-wider text-violet-800/80 mt-4">Saldo Projetado</div>
          <div className={`text-3xl font-bold mt-1 ${saldoProjetado >= 0 ? "text-violet-700" : "text-rose-700"}`}>
            {BRL(saldoProjetado)}
          </div>
        </div>
      </div>


      {/* DIALOG LANÇAR CONTA */}
      <Dialog open={lancarOpen} onOpenChange={setLancarOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <DialogTitle className="text-xl">Lançar Conta</DialogTitle>
                <p className="text-xs text-muted-foreground">Nova receita ou despesa</p>
              </div>
            </div>
          </DialogHeader>

          {editLanc && (
            <div className="space-y-5">
              {/* Tipo */}
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo de Lançamento</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    onClick={() => setEditLanc({ ...editLanc, tipo: "saida" })}
                    className={`py-6 rounded-lg border-2 flex flex-col items-center gap-2 transition ${editLanc.tipo === "saida" ? "border-rose-500 bg-rose-50" : "border-border"}`}>
                    <ArrowDownCircle className={`w-6 h-6 ${editLanc.tipo === "saida" ? "text-rose-600" : "text-muted-foreground"}`} />
                    <div className={`font-semibold ${editLanc.tipo === "saida" ? "text-rose-600" : ""}`}>SAÍDA</div>
                  </button>
                  <button
                    onClick={() => setEditLanc({ ...editLanc, tipo: "entrada" })}
                    className={`py-6 rounded-lg border-2 flex flex-col items-center gap-2 transition ${editLanc.tipo === "entrada" ? "border-emerald-500 bg-emerald-50" : "border-border"}`}>
                    <ArrowUpCircle className={`w-6 h-6 ${editLanc.tipo === "entrada" ? "text-emerald-600" : "text-muted-foreground"}`} />
                    <div className={`font-semibold ${editLanc.tipo === "entrada" ? "text-emerald-600" : ""}`}>ENTRADA</div>
                  </button>
                </div>
              </div>

              {/* Tipo de transação */}
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo de Transação</Label>
                <Select value={editLanc.tipo_transacao} onValueChange={(v) => setEditLanc({ ...editLanc, tipo_transacao: v })}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unico">Lançamento Único</SelectItem>
                    <SelectItem value="recorrente">Lançamento Recorrente</SelectItem>
                    <SelectItem value="parcelado">Lançamento Parcelado</SelectItem>
                    <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Informações Básicas */}
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Informações Básicas</div>
                <Input placeholder="Descrição" value={editLanc.descricao} onChange={(e) => setEditLanc({ ...editLanc, descricao: e.target.value })} />
                <Select value={editLanc.categoria_id || ""} onValueChange={(v) => setEditLanc({ ...editLanc, categoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma categoria…" /></SelectTrigger>
                  <SelectContent>
                    {cats
                      .filter((c) => !editLanc.tipo || !c.tipo || c.tipo === editLanc.tipo)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {catParent(c.id) ? `${catParent(c.id)} > ${c.nome}` : c.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fornecedor / Pagador */}
              {(() => {
                const isEntrada = editLanc.tipo === "entrada";
                const labelTitle = isEntrada ? "Receber de (fornecedor/pagador) *" : "Pagar a (fornecedor) *";
                const placeholder = isEntrada ? "Selecione o pagador…" : "Selecione o fornecedor…";
                const pedidoSel = editLanc.vincular_contrato && editLanc.pedido_id
                  ? pedidos.find((p) => p.id === editLanc.pedido_id) : null;
                if (isEntrada && pedidoSel) {
                  return (
                    <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-4">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-700">Pagador (cliente do contrato)</div>
                      <div className="font-medium text-emerald-900 mt-1">
                        {pedidoSel.cliente_nome || "(cliente sem nome)"} <span className="text-xs text-emerald-700">• {pedidoSel.codigo}</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{labelTitle}</Label>
                    <div className="flex gap-2">
                      <Select value={editLanc.fornecedor_id || ""} onValueChange={(v) => setEditLanc({ ...editLanc, fornecedor_id: v })}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder={placeholder} /></SelectTrigger>
                        <SelectContent>
                          {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" onClick={() => setNovoFornOpen(true)}>+ Novo</Button>
                    </div>
                  </div>
                );
              })()}

              {/* Dados */}
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Dados do Lançamento</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Valor:</Label>
                    <Input type="number" step="0.01" placeholder="R$ 0,00" value={editLanc.valor} onChange={(e) => setEditLanc({ ...editLanc, valor: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Vencimento:</Label>
                    <Input type="date" value={editLanc.data_vencimento} onChange={(e) => setEditLanc({ ...editLanc, data_vencimento: e.target.value })} />
                  </div>
                </div>
                {editLanc.tipo_transacao === "parcelado" && (
                  <div>
                    <Label className="text-xs">Parcelas</Label>
                    <Input type="number" min={2} value={editLanc.parcelas} onChange={(e) => setEditLanc({ ...editLanc, parcelas: Number(e.target.value) })} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Conta</Label>
                    <Select value={editLanc.conta_id || ""} onValueChange={(v) => setEditLanc({ ...editLanc, conta_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                      <SelectContent>
                        {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Forma de pagamento prevista</Label>
                    <Select
                      value={editLanc.forma_pagamento_prevista || "__none"}
                      onValueChange={(v) => setEditLanc({ ...editLanc, forma_pagamento_prevista: v === "__none" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Não informado" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Não informado</SelectItem>
                        {["PIX","Boleto","Dinheiro","Cartão de Crédito","Cartão de Débito","Transferência Bancária","Cheque","Permuta","Outro"].map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Vincular Contrato */}
              <div className={`rounded-lg overflow-hidden border ${editLanc.vincular_contrato ? "border-violet-300" : ""}`}>
                <button
                  onClick={() => setEditLanc({ ...editLanc, vincular_contrato: !editLanc.vincular_contrato })}
                  className={`w-full flex items-center justify-between px-4 py-3 ${editLanc.vincular_contrato ? "bg-violet-600 text-white" : "bg-muted"}`}>
                  <span className="flex items-center gap-2 text-sm font-medium"><Link2 className="w-4 h-4" /> VINCULAR A CONTRATO</span>
                  <span className="text-lg">{editLanc.vincular_contrato ? <Check className="w-4 h-4" /> : "+"}</span>
                </button>
                {editLanc.vincular_contrato && (
                  <div className="p-3">
                    <Select value={editLanc.pedido_id || ""} onValueChange={(v) => setEditLanc({ ...editLanc, pedido_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Buscar contrato…" /></SelectTrigger>
                      <SelectContent>
                        {pedidos.map((p) => <SelectItem key={p.id} value={p.id}>{p.codigo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Informar Parceiro */}
              <div className={`rounded-lg overflow-hidden border ${editLanc.informar_parceiro ? "border-amber-400" : ""}`}>
                <button
                  onClick={() => setEditLanc({ ...editLanc, informar_parceiro: !editLanc.informar_parceiro })}
                  className={`w-full flex items-center justify-between px-4 py-3 ${editLanc.informar_parceiro ? "bg-amber-500 text-white" : "bg-muted"}`}>
                  <span className="flex items-center gap-2 text-sm font-medium"><Building2 className="w-4 h-4" /> INFORMAR PARCEIRO</span>
                  <span className="text-lg">{editLanc.informar_parceiro ? <Check className="w-4 h-4" /> : "+"}</span>
                </button>
                {editLanc.informar_parceiro && (
                  <div className="p-3">
                    <Select value={editLanc.parceiro_id || ""} onValueChange={(v) => setEditLanc({ ...editLanc, parceiro_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Buscar parceiro…" /></SelectTrigger>
                      <SelectContent>
                        {parceiros.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setLancarOpen(false)}>Cancelar</Button>
            <Button onClick={salvarLancamento} className="bg-violet-600 hover:bg-violet-700 text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG LIQUIDAR */}
      <LiquidarDialog
        open={liquidarOpen}
        onOpenChange={(o) => { setLiquidarOpen(o); if (!o) setLiquidando(null); }}
        lanc={liquidando}
        contas={contas}
        onDone={() => { setLiquidarOpen(false); setLiquidando(null); load(); }}
      />

      {/* DIALOG NOVO FORNECEDOR (rápido) */}
      <Dialog open={novoFornOpen} onOpenChange={setNovoFornOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="text-lg font-semibold">Incluir novo fornecedor</div>
          </DialogHeader>
          <div className="space-y-5">
            {/* Seção 1: Dados principais */}
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Dados principais</div>
              <div>
                <Label className="text-xs">Nome / Razão social *</Label>
                <Input value={novoFornNome} onChange={(e) => setNovoFornNome(e.target.value)} placeholder="Nome do fornecedor" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">CPF / CNPJ</Label>
                  <Input value={novoFornDoc} onChange={(e) => setNovoFornDoc(e.target.value)} placeholder="Documento" />
                </div>
                <div>
                  <Label className="text-xs">Inscrição Estadual</Label>
                  <Input value={novoFornIE} onChange={(e) => setNovoFornIE(e.target.value)} placeholder="IE" />
                </div>
              </div>
            </div>

            {/* Seção 2: Contato */}
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Contato</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input value={novoFornTel} onChange={(e) => setNovoFornTel(e.target.value)} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input type="email" value={novoFornEmail} onChange={(e) => setNovoFornEmail(e.target.value)} placeholder="email@dominio.com" />
                </div>
              </div>
            </div>

            {/* Seção 3: Endereços */}
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Endereços</div>
              <div>
                <Label className="text-xs">Endereço de cobrança</Label>
                <Input value={novoFornEndCob} onChange={(e) => setNovoFornEndCob(e.target.value)} placeholder="Rua, número, bairro, cidade/UF, CEP" />
              </div>
              <div>
                <Label className="text-xs">Endereço de entrega</Label>
                <Input value={novoFornEndEnt} onChange={(e) => setNovoFornEndEnt(e.target.value)} placeholder="Rua, número, bairro, cidade/UF, CEP" />
              </div>
            </div>

            {/* Seção 4: Observações */}
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Observações</div>
              <textarea
                className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-[13px]"
                value={novoFornObs}
                onChange={(e) => setNovoFornObs(e.target.value)}
                placeholder="Anotações livres sobre o fornecedor"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovoFornOpen(false)}>Cancelar</Button>
            <Button onClick={criarFornecedorRapido} className="bg-violet-600 hover:bg-violet-700 text-white">Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ====================== Diálogo de Liquidação ====================== */
function LiquidarDialog({
  open, onOpenChange, lanc, contas, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lanc: Lanc | null;
  contas: Conta[];
  onDone: () => void;
}) {
  const [data, setData] = useState(todayISO());
  const [valor, setValor] = useState<string>("");
  const [multa, setMulta] = useState<string>("");
  const [juros, setJuros] = useState<string>("");
  const [contaId, setContaId] = useState<string>("");
  const [novaData, setNovaData] = useState<string>(todayISO());

  useEffect(() => {
    if (lanc) {
      setData(todayISO());
      setValor(String(Number(lanc.valor || 0)));
      setMulta(""); setJuros("");
      setContaId(lanc.conta_id || "");
      const d = new Date(); d.setDate(d.getDate() + 1);
      setNovaData(d.toISOString().slice(0, 10));
    }
  }, [lanc]);

  if (!lanc) return null;

  const valorOriginal = Number(lanc.valor || 0);
  const valorPago = Number(valor) || 0;
  const restante = Math.max(0, Math.round((valorOriginal - valorPago) * 100) / 100);
  const parcial = restante > 0 && valorPago > 0;

  async function confirmar() {
    if (!valorPago || valorPago <= 0) return toast.error("Informe o valor pago");
    if (!contaId) return toast.error("Selecione uma conta para liquidação");

    const novoStatus = lanc.tipo === "entrada" ? "recebido" : "pago";

    if (parcial) {
      // Atualiza original com o que foi pago e cria um novo título com o restante
      const upd = await supabase.from("lancamentos_financeiros").update({
        valor: valorPago,
        data_pagamento: data,
        status: novoStatus,
        conta_id: contaId,
      }).eq("id", lanc.id);
      if (upd.error) return toast.error(upd.error.message);

      const ins = await supabase.from("lancamentos_financeiros").insert({
        tipo: lanc.tipo,
        descricao: (lanc.descricao || "") + " (Saldo)",
        valor: restante,
        data_vencimento: novaData,
        categoria_id: lanc.categoria_id,
        conta_id: lanc.conta_id,
        pedido_id: lanc.pedido_id,
        status: "pendente",
      });
      if (ins.error) return toast.error(ins.error.message);
    } else {
      const total = valorPago + (Number(multa) || 0) + (Number(juros) || 0);
      const { error } = await supabase.from("lancamentos_financeiros").update({
        valor: total,
        data_pagamento: data,
        status: novoStatus,
        conta_id: contaId,
      }).eq("id", lanc.id);
      if (error) return toast.error(error.message);
    }

    toast.success(parcial ? "Liquidado parcialmente; saldo gerado" : "Liquidado");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Confirmar Liquidação</DialogTitle>
              <p className="text-xs text-muted-foreground">Baixa de título financeiro</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Título Selecionado</div>
            <div className="font-bold">{lanc.descricao || "—"}</div>
            <div className="text-sm text-violet-700 mt-1">Valor: {BRL(valorOriginal)}</div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Dados de Pagamento</div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Valor pago" />
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Multas e Juros</div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" step="0.01" placeholder="Multa (R$)" value={multa} onChange={(e) => setMulta(e.target.value)} />
              <Input type="number" step="0.01" placeholder="Juros (R$)" value={juros} onChange={(e) => setJuros(e.target.value)} />
            </div>
          </div>

          {parcial && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <AlertTriangle className="w-4 h-4" /> PAGAMENTO PARCIAL DETECTADO
              </div>
              <div className="text-sm text-amber-900">
                <span className="bg-amber-200 px-1 rounded">Um novo título de {BRL(restante)}</span> será gerado automaticamente.
              </div>
              <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Conta para Liquidação</div>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger><SelectValue placeholder="Selecione uma conta…" /></SelectTrigger>
              <SelectContent>
                {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={confirmar}>
            <Check className="w-4 h-4 mr-1" /> Confirmar Liquidação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
