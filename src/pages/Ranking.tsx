import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Star, Medal, Crown } from "lucide-react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useLoja } from "@/contexts/LojaContext";
import { PageFilters, defaultPeriodoMes, resolvePeriodo, PeriodoState } from "@/components/PageFilters";

type Row = { user_id: string; nome: string; total: number; qtd: number; meta: number; conv: number; apresentados: number; ticket: number };
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Ranking() {
  const { selectedLojaId } = useLoja();
  const [periodo, setPeriodo] = useState<PeriodoState>(defaultPeriodoMes());
  const [lojasFiltro, setLojasFiltro] = useState<string[]>(selectedLojaId ? [selectedLojaId] : []);
  useEffect(() => { setLojasFiltro(selectedLojaId ? [selectedLojaId] : []); }, [selectedLojaId]);
  const [rows, setRows] = useState<Row[]>([]);
  const [totalRealizado, setTotalRealizado] = useState(0);
  const [metaGlobal, setMetaGlobal] = useState(0);
  const [loading, setLoading] = useState(true);
  const { inicio, fim } = useMemo(() => resolvePeriodo(periodo), [periodo]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let qOrc = supabase.from("orcamentos").select("id, consultor_id, total, status, created_at, loja_id");
      if (inicio && fim) qOrc = qOrc.gte("created_at", inicio.toISOString()).lte("created_at", fim.toISOString());
      if (lojasFiltro.length > 0) qOrc = qOrc.in("loja_id", lojasFiltro);

      let qPed = supabase
        .from("pedidos")
        .select("id, valor_total, juros_total, rt_repassado, status, created_at, loja_id, orcamento_id, is_adendo, is_complemento");
      if (inicio && fim) qPed = qPed.gte("created_at", inicio.toISOString()).lte("created_at", fim.toISOString());
      if (lojasFiltro.length > 0) qPed = qPed.in("loja_id", lojasFiltro);

      const r = periodo.ref;
      let qMetas = supabase.from("metas_vendas" as any).select("vendedor_id, meta_valor, loja_id").eq("ano", r.getFullYear()).eq("mes", r.getMonth() + 1);
      if (lojasFiltro.length > 0) qMetas = qMetas.in("loja_id", lojasFiltro);

      const [{ data: orcs }, { data: peds }, { data: profs }, { data: metasData }] = await Promise.all([
        qOrc, qPed, supabase.from("profiles").select("user_id, nome_completo"), qMetas,
      ]);
      const metas = (metasData as any[]) || [];
      setMetaGlobal(metas.filter((m) => !m.vendedor_id).reduce((s, m) => s + Number(m.meta_valor || 0), 0));

      // Pedidos ativos (PV+CP, sem AD, não cancelados)
      const pedsAtivos = ((peds as any[]) || []).filter(
        (p) => !p.is_adendo && (p.status || "").toLowerCase() !== "cancelado"
      );
      const pedIds = pedsAtivos.map((p: any) => p.id);
      const orcIdsP = Array.from(new Set(pedsAtivos.map((p: any) => p.orcamento_id).filter(Boolean)));

      // Juros (a partir dos pagamentos do orçamento) e RT (parceiro_comissoes)
      const [{ data: pags }, { data: mets }, { data: comissoes }] = await Promise.all([
        orcIdsP.length
          ? supabase.from("pagamentos_orcamento").select("orcamento_id, metodo, parcelas, valor").in("orcamento_id", orcIdsP)
          : Promise.resolve({ data: [] as any[] } as any),
        supabase.from("metodos_pagamento").select("nome, taxa_perc_parcela, parcelas_config"),
        pedIds.length
          ? supabase.from("parceiro_comissoes" as any).select("pedido_id, valor_calculado").in("pedido_id", pedIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);
      const metodosMap = new Map<string, any>();
      ((mets as any[]) || []).forEach((m: any) => metodosMap.set(m.nome, m));
      const jurosPorOrc = new Map<string, number>();
      ((pags as any[]) || []).forEach((pg: any) => {
        const n = Number(pg.parcelas) || 1;
        if (n <= 1) return;
        const met = metodosMap.get(pg.metodo);
        let juros = 0;
        const cfg = Array.isArray(met?.parcelas_config) ? met.parcelas_config.find((c: any) => Number(c?.numero) === n) : null;
        const jurosPerc = Number(cfg?.juros_perc) || 0;
        if (jurosPerc > 0) {
          juros = (Number(pg.valor || 0) * jurosPerc) / 100;
        } else {
          const taxa = (Number(met?.taxa_perc_parcela) || 0) / 100;
          if (taxa) {
            const principal = Number(pg.valor || 0) / n;
            for (let i = 1; i < n; i++) juros += principal * taxa * i;
          }
        }
        jurosPorOrc.set(pg.orcamento_id, (jurosPorOrc.get(pg.orcamento_id) || 0) + juros);
      });
      const rtPorPed = new Map<string, number>();
      ((comissoes as any[]) || []).forEach((c: any) => {
        rtPorPed.set(c.pedido_id, (rtPorPed.get(c.pedido_id) || 0) + Number(c.valor_calculado || 0));
      });

      // Mapa orcamento_id -> consultor_id
      const consultorPorOrc = new Map<string, string>();
      ((orcs as any[]) || []).forEach((o: any) => { if (o.consultor_id) consultorPorOrc.set(o.id, o.consultor_id); });

      const map = new Map<string, Row>();
      const ensure = (uid: string) => {
        let cur = map.get(uid);
        if (!cur) {
          cur = {
            user_id: uid,
            nome: profs?.find((p) => p.user_id === uid)?.nome_completo || "—",
            total: 0, qtd: 0, meta: 0, conv: 0, apresentados: 0, ticket: 0,
          };
          map.set(uid, cur);
        }
        return cur;
      };

      // Apresentados = orçamentos do consultor (todos do período)
      ((orcs as any[]) || []).forEach((o: any) => {
        if (!o.consultor_id) return;
        const cur = ensure(o.consultor_id);
        cur.apresentados += 1;
      });

      // Vendido líquido = pedidos PV+CP ativos vinculados ao consultor (via orçamento)
      pedsAtivos.forEach((p: any) => {
        const uid = consultorPorOrc.get(p.orcamento_id);
        if (!uid) return;
        const cur = ensure(uid);
        const juros = Number(p.juros_total) || jurosPorOrc.get(p.orcamento_id) || 0;
        const rt = Number(p.rt_repassado) > 0 ? Number(p.rt_repassado) : (rtPorPed.get(p.id) || 0);
        cur.total += Number(p.valor_total || 0) - juros - rt;
        cur.qtd += 1;
      });

      const arr = Array.from(map.values()).map((x) => {
        const meta = Number(metas.find((m) => m.vendedor_id === x.user_id)?.meta_valor || 0);
        return { ...x, meta, conv: x.apresentados ? (x.qtd / x.apresentados) * 100 : 0, ticket: x.qtd ? x.total / x.qtd : 0 };
      }).sort((a, b) => b.total - a.total);
      setRows(arr);
      setLoading(false);

      if (arr.length > 0) {
        setTimeout(() => {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.3 } });
        }, 350);
      }
    })();
  }, [periodo, lojasFiltro]);


  const totalRealizado = rows.reduce((s, r) => s + r.total, 0);
  const pctGlobal = metaGlobal > 0 ? (totalRealizado / metaGlobal) * 100 : 0;
  const top3 = rows.slice(0, 3);
  // Pódio: 2-1-3
  const ordemPodio = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-amber-500/15 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h1>Ranking de Vendedores</h1>
            <p className="text-[12px] text-muted-foreground mt-1">Performance, taxa de conversão e meta</p>
          </div>
        </div>
        <PageFilters value={periodo} onChange={setPeriodo} lojas={lojasFiltro} onLojasChange={setLojasFiltro} options={["mes", "ano", "personalizado"]} />
      </div>

      {/* Meta global */}
      <div className="surface-card p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 text-[13px] text-primary">
              <Star className="w-4 h-4 fill-primary" />
              <span className="font-medium">Meta Global do período</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <div className="text-[28px] font-medium">{fmtBRL(totalRealizado)}</div>
              <div className="text-[14px] text-muted-foreground">/ {fmtBRL(metaGlobal)}</div>
            </div>
            <div className="h-2 bg-muted rounded-full mt-3 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, pctGlobal)}%` }} transition={{ duration: 1.1, ease: "easeOut" }} className="h-full bg-primary" />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[36px] font-medium text-primary leading-none">{pctGlobal.toFixed(1)}%</div>
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider mt-1">Realizado</div>
          </div>
        </div>
      </div>

      {/* Pódio 2-1-3 */}
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-3 items-end">
          {ordemPodio.map((r) => {
            const pos = rows.findIndex((x) => x.user_id === r.user_id) + 1;
            const altura = pos === 1 ? 200 : pos === 2 ? 160 : 130;
            const cor = pos === 1 ? "from-amber-400 to-amber-600" : pos === 2 ? "from-zinc-300 to-zinc-500" : "from-orange-300 to-orange-500";
            const medalha = pos === 1 ? <Crown className="w-6 h-6" /> : <Medal className="w-5 h-5" />;
            return (
              <motion.div
                key={r.user_id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: pos === 1 ? 0.4 : 0.2 * pos, duration: 0.5, ease: "easeOut" }}
                className="flex flex-col items-center"
              >
                <div className="mb-2 text-center">
                  <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br flex items-center justify-center text-white shadow-lg" style={{}}>
                    <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${cor} flex items-center justify-center`}>
                      {medalha}
                    </div>
                  </div>
                  <div className="font-medium mt-2 text-[13px] truncate max-w-[160px]">{r.nome}</div>
                  <div className="text-[11px] text-muted-foreground">#{pos}</div>
                </div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: altura }}
                  transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
                  className={`w-full rounded-t-lg bg-gradient-to-t ${cor} flex flex-col items-center justify-start pt-3 shadow-inner`}
                >
                  <div className="text-white text-[10px] uppercase tracking-wider opacity-90">Vendido</div>
                  <div className="text-white font-display text-lg mt-0.5 drop-shadow">{fmtBRL(r.total)}</div>
                  <div className="text-white/90 text-[10px] mt-1">{r.qtd} pedido{r.qtd !== 1 ? "s" : ""} · {r.conv.toFixed(0)}% conv.</div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Lista completa */}
      <div className="surface-card p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3 px-2">Ranking completo</div>
        {loading ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">Nenhuma venda no período.</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 px-2 font-normal w-10">#</th>
                <th className="py-2 px-2 font-normal">Vendedor</th>
                <th className="py-2 px-2 font-normal text-right">Apresentados</th>
                <th className="py-2 px-2 font-normal text-right">Vendidos</th>
                <th className="py-2 px-2 font-normal text-right">Conversão</th>
                <th className="py-2 px-2 font-normal text-right">Ticket Médio</th>
                <th className="py-2 px-2 font-normal text-right">Realizado</th>
                <th className="py-2 px-2 font-normal text-right">% Meta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pct = r.meta > 0 ? (r.total / r.meta) * 100 : 0;
                return (
                  <motion.tr
                    key={r.user_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="py-2 px-2">{i + 1}</td>
                    <td className="py-2 px-2 font-medium">{r.nome}</td>
                    <td className="py-2 px-2 text-right">{r.apresentados}</td>
                    <td className="py-2 px-2 text-right">{r.qtd}</td>
                    <td className="py-2 px-2 text-right">{r.conv.toFixed(0)}%</td>
                    <td className="py-2 px-2 text-right">{fmtBRL(r.ticket)}</td>
                    <td className="py-2 px-2 text-right font-medium">{fmtBRL(r.total)}</td>
                    <td className="py-2 px-2 text-right">{pct.toFixed(0)}%</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
