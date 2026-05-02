import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLoja } from "@/contexts/LojaContext";

type Row = {
  user_id: string;
  nome: string;
  total: number;
  qtd: number;
  meta: number;
  comissao: number;
  taxa: number;
};

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function Ranking() {
  const { selectedLojaId } = useLoja();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [ano, setAno] = useState<number>(now.getFullYear());
  const [mes, setMes] = useState<number>(now.getMonth() + 1);
  const [metaGlobal, setMetaGlobal] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // janela do mês
      const ini = new Date(ano, mes - 1, 1);
      const fim = new Date(ano, mes, 1);

      let qOrc = supabase.from("orcamentos")
        .select("consultor_id, total, status, created_at, loja_id")
        .gte("created_at", ini.toISOString())
        .lt("created_at", fim.toISOString());
      if (selectedLojaId) qOrc = qOrc.eq("loja_id", selectedLojaId);

      let qMetas = supabase.from("metas_vendas" as any)
        .select("vendedor_id, meta_valor, loja_id")
        .eq("ano", ano).eq("mes", mes);
      if (selectedLojaId) qMetas = qMetas.eq("loja_id", selectedLojaId);

      const [{ data: orcs }, { data: profs }, { data: metasData }] = await Promise.all([
        qOrc,
        supabase.from("profiles").select("user_id, nome_completo"),
        qMetas,
      ]);

      const metas = (metasData as any[]) || [];
      const metaGlobalCalc = metas.filter((m) => !m.vendedor_id).reduce((s, m) => s + Number(m.meta_valor || 0), 0);
      setMetaGlobal(metaGlobalCalc);

      const map = new Map<string, Row>();
      (orcs || []).filter((o) => o.status === "aprovado" || o.status === "fechado" || o.status === "convertido").forEach((o) => {
        if (!o.consultor_id) return;
        const cur = map.get(o.consultor_id) || {
          user_id: o.consultor_id,
          nome: profs?.find((p) => p.user_id === o.consultor_id)?.nome_completo || "—",
          total: 0, qtd: 0, meta: 0, comissao: 0, taxa: 3,
        };
        cur.total += Number(o.total || 0);
        cur.qtd += 1;
        map.set(o.consultor_id, cur);
      });

      const arr = Array.from(map.values()).map((r) => {
        const meta = Number(metas.find((m) => m.vendedor_id === r.user_id)?.meta_valor || 0);
        // taxa simples por faixa: ate 180k=3, ate 300k=4, acima=5
        const taxa = r.total >= 300000 ? 5 : r.total >= 180000 ? 4 : 3;
        const comissao = r.total * (taxa / 100);
        return { ...r, meta, taxa, comissao };
      }).sort((a, b) => b.total - a.total);
      setRows(arr);
      setLoading(false);
    })();
  }, [selectedLojaId, ano, mes]);

  const totalRealizado = rows.reduce((s, r) => s + r.total, 0);
  const pctGlobal = metaGlobal > 0 ? (totalRealizado / metaGlobal) * 100 : 0;
  const top3 = rows.slice(0, 3);

  const anos = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-amber-500/15 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h1>Performance</h1>
            <p className="text-[12px] text-muted-foreground mt-1">Ranking por volume bruto de vendas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(mes)} onValueChange={(v) => setMes(parseInt(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {meses.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(parseInt(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anos.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Card meta global */}
      <div className="surface-card p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[13px] text-primary">
              <Star className="w-4 h-4 fill-primary" />
              <span className="font-medium">Meta Global (Bruto)</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <div className="text-[28px] font-medium">{fmtBRL(totalRealizado)}</div>
              <div className="text-[14px] text-muted-foreground">/ {fmtBRL(metaGlobal)}</div>
            </div>
            <div className="h-2 bg-muted rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, pctGlobal)}%` }} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[36px] font-medium text-primary leading-none">{pctGlobal.toFixed(1)}%</div>
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider mt-1">Realizado</div>
          </div>
        </div>
      </div>

      {/* Top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {top3.map((r, i) => {
          const pct = r.meta > 0 ? Math.min(100, (r.total / r.meta) * 100) : 0;
          return (
            <div key={r.user_id} className="surface-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] text-primary font-medium">#{i + 1}</div>
                  <div className="text-[16px] font-medium mt-0.5">{r.nome}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Meta</div>
                  <div className="text-[12px]">{fmtBRL(r.meta)}</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Realizado</span>
                  <span className="font-medium">{pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Comissão (VPL)</div>
                  <div className="text-[15px] font-medium mt-0.5">{fmtBRL(r.comissao)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Taxa</div>
                  <div className="text-[14px] font-medium text-primary">{r.taxa.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lista completa */}
      {rows.length > 3 && (
        <div className="surface-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3 px-2">Ranking completo</div>
          {loading ? (
            <div className="text-[12px] text-muted-foreground py-6 text-center">Carregando…</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 px-2 font-normal w-10">#</th>
                  <th className="py-2 px-2 font-normal">Consultor</th>
                  <th className="py-2 px-2 font-normal text-right">Pedidos</th>
                  <th className="py-2 px-2 font-normal text-right">Realizado</th>
                  <th className="py-2 px-2 font-normal text-right">Meta</th>
                  <th className="py-2 px-2 font-normal text-right">% Meta</th>
                  <th className="py-2 px-2 font-normal text-right">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const pct = r.meta > 0 ? (r.total / r.meta) * 100 : 0;
                  return (
                    <tr key={r.user_id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2">{i + 1}</td>
                      <td className="py-2 px-2 font-medium">{r.nome}</td>
                      <td className="py-2 px-2 text-right">{r.qtd}</td>
                      <td className="py-2 px-2 text-right font-medium">{fmtBRL(r.total)}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{fmtBRL(r.meta)}</td>
                      <td className="py-2 px-2 text-right">{pct.toFixed(0)}%</td>
                      <td className="py-2 px-2 text-right text-primary">{fmtBRL(r.comissao)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
