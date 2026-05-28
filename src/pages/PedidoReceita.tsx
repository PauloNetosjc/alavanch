import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Wallet, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

type Parcela = {
  numero: number;
  valor: number;
  acrescimo: number;
  desconto: number;
  recebido: number;
  saldo: number;
  vencimento: string | null;
  forma: string;
  status?: string | null;
  data_pagamento?: string | null;
};

const statusBadge = (status?: string | null) => {
  const s = (status || "").toLowerCase();
  if (s === "pago" || s === "recebido" || s === "baixado")
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Recebido</span>;
  if (s === "vencido" || s === "atrasado")
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">Vencido</span>;
  if (s === "pendente" || s === "aberto" || s === "a_receber")
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pendente</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{status || "—"}</span>;
};

export default function PedidoReceita() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [pedido, setPedido] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [loja, setLoja] = useState<any>(null);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [criador, setCriador] = useState<any>(null);

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
    if (ped?.id) {
      const { data: lanc } = await supabase
        .from("lancamentos_financeiros")
        .select("*")
        .eq("tipo", "entrada")
        .eq("pedido_id", ped.id)
        .order("data_vencimento", { ascending: true });
      setLancamentos(lanc || []);
    }
    if (ped?.estagio_responsavel_id) {
      const { data: prof } = await supabase.from("profiles").select("nome_completo, email").eq("user_id", ped.estagio_responsavel_id).maybeSingle();
      setCriador(prof);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  const integrado = lancamentos.length > 0;

  const parcelas: Parcela[] = useMemo(() => {
    // Fonte primária: lancamentos_financeiros
    if (integrado) {
      return lancamentos.map((l, idx) => {
        const valor = Number(l.valor) || 0;
        const recebido = l.data_pagamento ? valor : 0;
        return {
          numero: idx + 1,
          valor,
          acrescimo: 0,
          desconto: 0,
          recebido,
          saldo: valor - recebido,
          vencimento: l.data_vencimento || null,
          forma: l.forma_pagamento || "—",
          status: l.status,
          data_pagamento: l.data_pagamento || null,
        };
      });
    }

    // Fallback: pagamentos_orcamento (suporta array de objetos OU array de números)
    const out: Parcela[] = [];
    let i = 1;
    for (const p of pagamentos) {
      const detalhe = (p.parcelas_detalhe as any[]) || [];
      const vencs = (p.parcelas_vencimentos as any[]) || [];
      const formas = (p.parcelas_formas as any[]) || [];
      const formaDefault = p.forma_pagamento || p.metodo || "—";

      if (Array.isArray(detalhe) && detalhe.length) {
        detalhe.forEach((d: any, k: number) => {
          const isObj = d && typeof d === "object" && !Array.isArray(d);
          const valor = isObj ? Number(d.valor) || 0 : Number(d) || 0;
          const venc = (isObj ? (d.data_vencimento || d.data) : null) || vencs[k] || null;
          const forma = (isObj ? (d.forma_pagamento || d.forma) : null) || formas[k] || formaDefault;
          out.push({
            numero: i++,
            valor,
            acrescimo: 0,
            desconto: 0,
            recebido: 0,
            saldo: valor,
            vencimento: venc,
            forma,
            status: "pendente",
          });
        });
      } else {
        const qtd = Number(p.parcelas) || 1;
        const valorTotal = Number(p.valor) || 0;
        const valorParcela = qtd > 0 ? valorTotal / qtd : valorTotal;
        const baseDate = p.data_vencimento ? new Date(p.data_vencimento) : null;
        for (let k = 0; k < qtd; k++) {
          let dataStr: string | null = vencs[k] || null;
          if (!dataStr && baseDate) {
            const d = new Date(baseDate);
            d.setMonth(d.getMonth() + k);
            dataStr = d.toISOString().slice(0, 10);
          }
          out.push({
            numero: i++,
            valor: valorParcela,
            acrescimo: 0,
            desconto: 0,
            recebido: 0,
            saldo: valorParcela,
            vencimento: dataStr,
            forma: formas[k] || formaDefault,
            status: "pendente",
          });
        }
      }
    }
    return out;
  }, [integrado, lancamentos, pagamentos]);

  const totais = useMemo(() => {
    const valor = parcelas.reduce((s, p) => s + p.valor, 0);
    const acrescimo = parcelas.reduce((s, p) => s + (p.acrescimo || 0), 0);
    const desconto = parcelas.reduce((s, p) => s + (p.desconto || 0), 0);
    const recebido = parcelas.reduce((s, p) => s + (p.recebido || 0), 0);
    const saldo = parcelas.reduce((s, p) => s + (p.saldo || 0), 0);
    return { valor, acrescimo, desconto, recebido, saldo };
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

  if (loading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!pedido) return <div className="p-6 text-muted-foreground">Pedido não encontrado.</div>;

  const codigo = pedido.receita_codigo || "—";
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
        <div className="text-[12px] text-muted-foreground">
          Criado em {fmtDateTime(competencia)}
        </div>
        {criador?.email && (
          <div className="text-[12px] text-muted-foreground">Por {criador.nome_completo || criador.email}</div>
        )}
      </section>

      {!integrado && (
        <section className="surface-card p-4 border border-amber-200 bg-amber-50/50 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2 text-[13px] text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              Esta receita ainda não foi integrada ao A Receber. Os valores exibidos abaixo vêm da negociação do orçamento.
            </div>
          </div>
          <Button onClick={gerarReceber} disabled={gerando} size="sm">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${gerando ? "animate-spin" : ""}`} />
            {gerando ? "Gerando…" : "Gerar contas a receber"}
          </Button>
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

      <section className="surface-card p-6 grid grid-cols-2 md:grid-cols-5 gap-5 text-[13px]">
        <Field label="Valor base">{fmtBrl(totais.valor)}</Field>
        <Field label="Impostos">{fmtBrl(0)}</Field>
        <Field label="Valor">{fmtBrl(totais.valor + totais.acrescimo - totais.desconto)}</Field>
        <Field label="Acréscimo">{fmtBrl(totais.acrescimo)}</Field>
        <Field label="Desconto">{fmtBrl(totais.desconto)}</Field>
        <Field label="Recebido">{fmtBrl(totais.recebido)}</Field>
        <Field label="Saldo">{fmtBrl(totais.saldo)}</Field>
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
                <th className="text-left p-3">#</th>
                <th className="text-left p-3">Vencimento</th>
                <th className="text-left p-3">Forma de pagamento</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-right p-3">Acréscimo</th>
                <th className="text-right p-3">Desconto</th>
                <th className="text-right p-3">Recebido</th>
                <th className="text-right p-3">Saldo</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Pago em</th>
              </tr>
            </thead>
            <tbody>
              {parcelas.length === 0 && (
                <tr><td className="p-4 text-center text-muted-foreground" colSpan={10}>Nenhuma parcela cadastrada.</td></tr>
              )}
              {parcelas.map((p) => (
                <tr key={p.numero} className="border-t">
                  <td className="p-3">{p.numero}/{parcelas.length}</td>
                  <td className="p-3">{fmtDate(p.vencimento)}</td>
                  <td className="p-3">{p.forma}</td>
                  <td className="p-3 text-right">{fmtBrl(p.valor)}</td>
                  <td className="p-3 text-right">{fmtBrl(p.acrescimo)}</td>
                  <td className="p-3 text-right">{fmtBrl(p.desconto)}</td>
                  <td className="p-3 text-right">{fmtBrl(p.recebido)}</td>
                  <td className="p-3 text-right">{fmtBrl(p.saldo)}</td>
                  <td className="p-3">{statusBadge(p.status)}</td>
                  <td className="p-3">{fmtDate(p.data_pagamento)}</td>
                </tr>
              ))}
              {parcelas.length > 0 && (
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="p-3" colSpan={3}>Total</td>
                  <td className="p-3 text-right">{fmtBrl(totais.valor)}</td>
                  <td className="p-3 text-right">{fmtBrl(totais.acrescimo)}</td>
                  <td className="p-3 text-right">{fmtBrl(totais.desconto)}</td>
                  <td className="p-3 text-right">{fmtBrl(totais.recebido)}</td>
                  <td className="p-3 text-right">{fmtBrl(totais.saldo)}</td>
                  <td className="p-3" colSpan={2}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
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
