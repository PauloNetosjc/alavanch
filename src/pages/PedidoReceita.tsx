import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ArrowLeft, Wallet, CheckCircle2, AlertTriangle, RefreshCw, Check, Pencil, RotateCcw, Layers, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BaixaLancamentoDialog, { type BaixaPayload, TOLERANCIA_PERC } from "@/components/financeiro/BaixaLancamentoDialog";
import EditarLancamentoDialog, { type EditarPayload } from "@/components/financeiro/EditarLancamentoDialog";
import { gerarPreviewReceita, type MetodoPagamento } from "@/lib/receitaPreview";

const fmtBrl = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: any) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
};
const fmtDateTime = (d: any) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return "—"; }
};

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
  forma_pagamento: string | null;
  notas: string | null;
  loja_id: string | null;
  baixado_por: string | null;
  baixado_em: string | null;
  juros_previsto?: number | null;
  juros_real?: number | null;
  taxa_perc?: number | null;
  numero_parcela?: number | null;
  total_parcelas?: number | null;
  agrupado?: boolean | null;

};

type Parcela = {
  numero: number;
  total: number;
  valor: number;
  juros: number;
  juros_real: number;
  taxa_perc: number;
  recebido: number;
  saldo: number;
  vencimento: string | null;
  forma: string;
  agrupado: boolean;
  status?: string | null;
  data_pagamento?: string | null;
  lanc?: Lanc;
  origemReal: boolean;
};


const isPago = (s?: string | null) =>
  ["pago", "recebido", "conciliado", "baixado"].includes((s || "").toLowerCase());
const isVencido = (p: Parcela) => {
  if (isPago(p.status)) return false;
  if (!p.vencimento) return false;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const v = new Date(p.vencimento + "T00:00");
  return v < hoje;
};

const statusBadge = (p: Parcela) => {
  if (isPago(p.status))
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Recebido</span>;
  if (isVencido(p))
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">Vencido</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pendente</span>;
};

