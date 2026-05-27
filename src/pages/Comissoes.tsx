import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Award, Plus, Trash2, Save, Calculator, Percent, Trophy, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useLoja } from "@/contexts/LojaContext";
import { PageFilters, defaultPeriodoMes, resolvePeriodo, PeriodoState } from "@/components/PageFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

type Tier = { vendido_min: number; valor: number };
type Regras = {
  id?: string;
  loja_id: string | null;
  meta_minima: number;
  modo: "comissao" | "premiacao";
  comissao_percentual: number;
  premiacao_tiers: Tier[];
  premiacao_step_a_partir_de: number;
  premiacao_step_tamanho: number;
  premiacao_step_valor: number;
};

const REGRAS_DEFAULT: Regras = {
  loja_id: null,
  meta_minima: 50000,
  modo: "premiacao",
  comissao_percentual: 1.5,
  premiacao_tiers: [
    { vendido_min: 50000, valor: 750 },
    { vendido_min: 60000, valor: 900 },
    { vendido_min: 70000, valor: 1150 },
  ],
  premiacao_step_a_partir_de: 80000,
  premiacao_step_tamanho: 10000,
  premiacao_step_valor: 200,
};

// Para premiação: base em 80k = 1600 (no exemplo). Calculamos a partir de tiers + step.
function calcularPremio(vendido: number, r: Regras): number {
  if (vendido < r.meta_minima) return 0;
  if (r.modo === "comissao") {
    return (vendido * (Number(r.comissao_percentual) || 0)) / 100;
  }
  // Premiação por faixas
  let valor = 0;
  // Maior tier cuja meta foi atingida
  const tiersOrd = [...r.premiacao_tiers].sort((a, b) => a.vendido_min - b.vendido_min);
  for (const t of tiersOrd) {
    if (vendido >= Number(t.vendido_min)) valor = Number(t.valor);
  }
  // Step acima de "a partir de"
  if (r.premiacao_step_tamanho > 0 && vendido >= r.premiacao_step_a_partir_de) {
    // Valor base no início do step: usa o último tier <= step_a_partir_de, ou tier maior se não houver
    let base = 0;
    for (const t of tiersOrd) {
      if (Number(t.vendido_min) <= r.premiacao_step_a_partir_de) base = Number(t.valor);
    }
    // Acrescenta valor base do início do step se ainda não foi pego (ex: 80k → 1600 quando o último tier é 70k=1150)
    // No exemplo do usuário, 80k=1600 e a cada +10k = +200. Tratamos o "1600" como o próprio step base.
    // Para isso, adicionamos premiacao_step_valor por cada bloco completo (incluindo o primeiro ao atingir step_a_partir_de).
    const blocos = Math.floor((vendido - r.premiacao_step_a_partir_de) / r.premiacao_step_tamanho) + 1;
    const stepBase = Math.max(base, valor); // mantém continuidade
    valor = stepBase + blocos * Number(r.premiacao_step_valor);
  }
  return valor;
}

type PessoaRow = {
  user_id: string;
  nome: string;
  papel: string;
  vendido: number;
  qtd: number;
};

