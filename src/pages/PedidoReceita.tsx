import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  total: number;
  data: string | null;
  forma: string;
  conta?: string | null;
  documento?: string | null;
  acrescimo?: number;
  desconto?: number;
  recebido?: number;
};

export default function PedidoReceita() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [pedido, setPedido] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [loja, setLoja] = useState<any>(null);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [criador, setCriador] = useState<any>(null);

  useEffect(() => { (async () => {
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
    if (ped?.estagio_responsavel_id) {
      const { data: prof } = await supabase.from("profiles").select("nome_completo, email").eq("user_id", ped.estagio_responsavel_id).maybeSingle();
      setCriador(prof);
    }
    setLoading(false);
  })(); }, [id]);

  const parcelas: Parcela[] = useMemo(() => {
    const out: Parcela[] = [];
    let i = 1;
    for (const p of pagamentos) {
      const detalhe = (p.parcelas_detalhe as any[]) || [];
      if (Array.isArray(detalhe) && detalhe.length) {
        for (const d of detalhe) {
          out.push({
            numero: i++,
            total: Number(d.valor) || 0,
            data: d.data_vencimento || d.data || null,
            forma: p.forma_pagamento || p.metodo || "—",
          });
        }
      } else {
        const qtd = Number(p.parcelas) || 1;
        const valorTotal = Number(p.valor) || 0;
        const valorParcela = qtd > 0 ? valorTotal / qtd : valorTotal;
        const baseDate = p.data_vencimento ? new Date(p.data_vencimento) : null;
        for (let k = 0; k < qtd; k++) {
          let dataStr: string | null = null;
          if (baseDate) {
            const d = new Date(baseDate);
            d.setMonth(d.getMonth() + k);
            dataStr = d.toISOString().slice(0, 10);
          }
          out.push({
            numero: i++,
            total: valorParcela,
            data: dataStr,
            forma: p.forma_pagamento || p.metodo || "—",
          });
        }
      }
    }
    return out;
  }, [pagamentos]);

  const totalParcelas = parcelas.reduce((s, p) => s + p.total, 0);

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

      <section className="surface-card p-6 space-y-1">
        <div className="flex items-center gap-2">
          <Wallet className="w-6 h-6 text-emerald-600" />
          <h1 className="font-playfair text-[26px] font-semibold">Receita #{codigo}</h1>
        </div>
        <div className="text-[12px] text-muted-foreground">
          Criado em {fmtDateTime(competencia)}
        </div>
        {criador?.email && (
          <div className="text-[12px] text-muted-foreground">Por {criador.nome_completo || criador.email}</div>
        )}
      </section>

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
        <Field label="Valor base">{fmtBrl(Number(pedido.valor_total) || 0)}</Field>
        <Field label="Impostos">{fmtBrl(0)}</Field>
        <Field label="Valor">{fmtBrl(Number(pedido.valor_total) || 0)}</Field>
        <Field label="Acréscimo">{fmtBrl(0)}</Field>
        <Field label="Desconto">{fmtBrl(0)}</Field>
        <Field label="Recebido">{fmtBrl(0)}</Field>
        <Field label="Saldo">{fmtBrl(Number(pedido.valor_total) || 0)}</Field>
      </section>

      <section className="surface-card p-0 overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-playfair text-[18px] font-semibold">Parcelas</h3>
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
              </tr>
            </thead>
            <tbody>
              {parcelas.length === 0 && (
                <tr><td className="p-4 text-center text-muted-foreground" colSpan={8}>Nenhuma parcela cadastrada.</td></tr>
              )}
              {parcelas.map((p) => (
                <tr key={p.numero} className="border-t">
                  <td className="p-3">{p.numero}/{parcelas.length}</td>
                  <td className="p-3">{fmtDate(p.data)}</td>
                  <td className="p-3">{p.forma}</td>
                  <td className="p-3 text-right">{fmtBrl(p.total)}</td>
                  <td className="p-3 text-right">{fmtBrl(0)}</td>
                  <td className="p-3 text-right">{fmtBrl(0)}</td>
                  <td className="p-3 text-right">{fmtBrl(0)}</td>
                  <td className="p-3 text-right">{fmtBrl(p.total)}</td>
                </tr>
              ))}
              {parcelas.length > 0 && (
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="p-3" colSpan={3}>Total</td>
                  <td className="p-3 text-right">{fmtBrl(totalParcelas)}</td>
                  <td className="p-3 text-right">{fmtBrl(0)}</td>
                  <td className="p-3 text-right">{fmtBrl(0)}</td>
                  <td className="p-3 text-right">{fmtBrl(0)}</td>
                  <td className="p-3 text-right">{fmtBrl(totalParcelas)}</td>
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