export default function PedidoReceita() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const { can } = usePermissions();
  const podeEditar = can("lancamentos", "edit");

  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [pedido, setPedido] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [loja, setLoja] = useState<any>(null);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [metodos, setMetodos] = useState<MetodoPagamento[]>([]);
  const [lancamentos, setLancamentos] = useState<Lanc[]>([]);
  const [contas, setContas] = useState<{ id: string; nome: string; banco: string | null }[]>([]);
  const [criador, setCriador] = useState<any>(null);
  const [souAprovador, setSouAprovador] = useState(false);

  const [baixaOpen, setBaixaOpen] = useState(false);
  const [baixaAlvo, setBaixaAlvo] = useState<Lanc | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editAlvo, setEditAlvo] = useState<Lanc | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: ped } = await supabase.from("pedidos").select("*").eq("id", id).maybeSingle();
    setPedido(ped);
    if (ped?.cliente_id) {
      const { data: cli } = await supabase.from("clientes").select("*").eq("id", ped.cliente_id).maybeSingle();
      setCliente(cli);
    }
    if (ped?.loja_id) {
      const { data: lj } = await supabase.from("lojas").select("*").eq("id", ped.loja_id).maybeSingle();
      setLoja(lj);
    }
    if (ped?.orcamento_id) {
      const { data: pags } = await supabase.from("pagamentos_orcamento").select("*").eq("orcamento_id", ped.orcamento_id);
      setPagamentos(pags || []);
    }
    const { data: mets } = await supabase.from("metodos_pagamento").select("*");
    setMetodos(((mets as any[]) || []) as MetodoPagamento[]);
    if (ped?.id) {
      const { data: lanc } = await supabase
        .from("lancamentos_financeiros")
        .select("*")
        .eq("tipo", "entrada")
        .eq("pedido_id", ped.id)
        .order("data_vencimento", { ascending: true });
      setLancamentos((lanc as Lanc[]) || []);
    }
    const { data: ct } = await supabase.from("contas_bancarias").select("id,nome,banco").order("nome");
    setContas((ct as any[]) || []);
    if (ped?.estagio_responsavel_id) {
      const { data: prof } = await supabase.from("profiles").select("nome_completo, email").eq("user_id", ped.estagio_responsavel_id).maybeSingle();
      setCriador(prof);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      if (role === "admin") { setSouAprovador(true); return; }
      const { data } = await supabase.from("aprovadores_financeiros" as any)
        .select("aprova_receber").eq("user_id", user.id);
      setSouAprovador(((data as any[]) || []).some((r) => r.aprova_receber));
    })();
  }, [user, role]);

  const integrado = lancamentos.length > 0;
  const reapprovalPatch = () => souAprovador ? {} : { aprovacao_status: "pendente_aprovacao", aprovado_por: null, aprovado_em: null };

  const parcelas: Parcela[] = useMemo(() => {
    if (integrado) {
      const total = lancamentos.length;
      return lancamentos.map<Parcela>((l, idx) => {
        const valor = Number(l.valor) || 0;
        const juros = Number(l.juros_previsto || 0);
        const pago = isPago(l.status);
        const jurosReal = Number(l.juros_real || 0);
        const recebido = pago ? Math.round((valor - jurosReal) * 100) / 100 : 0;
        const saldo = pago ? 0 : Math.max(valor - juros, 0);
        const m = (l.descricao || "").match(/Parcela\s+(\d+)\s*\/\s*(\d+)/i);
        return {
          numero: l.numero_parcela ?? (m ? parseInt(m[1], 10) : idx + 1),
          total: l.total_parcelas ?? (m ? parseInt(m[2], 10) : total),
          valor,
          juros,
          juros_real: pago ? jurosReal : 0,
          taxa_perc: Number(l.taxa_perc || 0),
          recebido,
          saldo,
          vencimento: l.data_vencimento || null,
          forma: l.forma_pagamento || "—",
          agrupado: !!l.agrupado,
          status: l.status,
          data_pagamento: l.data_pagamento || null,
          lanc: l,
          origemReal: true,
        };
      });
    }
    // Fallback (prévia): usa o mesmo cálculo do gerador SQL
    const dataBase = (pedido?.created_at || new Date().toISOString()).slice(0, 10);
    const prev = gerarPreviewReceita(pagamentos as any, metodos, dataBase);
    return prev.map<Parcela>((p) => ({
      numero: p.numero,
      total: p.total,
      valor: p.valor,
      juros: p.juros,
      juros_real: 0,
      taxa_perc: p.taxa_perc,
      recebido: 0,
      saldo: Math.max(p.valor - p.juros, 0),
      vencimento: p.vencimento,
      forma: p.forma,
      agrupado: p.agrupado,
      status: p.status,
      origemReal: false,
    }));
  }, [integrado, lancamentos, pagamentos, metodos, pedido]);


  const totais = useMemo(() => {
    const valor = parcelas.reduce((s, p) => s + p.valor, 0);
    const juros = parcelas.reduce((s, p) => s + (p.juros || 0), 0);
    const jurosReal = parcelas.reduce((s, p) => s + (p.juros_real || 0), 0);
    const recebido = parcelas.reduce((s, p) => s + (p.recebido || 0), 0);
    const saldo = parcelas.reduce((s, p) => s + (p.saldo || 0), 0);
    const pendentes = parcelas.filter((p) => !isPago(p.status) && !isVencido(p)).length;
    const liquidadas = parcelas.filter((p) => isPago(p.status)).length;
    const vencidas = parcelas.filter((p) => isVencido(p)).length;
    return { valor, juros, jurosReal, recebido, saldo, pendentes, liquidadas, vencidas };
  }, [parcelas]);


  const gerarReceber = async () => {
    if (!pedido?.id) return;
    setGerando(true);
    try {
      const { error } = await (supabase as any).rpc("gerar_receber_de_pedido_assinado", { p_pedido_id: pedido.id });
      if (error) throw error;
      toast.success("Contas a receber geradas a partir da negociação.");
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar contas a receber.");
    } finally {
      setGerando(false);
    }
  };

  async function salvarEdicao(p: EditarPayload) {
    if (!editAlvo) return;
    const { error } = await supabase.from("lancamentos_financeiros").update({
      data_vencimento: p.data_vencimento,
      data_pagamento: p.data_pagamento,
      valor: p.valor,
      forma_pagamento: p.forma_pagamento,
      notas: p.notas,
      ...reapprovalPatch(),
    }).eq("id", editAlvo.id);
    if (error) { toast.error(error.message); return; }
    toast.success(souAprovador ? "Parcela atualizada" : "Parcela atualizada — enviada para aprovação");
    carregar();
  }

  async function confirmarBaixa(p: BaixaPayload) {
    if (!baixaAlvo) return;
    const agora = new Date();
    const bruto = Number(baixaAlvo.valor || 0);
    const juros = Number(baixaAlvo.juros_previsto || 0);
    const liquidoPrev = Math.max(0, Math.round((bruto - juros) * 100) / 100);
    const recebido = Number(p.valor) || 0;
    const jurosReal = Math.round((bruto - recebido) * 100) / 100;
    const diff = Math.round((recebido - liquidoPrev) * 100) / 100;
    const percDiff = liquidoPrev > 0 ? Math.abs(diff) / liquidoPrev * 100 : 0;
    const exigeAprov = !souAprovador && diff < -0.005 && percDiff > TOLERANCIA_PERC;

    const contaTrocada = (baixaAlvo.conta_id || "") !== (p.conta_id || "");
    const contaAnt = contas.find((c) => c.id === baixaAlvo.conta_id)?.nome || "—";
    const contaNova = contas.find((c) => c.id === p.conta_id)?.nome || "—";
    const auditoria: string[] = [];
    if (contaTrocada) auditoria.push(`Conta alterada de "${contaAnt}" para "${contaNova}" em ${agora.toLocaleString("pt-BR")}.`);
    auditoria.push(`Recebido ${fmtBrl(recebido)} sobre bruto ${fmtBrl(bruto)} (juros previsto ${fmtBrl(juros)}, juros real ${fmtBrl(jurosReal)}).`);
    if (diff > 0.005) auditoria.push(`Diferença positiva: ${fmtBrl(diff)}.`);
    else if (diff < -0.005) auditoria.push(`Diferença negativa: ${fmtBrl(Math.abs(diff))} (${percDiff.toFixed(2)}%)${exigeAprov ? " — enviado para Aprovador" : " — dentro da tolerância"}.`);
    const notasNovas = [baixaAlvo.notas, ...auditoria].filter(Boolean).join("\n");

    const { error } = await supabase.from("lancamentos_financeiros").update({
      status: "recebido",
      data_pagamento: p.data_pagamento,
      conta_id: p.conta_id,
      forma_pagamento: p.forma_pagamento,
      juros_real: jurosReal,
      baixado_por: user?.id ?? null,
      baixado_em: agora.toISOString(),
      notas: notasNovas,
      ...(exigeAprov ? { aprovacao_status: "pendente_aprovacao", aprovado_por: null, aprovado_em: null } : {}),
    }).eq("id", baixaAlvo.id);
    if (error) { toast.error(error.message); return; }
    if (diff > 0.005) toast.success(`Recebido. Diferença positiva: ${fmtBrl(diff)}.`);
    else if (exigeAprov) toast.success("Baixa registrada — enviada para Aprovador.");
    else toast.success("Recebido");
    carregar();
  }


  async function estornar(l: Lanc) {
    if (!confirm("Estornar este recebimento? A parcela voltará para pendente.")) return;
    const { error } = await supabase.from("lancamentos_financeiros")
      .update({ status: "pendente", data_pagamento: null, baixado_por: null, baixado_em: null, forma_pagamento: null, juros_real: 0, ...reapprovalPatch() })
      .eq("id", l.id);

    if (error) { toast.error(error.message); return; }
    toast.success(souAprovador ? "Estornado" : "Estornado — enviado para aprovação");
    carregar();
  }

  if (loading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!pedido) return <div className="p-6 text-muted-foreground">Pedido não encontrado.</div>;

  const codigo = pedido.receita_codigo || pedido.codigo || "—";
  const competencia = pedido.created_at;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" asChild>
          <Link to={`/pedidos/${pedido.id}`}><ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar ao pedido</Link>
        </Button>
      </div>

      <section className="surface-card p-6 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-600" />
            <h1 className="font-playfair text-[26px] font-semibold">Receita #{codigo}</h1>
          </div>
          {integrado ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Integrado ao A Receber
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" /> Não integrado
            </span>
          )}
        </div>
        <div className="text-[12px] text-muted-foreground">Criado em {fmtDateTime(competencia)}</div>
        {criador?.email && (
          <div className="text-[12px] text-muted-foreground">Por {criador.nome_completo || criador.email}</div>
        )}
      </section>

      {!integrado && (
        <section className="surface-card p-4 border border-amber-200 bg-amber-50/50 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2 text-[13px] text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>Esta receita ainda não foi integrada ao A Receber. Os valores exibidos abaixo vêm da negociação do orçamento.</div>
          </div>
          {podeEditar && (
            <Button onClick={gerarReceber} disabled={gerando} size="sm">
              <RefreshCw className={`w-4 h-4 mr-1.5 ${gerando ? "animate-spin" : ""}`} />
              {gerando ? "Gerando…" : "Gerar contas a receber"}
            </Button>
          )}
        </section>
      )}

      <section className="surface-card p-6 grid grid-cols-2 md:grid-cols-3 gap-5 text-[13px]">
        <Field label="Competência">{fmtDate(competencia)}</Field>
        <Field label="Unidade de negócio">{loja?.nome || "—"}</Field>
        <Field label="Descrição">Venda #{pedido.codigo}</Field>
        <Field label="Contato">{cliente?.nome || "—"}</Field>
        <Field label="Pedido de venda">
          <Link to={`/pedidos/${pedido.id}`} className="text-primary hover:underline">{pedido.codigo}</Link>
        </Field>
        <Field label="Nro. documento">{pedido.receita_codigo || "—"}</Field>
      </section>

      <section className="surface-card p-6 grid grid-cols-2 md:grid-cols-4 gap-5 text-[13px]">
        <Field label="Valor bruto">{fmtBrl(totais.valor)}</Field>
        <Field label="Juros / Taxa previsto"><span className="text-amber-700">{fmtBrl(totais.juros)}</span></Field>
        <Field label="Juros Real">
          {Math.abs(totais.jurosReal) < 0.005 ? <span>R$ 0,00</span>
            : totais.jurosReal < 0 ? <span className="text-emerald-700">+{fmtBrl(Math.abs(totais.jurosReal))} (ganho)</span>
            : <span className="text-amber-700">{fmtBrl(totais.jurosReal)}</span>}
        </Field>
        <Field label="Recebido">{fmtBrl(totais.recebido)}</Field>
        <Field label="Saldo líquido"><span className="font-semibold">{fmtBrl(totais.saldo)}</span></Field>
        <Field label="Pendentes">{totais.pendentes}</Field>
        <Field label="Liquidadas">{totais.liquidadas}</Field>
        <Field label="Vencidas"><span className={totais.vencidas > 0 ? "text-red-600" : ""}>{totais.vencidas}</span></Field>
      </section>


      <section className="surface-card p-0 overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-playfair text-[18px] font-semibold">Parcelas</h3>
          {integrado && (
            <Link to="/financeiro/a-receber" className="text-[12px] text-primary hover:underline">
              Ver no A Receber →
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Código</th>
                <th className="text-left p-3">Vencimento</th>
                <th className="text-left p-3">Forma</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-right p-3">Juros / Taxa</th>
                <th className="text-right p-3">Recebido</th>
                <th className="text-right p-3">Saldo líquido</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Pago em</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {parcelas.length === 0 && (
                <tr><td className="p-4 text-center text-muted-foreground" colSpan={10}>Nenhuma parcela cadastrada.</td></tr>
              )}
              {parcelas.map((p) => {
                const pago = isPago(p.status);
                return (
                  <tr key={p.lanc?.id || p.numero} className="border-t">
                    <td className="p-3 font-mono text-[12px]">
                      #{codigo}-{p.numero}/{p.total}
                      {p.agrupado && (
                        <span className="ml-1.5 inline-block text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">Agrupado</span>
                      )}
                    </td>
                    <td className="p-3">{fmtDate(p.vencimento)}</td>
                    <td className="p-3">
                      {p.forma}
                      {p.agrupado && <div className="text-[10px] text-muted-foreground">Recebimento agrupado</div>}
                    </td>
                    <td className="p-3 text-right">{fmtBrl(p.valor)}</td>
                    <td className="p-3 text-right text-amber-700">
                      {p.juros > 0 ? fmtBrl(p.juros) : "—"}
                      {p.taxa_perc > 0 && <div className="text-[10px] text-muted-foreground">{p.taxa_perc.toFixed(2)}%</div>}
                    </td>
                    <td className="p-3 text-right">{fmtBrl(p.recebido)}</td>
                    <td className="p-3 text-right font-medium">{fmtBrl(p.saldo)}</td>
                    <td className="p-3">{statusBadge(p)}</td>
                    <td className="p-3">{fmtDate(p.data_pagamento)}</td>
                    <td className="p-3 text-right">
                      {p.origemReal && p.lanc ? (
                        <div className="inline-flex justify-end gap-1">
                          {!pago && (
                            <Button size="icon" variant="ghost" title="Receber" onClick={() => { setBaixaAlvo(p.lanc!); setBaixaOpen(true); }}>
                              <Check className="w-4 h-4 text-emerald-600" />
                            </Button>
                          )}
                          {pago && podeEditar && (
                            <Button size="icon" variant="ghost" title="Estornar recebimento" onClick={() => estornar(p.lanc!)}>
                              <RotateCcw className="w-4 h-4 text-amber-600" />
                            </Button>
                          )}
                          {podeEditar && (
                            <Button size="icon" variant="ghost" title="Alterar parcela" onClick={() => { setEditAlvo(p.lanc!); setEditOpen(true); }}>
                              <Pencil className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {parcelas.length > 0 && (
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="p-3" colSpan={3}>Total</td>
                  <td className="p-3 text-right">{fmtBrl(totais.valor)}</td>
                  <td className="p-3 text-right text-amber-700">{fmtBrl(totais.juros)}</td>
                  <td className="p-3 text-right">{fmtBrl(totais.recebido)}</td>
                  <td className="p-3 text-right">{fmtBrl(totais.saldo)}</td>
                  <td className="p-3" colSpan={3}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <BaixaLancamentoDialog
        open={baixaOpen}
        onOpenChange={setBaixaOpen}
        tipo="entrada"
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
        tipo="entrada"
        lanc={editAlvo ? {
          id: editAlvo.id,
          descricao: editAlvo.descricao,
          data_vencimento: editAlvo.data_vencimento,
          data_pagamento: editAlvo.data_pagamento,
          valor: Number(editAlvo.valor || 0),
          forma_pagamento: editAlvo.forma_pagamento,
          notas: editAlvo.notas,
          status: editAlvo.status,
        } : null}
        onSave={salvarEdicao}
        onEstornar={editAlvo ? () => estornar(editAlvo) : undefined}
      />
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className="text-[13px] font-medium">{children ?? "—"}</div>
    </div>
  );
}
