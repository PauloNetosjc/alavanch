import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, ArrowDownCircle, AlertTriangle, Check, X, Info, RotateCcw } from "lucide-react";
import { BRL } from "@/lib/financeiro";
import { toast } from "sonner";
import LancamentosFiltros from "@/components/financeiro/LancamentosFiltros";
import BaixaLancamentoDialog, { type BaixaPayload } from "@/components/financeiro/BaixaLancamentoDialog";

type Lanc = {
  id: string;
  tipo: string;
  descricao: string | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  categoria_id: string | null;
  conta_id: string | null;
  pedido_id: string | null;
  status: string | null;
  aprovacao_status: string | null;
  baixado_por: string | null;
  baixado_em: string | null;
  fornecedor_id: string | null;
};
type Cat = { id: string; nome: string; parent_id: string | null };
type Conta = { id: string; nome: string; banco: string | null };
type Pedido = { id: string; codigo: string };
type Profile = { user_id: string; nome_completo: string | null };

function fmt(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d + "T00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}

export default function ContasAPagar() {
  const { user } = useAuth();
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [fornecedores, setFornecedores] = useState<{ id: string; nome: string }[]>([]);

  // Filtros
  const hoje = new Date();
  const [busca, setBusca] = useState("");
  const [dtIni, setDtIni] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10));
  const [dtFim, setDtFim] = useState(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10));
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [fornecedorFiltro, setFornecedorFiltro] = useState("");
  const [incluirPendentes, setIncluirPendentes] = useState(true);
  const [incluirLiquidadas, setIncluirLiquidadas] = useState(true);
  const [mostrarCancelados, setMostrarCancelados] = useState(false);
  const [incluirAprovadas, setIncluirAprovadas] = useState(true);
  const [incluirNaoAprovadas, setIncluirNaoAprovadas] = useState(false);

  async function load() {
    const [{ data: l }, { data: c }, { data: ct }, { data: pd }, { data: pf }, { data: fr }] = await Promise.all([
      supabase.from("lancamentos_financeiros").select("*").eq("tipo", "saida").order("data_vencimento", { ascending: true }).limit(2000),
      supabase.from("categorias_financeiras").select("id,nome,parent_id").order("nome"),
      supabase.from("contas_bancarias").select("id,nome,banco").order("nome"),
      supabase.from("pedidos").select("id,codigo").limit(500),
      supabase.from("profiles").select("user_id,nome_completo"),
      supabase.from("fornecedores").select("id,nome").order("nome"),
    ]);
    setLancs((l as Lanc[]) || []);
    setCats((c as Cat[]) || []);
    setContas((ct as Conta[]) || []);
    setPedidos((pd as Pedido[]) || []);
    setProfiles((pf as Profile[]) || []);
    setFornecedores((fr as any[]) || []);
  }
  useEffect(() => { load(); }, []);

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.nome || "—";
  const contaName = (id: string | null) => contas.find((c) => c.id === id)?.nome || "—";
  const pedidoCod = (id: string | null) => pedidos.find((p) => p.id === id)?.codigo || null;
  const userName = (id: string | null) => profiles.find((p) => p.user_id === id)?.nome_completo || "Usuário";

  const filtrados = useMemo(() => {
    return lancs.filter((l) => {
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
      const isLiquidada = ["pago", "recebido", "conciliado"].includes(l.status || "");
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
  }, [lancs, dtIni, dtFim, categoriaFiltro, incluirPendentes, incluirLiquidadas, mostrarCancelados, incluirAprovadas, incluirNaoAprovadas, busca, cats, pedidos]);

  const [baixaOpen, setBaixaOpen] = useState(false);
  const [baixaAlvo, setBaixaAlvo] = useState<Lanc | null>(null);

  function abrirBaixa(l: Lanc) {
    setBaixaAlvo(l);
    setBaixaOpen(true);
  }

  async function confirmarBaixa(p: BaixaPayload) {
    if (!baixaAlvo) return;
    const agora = new Date();
    const original = Number(baixaAlvo.valor || 0);
    const pago = Number(p.valor) || 0;
    const diff = Math.round((original - pago) * 100) / 100;

    const { error } = await supabase.from("lancamentos_financeiros")
      .update({
        status: "pago",
        data_pagamento: p.data_pagamento,
        conta_id: p.conta_id,
        forma_pagamento: p.forma_pagamento,
        valor: pago,
        baixado_por: user?.id ?? null,
        baixado_em: agora.toISOString(),
      })
      .eq("id", baixaAlvo.id);
    if (error) { toast.error(error.message); return; }

    if (diff > 0.005) {
      const novoVenc = new Date();
      novoVenc.setDate(novoVenc.getDate() + 30);
      const { error: e2 } = await supabase.from("lancamentos_financeiros").insert({
        tipo: "saida",
        descricao: `${baixaAlvo.descricao || "Pagamento"} — saldo restante`,
        valor: diff,
        data_vencimento: novoVenc.toISOString().slice(0, 10),
        categoria_id: baixaAlvo.categoria_id,
        conta_id: p.conta_id,
        pedido_id: baixaAlvo.pedido_id,
        status: "pendente",
        aprovacao_status: baixaAlvo.aprovacao_status || "pendente_aprovacao",
        loja_id: (baixaAlvo as any).loja_id ?? null,
      });
      if (e2) toast.error("Baixa OK, mas falhou criar saldo: " + e2.message);
      else toast.success(`Pago. Parcela de saldo (${diff.toFixed(2)}) criada.`);
    } else {
      toast.success("Pago");
    }
    load();
  }

  async function estornar(l: Lanc) {
    if (!confirm("Estornar este pagamento? A parcela voltará para pendente.")) return;
    const { error } = await supabase.from("lancamentos_financeiros")
      .update({ status: "pendente", data_pagamento: null, baixado_por: null, baixado_em: null, forma_pagamento: null })
      .eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Estornado"); load();
  }

  async function cancelar(l: Lanc) {
    if (!confirm("Cancelar este lançamento?")) return;
    const { error } = await supabase.from("lancamentos_financeiros").update({ status: "cancelado" }).eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cancelado"); load();
  }

  const total = filtrados
    .filter((l) => !["pago", "recebido", "conciliado", "cancelado"].includes(l.status || ""))
    .reduce((s, l) => s + Number(l.valor || 0), 0);


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
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total Pendente</div>
          <div className="text-2xl font-bold text-rose-700">{BRL(total)}</div>
        </div>
      </div>

      <LancamentosFiltros
        busca={busca} setBusca={setBusca}
        dtIni={dtIni} setDtIni={setDtIni}
        dtFim={dtFim} setDtFim={setDtFim}
        cats={cats}
        categoriaFiltro={categoriaFiltro} setCategoriaFiltro={setCategoriaFiltro}
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
                <th className="text-left py-3 px-5 font-medium">Vencimento</th>
                <th className="text-left py-3 font-medium">Descrição</th>
                <th className="text-left py-3 font-medium">Categoria</th>
                <th className="text-left py-3 font-medium">Conta</th>
                <th className="text-right py-3 font-medium">Valor</th>
                <th className="text-center py-3 font-medium">Status</th>
                <th className="text-right py-3 px-5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => {
                const cod = pedidoCod(l.pedido_id);
                const pago = ["pago", "recebido", "conciliado"].includes(l.status || "");
                const cancelado = l.status === "cancelado";
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
                    <td className="py-4 px-5 whitespace-nowrap">{fmt(l.data_vencimento)}</td>
                    <td>
                      <div className="font-medium">{l.descricao || "—"}</div>
                      {cod && (
                        <div className="text-[11px] text-muted-foreground">
                          <Link to={`/pedidos/${l.pedido_id}`} className="text-primary hover:underline">[{cod}]</Link>
                        </div>
                      )}
                    </td>
                    <td>{catName(l.categoria_id)}</td>
                    <td>{contaName(l.conta_id)}</td>
                    <td className="text-right font-semibold whitespace-nowrap text-rose-700">{BRL(Number(l.valor || 0))}</td>
                    <td className="text-center">
                      <div className="inline-flex items-center">
                        {cancelado ? <Badge variant="destructive">CANCELADO</Badge>
                          : pago ? <Badge className="bg-emerald-500/15 text-emerald-700">PAGO</Badge>
                          : <Badge className="bg-violet-500/15 text-violet-700">PENDENTE</Badge>}
                        {baixaInfo}
                      </div>
                    </td>
                    <td className="text-right px-5">
                      <div className="flex justify-end gap-1">
                        {!pago && !cancelado && (
                          <>
                            <Button size="icon" variant="ghost" title="Liquidar" onClick={() => abrirBaixa(l)}>
                              <Check className="w-4 h-4 text-emerald-600" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Cancelar" onClick={() => cancelar(l)}>
                              <X className="w-4 h-4 text-rose-500" />
                            </Button>
                          </>
                        )}
                        {pago && !cancelado && (
                          <Button size="icon" variant="ghost" title="Estornar pagamento" onClick={() => estornar(l)}>
                            <RotateCcw className="w-4 h-4 text-amber-600" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtrados.length && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-60" />
                  Nenhuma conta a pagar
                </td></tr>
              )}
            </tbody>
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
        contaIdAtual={baixaAlvo?.conta_id ?? null}
        contas={contas}
        onConfirm={confirmarBaixa}
      />
    </div>
  );
}
