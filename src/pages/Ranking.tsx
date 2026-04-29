import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Row = {
  user_id: string;
  nome: string;
  total: number;
  qtd: number;
  ticket: number;
};

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Ranking() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<"30" | "90" | "365" | "all">("30");

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from("orcamentos").select("consultor_id, total, status, created_at");
      if (periodo !== "all") {
        const since = new Date();
        since.setDate(since.getDate() - parseInt(periodo));
        q = q.gte("created_at", since.toISOString());
      }
      const { data: orcs } = await q;
      const { data: profs } = await supabase.from("profiles").select("user_id, nome_completo");
      const map = new Map<string, Row>();
      (orcs || []).filter((o) => o.status === "aprovado" || o.status === "fechado").forEach((o) => {
        if (!o.consultor_id) return;
        const cur = map.get(o.consultor_id) || {
          user_id: o.consultor_id,
          nome: profs?.find((p) => p.user_id === o.consultor_id)?.nome_completo || "—",
          total: 0, qtd: 0, ticket: 0,
        };
        cur.total += Number(o.total || 0);
        cur.qtd += 1;
        cur.ticket = cur.qtd > 0 ? cur.total / cur.qtd : 0;
        map.set(o.consultor_id, cur);
      });
      const arr = Array.from(map.values()).sort((a, b) => b.total - a.total);
      setRows(arr);
      setLoading(false);
    })();
  }, [periodo]);

  const total = rows.reduce((s, r) => s + r.total, 0);
  const meta = 100000; // meta padrão exemplo

  const medal = (i: number) => {
    if (i === 0) return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (i === 1) return <Medal className="w-4 h-4 text-gray-400" />;
    if (i === 2) return <Award className="w-4 h-4 text-amber-700" />;
    return <span className="text-[11px] text-muted-foreground w-4 inline-block text-center">{i + 1}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1>Ranking / Metas</h1>
          <p className="text-[12px] text-muted-foreground mt-1">
            Performance dos consultores baseada em orçamentos aprovados.
          </p>
        </div>
        <Select value={periodo} onValueChange={(v: any) => setPeriodo(v)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
            <SelectItem value="all">Todo período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="surface-card p-4">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Total Vendido</div>
          <div className="text-[22px] font-medium mt-1">{fmtBRL(total)}</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Consultores</div>
          <div className="text-[22px] font-medium mt-1">{rows.length}</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Meta Geral</div>
          <div className="text-[22px] font-medium mt-1">{fmtBRL(meta)}</div>
          <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, (total / meta) * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="surface-card p-4">
        {loading ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <div className="text-[12px] text-muted-foreground">Nenhum orçamento aprovado no período.</div>
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 px-2 font-normal w-10">#</th>
                <th className="py-2 px-2 font-normal">Consultor</th>
                <th className="py-2 px-2 font-normal text-right">Pedidos</th>
                <th className="py-2 px-2 font-normal text-right">Ticket Médio</th>
                <th className="py-2 px-2 font-normal text-right">Total</th>
                <th className="py-2 px-2 font-normal w-32">Meta Individual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const metaInd = meta / Math.max(1, rows.length);
                const pct = Math.min(100, (r.total / metaInd) * 100);
                return (
                  <tr key={r.user_id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-2">{medal(i)}</td>
                    <td className="py-2 px-2 font-medium">{r.nome}</td>
                    <td className="py-2 px-2 text-right">{r.qtd}</td>
                    <td className="py-2 px-2 text-right">{fmtBRL(r.ticket)}</td>
                    <td className="py-2 px-2 text-right font-medium">{fmtBRL(r.total)}</td>
                    <td className="py-2 px-2">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{pct.toFixed(0)}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
