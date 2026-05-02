import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, X, DollarSign, TrendingUp } from "lucide-react";
import { BRL } from "@/lib/financeiro";

type Parc = { id: string; nome: string; tipo: string; percentual_padrao: number | null };

type Props = { open: boolean; onClose: () => void; parceiro: Parc | null };

const presets = ["Hoje", "Esta Semana", "Este Mês", "Este Ano"] as const;

export function HistoricoParceiroDialog({ open, onClose, parceiro }: Props) {
  const isFornecedor = parceiro?.tipo === "fornecedor";
  const [tab, setTab] = useState<"pagamentos" | "indicacoes">("pagamentos");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [comprasFornecedor, setComprasFornecedor] = useState<any[]>([]);
  const [indicacoes, setIndicacoes] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !parceiro) return;
    setTab(isFornecedor ? "pagamentos" : "pagamentos");
    setInicio(""); setFim("");
    (async () => {
      // Pagamentos = parceiro_comissoes (indicador) OU parceiro_pedidos pagos (fornecedor)
      const { data: comm } = await supabase
        .from("parceiro_comissoes").select("*")
        .eq("parceiro_id", parceiro.id)
        .order("created_at", { ascending: false });
      setPagamentos(comm || []);

      const { data: cps } = await supabase
        .from("parceiro_pedidos").select("*, pedido:pedidos(codigo)")
        .eq("parceiro_id", parceiro.id)
        .order("created_at", { ascending: false });
      setComprasFornecedor(cps || []);

      // Indicações: orçamentos onde este parceiro é o parceiro_id
      const { data: orc } = await supabase
        .from("orcamentos").select("id,codigo,total,status,cliente_id, cliente:clientes(nome)")
        .eq("parceiro_id", parceiro.id);
      setIndicacoes(orc || []);
    })();
  }, [open, parceiro, isFornecedor]);

  function aplicarPreset(p: string) {
    const hoje = new Date();
    let i = new Date(); let f = new Date();
    if (p === "Hoje") { /* ok */ }
    else if (p === "Esta Semana") { i.setDate(hoje.getDate() - hoje.getDay()); }
    else if (p === "Este Mês") { i = new Date(hoje.getFullYear(), hoje.getMonth(), 1); }
    else if (p === "Este Ano") { i = new Date(hoje.getFullYear(), 0, 1); }
    setInicio(i.toISOString().slice(0, 10)); setFim(f.toISOString().slice(0, 10));
  }

  function noPeriodo(dataStr: string | null) {
    if (!inicio && !fim) return true;
    if (!dataStr) return false;
    const d = dataStr.slice(0, 10);
    if (inicio && d < inicio) return false;
    if (fim && d > fim) return false;
    return true;
  }

  const pagsFiltrados = useMemo(() => {
    if (isFornecedor) return comprasFornecedor.filter((c) => noPeriodo(c.created_at));
    return pagamentos.filter((c) => noPeriodo(c.data_pagamento || c.created_at));
  }, [isFornecedor, pagamentos, comprasFornecedor, inicio, fim]);

  const totalPeriodo = pagsFiltrados.reduce((s, c) => s + Number(c.valor || c.valor_corrigido || c.valor_calculado || 0), 0);

  // Indicações métricas
  const fechadas = indicacoes.filter((o) => ["confirmado", "convertido", "aprovado"].includes(o.status));
  const emOrcamento = indicacoes.filter((o) => ["negociacao", "rascunho"].includes(o.status));
  const perdidos = indicacoes.filter((o) => ["perdido", "cancelado"].includes(o.status));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div>Histórico - {parceiro?.nome}</div>
              <Badge variant="secondary" className="mt-1 capitalize">{parceiro?.tipo}</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {!isFornecedor && (
          <div className="flex gap-4 border-b pb-2 mb-4">
            <button onClick={() => setTab("pagamentos")} className={`flex items-center gap-2 pb-2 text-sm ${tab === "pagamentos" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}>
              <DollarSign className="w-4 h-4" /> Pagamentos
            </button>
            <button onClick={() => setTab("indicacoes")} className={`flex items-center gap-2 pb-2 text-sm ${tab === "indicacoes" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}>
              <TrendingUp className="w-4 h-4" /> Projetos Indicados
            </button>
          </div>
        )}

        {tab === "pagamentos" && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="text-sm font-medium flex items-center gap-2">Filtrar por Período</div>
              <div className="flex gap-2 flex-wrap">
                {presets.map((p) => <button key={p} onClick={() => aplicarPreset(p)} className="px-3 py-1 rounded-md bg-background text-xs hover:bg-muted">{p}</button>)}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Data Início</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
                <div><Label>Data Fim</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
                <div className="flex items-end"><Button className="w-full" onClick={() => { /* já reativo */ }}>Aplicar Filtro</Button></div>
              </div>
            </div>

            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-4">
              <div className="text-xs uppercase tracking-wider text-emerald-700">Valor do Período</div>
              <div className="text-2xl font-bold mt-1 text-emerald-700">{BRL(totalPeriodo)}</div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                  <th className="text-left py-3">Data</th>
                  <th className="text-left py-3">Descrição</th>
                  <th className="text-right py-3">Valor</th>
                  <th className="text-center py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {pagsFiltrados.map((c: any) => (
                  <tr key={c.id} className="border-b">
                    <td className="py-3">{new Date(c.data_pagamento || c.created_at).toLocaleDateString("pt-BR")}</td>
                    <td>
                      <div>{isFornecedor ? c.descricao : `Comissão: ${parceiro?.nome}`}</div>
                      <div className="text-xs text-muted-foreground">{isFornecedor ? `Pedido: ${c.pedido?.codigo || "—"}` : `Contrato: ${c.contrato_numero || "—"}`}</div>
                    </td>
                    <td className="text-right font-semibold">{BRL(Number(c.valor || c.valor_corrigido || c.valor_calculado || 0))}</td>
                    <td className="text-center"><Badge className={c.status === "paga" || c.status === "pago" ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}>{(c.status || "—").toUpperCase()}</Badge></td>
                  </tr>
                ))}
                {!pagsFiltrados.length && <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Nada no período</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "indicacoes" && !isFornecedor && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-4">
                <div className="text-xs uppercase tracking-wider text-emerald-700">Fechados</div>
                <div className="text-3xl font-bold mt-1">{fechadas.length}</div>
                <div className="text-sm text-emerald-700 mt-1">{BRL(fechadas.reduce((s, o) => s + Number(o.total || 0), 0))}</div>
              </div>
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-4">
                <div className="text-xs uppercase tracking-wider text-blue-700">Em Orçamento</div>
                <div className="text-3xl font-bold mt-1">{emOrcamento.length}</div>
                <div className="text-sm text-blue-700 mt-1">{BRL(emOrcamento.reduce((s, o) => s + Number(o.total || 0), 0))}</div>
              </div>
              <div className="rounded-xl border-2 border-rose-200 bg-rose-50/40 p-4">
                <div className="text-xs uppercase tracking-wider text-rose-700">Perdidos/Cancelados</div>
                <div className="text-3xl font-bold mt-1">{perdidos.length}</div>
                <div className="text-sm text-rose-700 mt-1">{BRL(perdidos.reduce((s, o) => s + Number(o.total || 0), 0))}</div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                  <th className="text-left py-3">Contrato</th>
                  <th className="text-left py-3">Cliente</th>
                  <th className="text-right py-3">Valor</th>
                  <th className="text-center py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {indicacoes.map((o: any) => (
                  <tr key={o.id} className="border-b">
                    <td className="py-3 text-primary font-medium">{o.codigo}</td>
                    <td>{o.cliente?.nome || "—"}</td>
                    <td className="text-right font-semibold">{BRL(Number(o.total || 0))}</td>
                    <td className="text-center"><Badge className="bg-emerald-500/15 text-emerald-700 uppercase">{o.status}</Badge></td>
                  </tr>
                ))}
                {!indicacoes.length && <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Sem indicações</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
