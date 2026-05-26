import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowUpCircle, AlertTriangle, Check, X } from "lucide-react";
import { BRL } from "@/lib/financeiro";
import { toast } from "sonner";

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
};
type Cat = { id: string; nome: string };
type Conta = { id: string; nome: string };
type Pedido = { id: string; codigo: string };

function fmt(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d + "T00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}

export default function ContasAReceber() {
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  async function load() {
    const [{ data: l }, { data: c }, { data: ct }, { data: pd }] = await Promise.all([
      supabase.from("lancamentos_financeiros").select("*").eq("tipo", "entrada").order("data_vencimento", { ascending: true }).limit(2000),
      supabase.from("categorias_financeiras").select("id,nome").order("nome"),
      supabase.from("contas_bancarias").select("id,nome").order("nome"),
      supabase.from("pedidos").select("id,codigo").limit(500),
    ]);
    setLancs((l as Lanc[]) || []);
    setCats((c as Cat[]) || []);
    setContas((ct as Conta[]) || []);
    setPedidos((pd as Pedido[]) || []);
  }
  useEffect(() => { load(); }, []);

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.nome || "—";
  const contaName = (id: string | null) => contas.find((c) => c.id === id)?.nome || "—";
  const pedidoCod = (id: string | null) => pedidos.find((p) => p.id === id)?.codigo || null;

  async function liquidar(l: Lanc) {
    const { error } = await supabase.from("lancamentos_financeiros")
      .update({ status: "recebido", data_pagamento: new Date().toISOString().slice(0, 10) })
      .eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Recebido"); load();
  }
  async function cancelar(l: Lanc) {
    if (!confirm("Cancelar este lançamento?")) return;
    const { error } = await supabase.from("lancamentos_financeiros").update({ status: "cancelado" }).eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Cancelado"); load();
  }

  const total = lancs
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
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <ArrowUpCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Contas a Receber</h1>
              <p className="text-sm text-muted-foreground">Entradas e recebimentos</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total Pendente</div>
          <div className="text-2xl font-bold text-emerald-700">{BRL(total)}</div>
        </div>
      </div>

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
              {lancs.map((l) => {
                const cod = pedidoCod(l.pedido_id);
                const pago = ["pago", "recebido", "conciliado"].includes(l.status || "");
                const cancelado = l.status === "cancelado";
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
                    <td className="text-right font-semibold whitespace-nowrap text-emerald-700">{BRL(Number(l.valor || 0))}</td>
                    <td className="text-center">
                      {cancelado ? <Badge variant="destructive">CANCELADO</Badge>
                        : pago ? <Badge className="bg-emerald-500/15 text-emerald-700">RECEBIDO</Badge>
                        : <Badge className="bg-violet-500/15 text-violet-700">PENDENTE</Badge>}
                    </td>
                    <td className="text-right px-5">
                      <div className="flex justify-end gap-1">
                        {!pago && !cancelado && (
                          <>
                            <Button size="icon" variant="ghost" title="Receber" onClick={() => liquidar(l)}>
                              <Check className="w-4 h-4 text-emerald-600" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Cancelar" onClick={() => cancelar(l)}>
                              <X className="w-4 h-4 text-rose-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!lancs.length && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-60" />
                  Nenhuma conta a receber
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