export default function Comissoes() {
  const { selectedLojaId } = useLoja();
  const [periodo, setPeriodo] = useState<PeriodoState>(defaultPeriodoMes());
  const [lojasFiltro, setLojasFiltro] = useState<string[]>(selectedLojaId ? [selectedLojaId] : []);
  useEffect(() => { setLojasFiltro(selectedLojaId ? [selectedLojaId] : []); }, [selectedLojaId]);

  const [regras, setRegras] = useState<Regras>(REGRAS_DEFAULT);
  const [rows, setRows] = useState<PessoaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { inicio, fim } = useMemo(() => resolvePeriodo(periodo), [periodo]);
  const lojaRegrasId = lojasFiltro[0] || null;

  // Carrega regras
  useEffect(() => {
    (async () => {
      const q = supabase.from("regras_comissao" as any).select("*");
      const { data } = lojaRegrasId
        ? await q.eq("loja_id", lojaRegrasId).maybeSingle()
        : await q.is("loja_id", null).maybeSingle();
      if (data) {
        const d: any = data;
        setRegras({
          id: d.id,
          loja_id: d.loja_id,
          meta_minima: Number(d.meta_minima) || 0,
          modo: d.modo,
          comissao_percentual: Number(d.comissao_percentual) || 0,
          premiacao_tiers: Array.isArray(d.premiacao_tiers) ? d.premiacao_tiers : [],
          premiacao_step_a_partir_de: Number(d.premiacao_step_a_partir_de) || 0,
          premiacao_step_tamanho: Number(d.premiacao_step_tamanho) || 10000,
          premiacao_step_valor: Number(d.premiacao_step_valor) || 0,
        });
      } else {
        setRegras({ ...REGRAS_DEFAULT, loja_id: lojaRegrasId });
      }
    })();
  }, [lojaRegrasId]);

  // Carrega pessoas + vendas do período
  useEffect(() => {
    (async () => {
      setLoading(true);
      // Pedidos do período (somente PV/AD/CP)
      let qPed = supabase
        .from("pedidos")
        .select("id, valor_total, projetista_id, orcamento_id, loja_id, created_at, orcamentos(consultor_id, vendedor_id, projetista_id)");
      if (inicio && fim)
        qPed = qPed.gte("created_at", inicio.toISOString()).lte("created_at", fim.toISOString());
      if (lojasFiltro.length > 0) qPed = qPed.in("loja_id", lojasFiltro);

      const [{ data: peds }, { data: profs }, { data: roles }] = await Promise.all([
        qPed,
        supabase.from("profiles").select("user_id, nome_completo, loja_id, ativo"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const ativos = (profs || []).filter((p: any) => p.ativo !== false);
      const lojaSet = new Set(lojasFiltro);
      const pessoasBase = lojasFiltro.length > 0
        ? ativos.filter((p: any) => !p.loja_id || lojaSet.has(p.loja_id))
        : ativos;

      const roleMap = new Map<string, string[]>();
      (roles || []).forEach((r: any) => {
        const arr = roleMap.get(r.user_id) || [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });

      const acc = new Map<string, PessoaRow>();
      const ensure = (uid: string, papel: string) => {
        if (!acc.has(uid)) {
          const prof = pessoasBase.find((p: any) => p.user_id === uid);
          acc.set(uid, {
            user_id: uid,
            nome: prof?.nome_completo || "—",
            papel,
            vendido: 0,
            qtd: 0,
          });
        }
        return acc.get(uid)!;
      };

      (peds || []).forEach((p: any) => {
        const valor = Number(p.valor_total || 0);
        const orc: any = p.orcamentos || {};
        const consultor = orc.consultor_id || orc.vendedor_id;
        const projetista = p.projetista_id || orc.projetista_id;
        if (consultor) {
          const r = ensure(consultor, "Vendedor/Consultor");
          r.vendido += valor;
          r.qtd += 1;
        }
        if (projetista && projetista !== consultor) {
          const r = ensure(projetista, "Projetista");
          r.vendido += valor;
          r.qtd += 1;
        }
      });

      // Garantir pessoas cadastradas mesmo sem vendas
      pessoasBase.forEach((p: any) => {
        const roleList = roleMap.get(p.user_id) || [];
        const isComercial = roleList.some((r) => ["vendedor", "projetista", "consultor", "gerente"].includes(r));
        if (acc.has(p.user_id) || isComercial || roleList.length === 0) {
          if (!acc.has(p.user_id)) {
            acc.set(p.user_id, {
              user_id: p.user_id,
              nome: p.nome_completo || "—",
              papel: roleList.includes("projetista") ? "Projetista" : "Vendedor/Consultor",
              vendido: 0,
              qtd: 0,
            });
          }
        }
      });

      const arr = Array.from(acc.values()).sort((a, b) => b.vendido - a.vendido);
      setRows(arr);
      setLoading(false);
    })();
  }, [periodo, lojasFiltro]);

  const salvarRegras = async () => {
    setSaving(true);
    const payload: any = {
      loja_id: regras.loja_id,
      meta_minima: regras.meta_minima,
      modo: regras.modo,
      comissao_percentual: regras.comissao_percentual,
      premiacao_tiers: regras.premiacao_tiers,
      premiacao_step_a_partir_de: regras.premiacao_step_a_partir_de,
      premiacao_step_tamanho: regras.premiacao_step_tamanho,
      premiacao_step_valor: regras.premiacao_step_valor,
    };
    const { error } = regras.id
      ? await supabase.from("regras_comissao" as any).update(payload).eq("id", regras.id)
      : await supabase.from("regras_comissao" as any).insert(payload);
    setSaving(false);
    if (error) toast.error("Erro ao salvar regras: " + error.message);
    else toast.success("Regras salvas com sucesso");
  };

  const addTier = () =>
    setRegras((r) => ({
      ...r,
      premiacao_tiers: [...r.premiacao_tiers, { vendido_min: 0, valor: 0 }].sort(
        (a, b) => a.vendido_min - b.vendido_min,
      ),
    }));
  const removeTier = (i: number) =>
    setRegras((r) => ({ ...r, premiacao_tiers: r.premiacao_tiers.filter((_, k) => k !== i) }));
  const updateTier = (i: number, patch: Partial<Tier>) =>
    setRegras((r) => ({
      ...r,
      premiacao_tiers: r.premiacao_tiers.map((t, k) => (k === i ? { ...t, ...patch } : t)),
    }));

  const totais = useMemo(() => {
    const vendido = rows.reduce((s, r) => s + r.vendido, 0);
    const premio = rows.reduce((s, r) => s + calcularPremio(r.vendido, regras), 0);
    const elegiveis = rows.filter((r) => r.vendido >= regras.meta_minima).length;
    return { vendido, premio, elegiveis };
  }, [rows, regras]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link to="/relatorios" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-9 h-9 rounded-md bg-amber-500/15 flex items-center justify-center">
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h1>Cálculo de Comissão</h1>
            <p className="text-[12px] text-muted-foreground mt-1">
              Premiação ou comissão para vendedores, projetistas e consultores
            </p>
          </div>
        </div>
        <PageFilters
          value={periodo}
          onChange={setPeriodo}
          lojas={lojasFiltro}
          onLojasChange={setLojasFiltro}
          options={["mes", "ano", "personalizado"]}
        />
      </div>

      {/* Regras */}
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[14px] font-medium flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            Regras {lojaRegrasId ? "da loja selecionada" : "globais (todas as lojas)"}
          </div>
          <Button size="sm" onClick={salvarRegras} disabled={saving}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Salvando…" : "Salvar regras"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[11px] uppercase text-muted-foreground tracking-wider">
              Meta mínima para ganhar
            </label>
            <Input
              type="number"
              step="100"
              value={regras.meta_minima}
              onChange={(e) => setRegras({ ...regras, meta_minima: Number(e.target.value) })}
              className="mt-1"
            />
            <div className="text-[11px] text-muted-foreground mt-1">{fmtBRL(regras.meta_minima)}</div>
          </div>

          <div>
            <label className="text-[11px] uppercase text-muted-foreground tracking-wider">Modo</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRegras({ ...regras, modo: "comissao" })}
                className={`h-9 rounded-md border text-[12px] flex items-center justify-center gap-1.5 transition-colors ${
                  regras.modo === "comissao"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                Comissão (%)
              </button>
              <button
                type="button"
                onClick={() => setRegras({ ...regras, modo: "premiacao" })}
                className={`h-9 rounded-md border text-[12px] flex items-center justify-center gap-1.5 transition-colors ${
                  regras.modo === "premiacao"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                Premiação (faixas)
              </button>
            </div>
          </div>

          {regras.modo === "comissao" ? (
            <div>
              <label className="text-[11px] uppercase text-muted-foreground tracking-wider">
                Percentual sobre vendas
              </label>
              <Input
                type="number"
                step="0.1"
                value={regras.comissao_percentual}
                onChange={(e) =>
                  setRegras({ ...regras, comissao_percentual: Number(e.target.value) })
                }
                className="mt-1"
              />
              <div className="text-[11px] text-muted-foreground mt-1">
                {regras.comissao_percentual}% do faturamento individual
              </div>
            </div>
          ) : (
            <div className="md:col-span-1">
              <label className="text-[11px] uppercase text-muted-foreground tracking-wider">
                Resumo
              </label>
              <div className="text-[12px] mt-2 leading-relaxed">
                {regras.premiacao_tiers.length} faixa(s) · acima de{" "}
                <b>{fmtBRL(regras.premiacao_step_a_partir_de)}</b>, +
                {fmtBRL(regras.premiacao_step_valor)} a cada {fmtBRL(regras.premiacao_step_tamanho)}{" "}
                vendidos.
              </div>
            </div>
          )}
        </div>

        {regras.modo === "premiacao" && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-medium">Faixas de premiação</div>
              <Button size="sm" variant="outline" onClick={addTier}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar faixa
              </Button>
            </div>
            <div className="space-y-2">
              {regras.premiacao_tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="text-[11px] text-muted-foreground w-24">Atingiu</div>
                  <Input
                    type="number"
                    step="1000"
                    value={t.vendido_min}
                    onChange={(e) => updateTier(i, { vendido_min: Number(e.target.value) })}
                    className="w-40"
                  />
                  <div className="text-[11px] text-muted-foreground">→ ganha</div>
                  <Input
                    type="number"
                    step="50"
                    value={t.valor}
                    onChange={(e) => updateTier(i, { valor: Number(e.target.value) })}
                    className="w-40"
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeTier(i)}>
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-border">
              <div>
                <label className="text-[11px] uppercase text-muted-foreground tracking-wider">
                  Step a partir de
                </label>
                <Input
                  type="number"
                  step="1000"
                  value={regras.premiacao_step_a_partir_de}
                  onChange={(e) =>
                    setRegras({ ...regras, premiacao_step_a_partir_de: Number(e.target.value) })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase text-muted-foreground tracking-wider">
                  Tamanho do step
                </label>
                <Input
                  type="number"
                  step="1000"
                  value={regras.premiacao_step_tamanho}
                  onChange={(e) =>
                    setRegras({ ...regras, premiacao_step_tamanho: Number(e.target.value) })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase text-muted-foreground tracking-wider">
                  Valor por step
                </label>
                <Input
                  type="number"
                  step="50"
                  value={regras.premiacao_step_valor}
                  onChange={(e) =>
                    setRegras({ ...regras, premiacao_step_valor: Number(e.target.value) })
                  }
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="surface-card p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wider">
            Total vendido no período
          </div>
          <div className="text-[22px] font-medium mt-1">{fmtBRL(totais.vendido)}</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wider">
            Pessoas elegíveis
          </div>
          <div className="text-[22px] font-medium mt-1">
            {totais.elegiveis} <span className="text-[12px] text-muted-foreground">de {rows.length}</span>
          </div>
        </div>
        <div className="surface-card p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wider">
            Total a pagar
          </div>
          <div className="text-[22px] font-medium mt-1 text-amber-600">{fmtBRL(totais.premio)}</div>
        </div>
      </div>

      {/* Pessoas */}
      <div className="surface-card p-5">
        <div className="text-[14px] font-medium mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Cálculo individual
        </div>
        {loading ? (
          <div className="py-8 text-center text-[12px] text-muted-foreground animate-pulse">
            Carregando…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-muted-foreground">
            Nenhuma pessoa encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 px-2 font-normal">Pessoa</th>
                  <th className="py-2 px-2 font-normal">Papel</th>
                  <th className="py-2 px-2 font-normal text-right">Qtd</th>
                  <th className="py-2 px-2 font-normal text-right">Vendido</th>
                  <th className="py-2 px-2 font-normal text-right">% Meta</th>
                  <th className="py-2 px-2 font-normal text-right">Prêmio</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const premio = calcularPremio(r.vendido, regras);
                  const pct = regras.meta_minima > 0 ? (r.vendido / regras.meta_minima) * 100 : 0;
                  const elegivel = r.vendido >= regras.meta_minima;
                  return (
                    <tr key={r.user_id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{r.nome}</td>
                      <td className="py-2 px-2 text-muted-foreground">{r.papel}</td>
                      <td className="py-2 px-2 text-right">{r.qtd}</td>
                      <td className="py-2 px-2 text-right">{fmtBRL(r.vendido)}</td>
                      <td className={`py-2 px-2 text-right ${elegivel ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {pct.toFixed(0)}%
                      </td>
                      <td className={`py-2 px-2 text-right font-medium ${premio > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {fmtBRL(premio)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
