import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BRL } from "@/lib/financeiro";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type Pedido = {
  id: string;
  codigo: string;
  cliente_id: string | null;
  cliente_nome?: string;
  etiquetas?: string;
  data?: string | null;
  valor_total: number;
  juros_total: number;
  rt_repassado: number;
  custo_fabrica: number | null;
  valor_liquido: number | null;
  loja_id: string | null;
  ajuste?: {
    valor_venda_liquida_ajustado: number | null;
    custo_revisao_ajustado: number | null;
  } | null;
};

interface Props {
  dtIni: string;
  dtFim: string;
  lojaIds: string[];
}

export default function ReceitaPorPedido({ dtIni, dtFim, lojaIds }: Props) {
  const [rows, setRows] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const { can, isAdmin } = usePermissions();
  const podeEditar = isAdmin || can("relatorios_financeiros", "editar_resultado_pedido");
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from("pedidos")
        .select("id, codigo, cliente_id, valor_total, juros_total, rt_repassado, custo_fabrica, valor_liquido, loja_id, created_at")
        .gte("created_at", dtIni)
        .lte("created_at", dtFim + "T23:59:59")
        .order("created_at", { ascending: false });
      if (lojaIds.length) q = q.in("loja_id", lojaIds);
      const { data: peds } = await q;
      const lista = (peds as any[]) || [];
      const ids = lista.map((p) => p.id);
      const clienteIds = Array.from(new Set(lista.map((p) => p.cliente_id).filter(Boolean)));
      const [{ data: clientes }, { data: ajustes }, { data: pe }] = await Promise.all([
        clienteIds.length
          ? supabase.from("clientes").select("id, nome").in("id", clienteIds)
          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase.from("resultado_pedido_ajustes").select("pedido_id, valor_venda_liquida_ajustado, custo_revisao_ajustado").in("pedido_id", ids)
          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase.from("pedido_etiquetas").select("pedido_id, etiquetas:etiqueta_id(nome)").in("pedido_id", ids)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const cliMap = new Map((clientes || []).map((c: any) => [c.id, c.nome]));
      const ajMap = new Map((ajustes || []).map((a: any) => [a.pedido_id, a]));
      const etMap = new Map<string, string[]>();
      for (const r of (pe as any[]) || []) {
        const arr = etMap.get(r.pedido_id) || [];
        if (r.etiquetas?.nome) arr.push(r.etiquetas.nome);
        etMap.set(r.pedido_id, arr);
      }
      setRows(lista.map((p) => ({
        ...p,
        cliente_nome: cliMap.get(p.cliente_id || "") || "—",
        etiquetas: (etMap.get(p.id) || []).join(", "),
        data: p.created_at,
        ajuste: ajMap.get(p.id) || null,
      })));
      setLoading(false);
    })();
  }, [dtIni, dtFim, lojaIds.join(",")]);

  function calc(p: Pedido) {
    const venda = Number(p.valor_total || 0);
    const juros = Number(p.juros_total || 0);
    const rt = Number(p.rt_repassado || 0);
    const liqAuto = venda - juros - rt;
    const liq = p.ajuste?.valor_venda_liquida_ajustado ?? (p.valor_liquido ?? liqAuto);
    const custoVenda = Number(p.custo_fabrica || 0);
    const custoRev = p.ajuste?.custo_revisao_ajustado ?? custoVenda;
    const lucroVenda = liq - custoVenda;
    const lucroRev = liq - custoRev;
    const margemVenda = liq ? (lucroVenda / liq) * 100 : 0;
    const margemRev = liq ? (lucroRev / liq) * 100 : 0;
    return { venda, juros, rt, liq, custoVenda, custoRev, lucroVenda, lucroRev, margemVenda, margemRev };
  }

  async function salvarAjuste(pedido: Pedido, campo: "valor_venda_liquida_ajustado" | "custo_revisao_ajustado", valor: number | null) {
    if (!podeEditar) return;
    const userResp = await supabase.auth.getUser();
    const userId = userResp.data.user?.id;
    const atual = pedido.ajuste || { valor_venda_liquida_ajustado: null, custo_revisao_ajustado: null };
    const payload = {
      pedido_id: pedido.id,
      loja_id: pedido.loja_id,
      valor_venda_liquida_ajustado: campo === "valor_venda_liquida_ajustado" ? valor : atual.valor_venda_liquida_ajustado,
      custo_revisao_ajustado: campo === "custo_revisao_ajustado" ? valor : atual.custo_revisao_ajustado,
      atualizado_por: userId,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await supabase.from("resultado_pedido_ajustes").upsert(payload, { onConflict: "pedido_id" });
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    setRows((rs) => rs.map((r) => r.id === pedido.id ? { ...r, ajuste: { valor_venda_liquida_ajustado: payload.valor_venda_liquida_ajustado, custo_revisao_ajustado: payload.custo_revisao_ajustado } } : r));
    toast.success("Ajuste salvo");
  }

  const chartData = useMemo(() => rows.slice(0, 15).map((p) => {
    const c = calc(p);
    return { name: p.codigo, "Lucro Revisado": Math.round(c.lucroRev) };
  }), [rows]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-3">
        <div className="text-xs font-semibold mb-2">Lucro Revisado por Pedido (top 15)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" fontSize={9} angle={-30} textAnchor="end" height={50} interval={0} />
            <YAxis fontSize={10} />
            <Tooltip formatter={(v: any) => BRL(Number(v))} />
            <Bar dataKey="Lucro Revisado" fill="hsl(var(--primary))" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-[11px] min-w-[1400px]">
          <thead className="bg-muted/50 text-[10px] uppercase">
            <tr>
              <th className="text-left p-2">Pedido</th>
              <th className="text-left p-2">Etiqueta</th>
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Cliente</th>
              <th className="text-right p-2">Valor Venda</th>
              <th className="text-right p-2">Juros</th>
              <th className="text-right p-2">RT</th>
              <th className="text-right p-2">Valor Líquido*</th>
              <th className="text-right p-2">Custo Venda</th>
              <th className="text-right p-2">Custo Revisão*</th>
              <th className="text-right p-2">Lucro Venda</th>
              <th className="text-right p-2">Lucro Revisado</th>
              <th className="text-right p-2">Margem V.%</th>
              <th className="text-right p-2">Margem R.%</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={15} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>}
            {!loading && !rows.length && <tr><td colSpan={15} className="p-6 text-center text-muted-foreground">Sem pedidos no período.</td></tr>}
            {rows.map((p) => {
              const c = calc(p);
              return (
                <tr key={p.id} className="border-t hover:bg-muted/20">
                  <td className="p-1.5">
                    <button onClick={() => nav(`/pedido/${p.id}`)} className="text-primary hover:underline font-medium">{p.codigo}</button>
                  </td>
                  <td className="p-1.5 text-muted-foreground">{p.etiquetas || "—"}</td>
                  <td className="p-1.5">{p.data ? new Date(p.data).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="p-1.5">{p.cliente_nome}</td>
                  <td className="p-1.5 text-right">{BRL(c.venda)}</td>
                  <td className="p-1.5 text-right">{BRL(c.juros)}</td>
                  <td className="p-1.5 text-right">{BRL(c.rt)}</td>
                  <td className="p-1.5 text-right">
                    {podeEditar ? (
                      <Input
                        type="number" step="0.01" defaultValue={c.liq.toFixed(2)}
                        className="h-7 text-[11px] text-right w-28 ml-auto"
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && Math.abs(v - c.liq) > 0.001) salvarAjuste(p, "valor_venda_liquida_ajustado", v);
                        }}
                      />
                    ) : BRL(c.liq)}
                  </td>
                  <td className="p-1.5 text-right">{BRL(c.custoVenda)}</td>
                  <td className="p-1.5 text-right">
                    {podeEditar ? (
                      <Input
                        type="number" step="0.01" defaultValue={c.custoRev.toFixed(2)}
                        className="h-7 text-[11px] text-right w-28 ml-auto"
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && Math.abs(v - c.custoRev) > 0.001) salvarAjuste(p, "custo_revisao_ajustado", v);
                        }}
                      />
                    ) : BRL(c.custoRev)}
                  </td>
                  <td className={`p-1.5 text-right font-medium ${c.lucroVenda >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{BRL(c.lucroVenda)}</td>
                  <td className={`p-1.5 text-right font-semibold ${c.lucroRev >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{BRL(c.lucroRev)}</td>
                  <td className="p-1.5 text-right">{c.margemVenda.toFixed(1)}%</td>
                  <td className="p-1.5 text-right font-medium">{c.margemRev.toFixed(1)}%</td>
                  <td className="p-1.5">
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => nav(`/financeiro/analise/${p.id}`)}>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="text-[10px] text-muted-foreground p-2 border-t">
          * Campos editáveis. Ajustes ficam salvos no relatório e não alteram pedido, contas a receber ou baixa.
        </div>
      </div>
    </div>
  );
}

export type { Pedido as ReceitaPorPedidoRow };
