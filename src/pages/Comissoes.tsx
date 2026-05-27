import { useEffect, useMemo, useState, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Award, Plus, Trash2, Save, Calculator, Percent, Trophy, ArrowLeft,
  ChevronRight, ChevronDown, Split, FileSpreadsheet, FileText, Printer, X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLoja } from "@/contexts/LojaContext";
import { PageFilters, defaultPeriodoMes, resolvePeriodo, PeriodoState } from "@/components/PageFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

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

function calcularPremio(vendido: number, r: Regras): number {
  if (vendido < r.meta_minima) return 0;
  if (r.modo === "comissao") return (vendido * (Number(r.comissao_percentual) || 0)) / 100;
  let valor = 0;
  const tiersOrd = [...r.premiacao_tiers].sort((a, b) => a.vendido_min - b.vendido_min);
  for (const t of tiersOrd) if (vendido >= Number(t.vendido_min)) valor = Number(t.valor);
  if (r.premiacao_step_tamanho > 0 && vendido >= r.premiacao_step_a_partir_de) {
    let base = 0;
    for (const t of tiersOrd) if (Number(t.vendido_min) <= r.premiacao_step_a_partir_de) base = Number(t.valor);
    const blocos = Math.floor((vendido - r.premiacao_step_a_partir_de) / r.premiacao_step_tamanho) + 1;
    const stepBase = Math.max(base, valor);
    valor = stepBase + blocos * Number(r.premiacao_step_valor);
  }
  return valor;
}

type Participante = { user_id: string; percentual: number; papel: string };
type PedidoRow = {
  id: string;
  codigo: string;
  cliente_nome: string;
  data: string;
  valor_total: number;     // bruto (com RT e juros)
  valor_liquido: number;   // base p/ comissão (sem RT e juros)
  rt: number;
  juros: number;
  consultor_id: string | null;
  projetista_id: string | null;
  participantes: Participante[]; // efetivos (override ou padrão)
  override: boolean;
};
type PessoaRow = {
  user_id: string;
  nome: string;
  papel: string;
  vendido: number;          // líquido (base comissão)
  vendido_bruto: number;
  qtd: number;
  pedidos: { pedido_id: string; valor_atribuido: number; valor_bruto_atribuido: number; percentual: number }[];
};

export default function Comissoes() {
  const { selectedLojaId } = useLoja();
  const [periodo, setPeriodo] = useState<PeriodoState>(defaultPeriodoMes());
  const [lojasFiltro, setLojasFiltro] = useState<string[]>(selectedLojaId ? [selectedLojaId] : []);
  useEffect(() => { setLojasFiltro(selectedLojaId ? [selectedLojaId] : []); }, [selectedLojaId]);

  const [regras, setRegras] = useState<Regras>(REGRAS_DEFAULT);
  const [pedidos, setPedidos] = useState<PedidoRow[]>([]);
  const [pessoasCatalogo, setPessoasCatalogo] = useState<{ user_id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [dialogPedido, setDialogPedido] = useState<PedidoRow | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const { inicio, fim } = useMemo(() => resolvePeriodo(periodo), [periodo]);
  const lojaRegrasId = lojasFiltro[0] || null;

  // Regras
  useEffect(() => {
    (async () => {
      const q = supabase.from("regras_comissao" as any).select("*");
      const { data } = lojaRegrasId
        ? await q.eq("loja_id", lojaRegrasId).maybeSingle()
        : await q.is("loja_id", null).maybeSingle();
      if (data) {
        const d: any = data;
        setRegras({
          id: d.id, loja_id: d.loja_id,
          meta_minima: Number(d.meta_minima) || 0,
          modo: d.modo,
          comissao_percentual: Number(d.comissao_percentual) || 0,
          premiacao_tiers: Array.isArray(d.premiacao_tiers) ? d.premiacao_tiers : [],
          premiacao_step_a_partir_de: Number(d.premiacao_step_a_partir_de) || 0,
          premiacao_step_tamanho: Number(d.premiacao_step_tamanho) || 10000,
          premiacao_step_valor: Number(d.premiacao_step_valor) || 0,
        });
      } else setRegras({ ...REGRAS_DEFAULT, loja_id: lojaRegrasId });
    })();
  }, [lojaRegrasId]);

  // Pedidos + divisões
  useEffect(() => {
    (async () => {
      setLoading(true);
      let qPed = supabase
        .from("pedidos")
        .select("id, codigo, valor_total, valor_liquido, rt_repassado, juros_total, projetista_id, created_at, cliente_id, loja_id, orcamentos(consultor_id, vendedor_id, projetista_id), clientes(nome)");
      if (inicio && fim) qPed = qPed.gte("created_at", inicio.toISOString()).lte("created_at", fim.toISOString());
      if (lojasFiltro.length > 0) qPed = qPed.in("loja_id", lojasFiltro);

      const [{ data: peds }, { data: profs }, { data: divs }] = await Promise.all([
        qPed,
        supabase.from("profiles").select("user_id, nome_completo, ativo, loja_id"),
        supabase.from("pedido_comissao_divisoes" as any).select("*"),
      ]);

      const ativos = (profs || []).filter((p: any) => p.ativo !== false);
      setPessoasCatalogo(ativos.map((p: any) => ({ user_id: p.user_id, nome: p.nome_completo || "—" })));

      const divByPed = new Map<string, any[]>();
      (divs || []).forEach((d: any) => {
        const arr = divByPed.get(d.pedido_id) || [];
        arr.push(d);
        divByPed.set(d.pedido_id, arr);
      });

      const list: PedidoRow[] = (peds || []).map((p: any) => {
        const orc = p.orcamentos || {};
        const consultor = orc.consultor_id || orc.vendedor_id || null;
        const projetista = p.projetista_id || orc.projetista_id || null;
        const override = divByPed.get(p.id);
        let participantes: Participante[];
        if (override && override.length > 0) {
          participantes = override.map((d: any) => ({
            user_id: d.user_id, percentual: Number(d.percentual) || 0, papel: d.papel || "Vendedor/Consultor",
          }));
        } else if (consultor && projetista && consultor !== projetista) {
          participantes = [
            { user_id: consultor, percentual: 50, papel: "Vendedor/Consultor" },
            { user_id: projetista, percentual: 50, papel: "Projetista" },
          ];
        } else if (consultor) {
          participantes = [{ user_id: consultor, percentual: 100, papel: "Vendedor/Consultor" }];
        } else if (projetista) {
          participantes = [{ user_id: projetista, percentual: 100, papel: "Projetista" }];
        } else participantes = [];
        const valor_total = Number(p.valor_total || 0);
        const rt = Number(p.rt_repassado || 0);
        const juros = Number(p.juros_total || 0);
        const valor_liquido = p.valor_liquido != null ? Number(p.valor_liquido) : Math.max(0, valor_total - rt - juros);
        return {
          id: p.id,
          codigo: p.codigo,
          cliente_nome: p.clientes?.nome || "—",
          data: p.created_at,
          valor_total,
          valor_liquido,
          rt,
          juros,
          consultor_id: consultor,
          projetista_id: projetista,
          participantes,
          override: !!override,
        };
      });

      setPedidos(list);
      setLoading(false);
    })();
  }, [periodo, lojasFiltro, reloadKey]);

  // Agregação por pessoa
  const pessoas = useMemo<PessoaRow[]>(() => {
    const acc = new Map<string, PessoaRow>();
    const nomeOf = (uid: string) => pessoasCatalogo.find((p) => p.user_id === uid)?.nome || "—";
    pedidos.forEach((p) => {
      p.participantes.forEach((part) => {
        const pct = part.percentual || 0;
        const valor = (p.valor_liquido * pct) / 100;
        const valorBruto = (p.valor_total * pct) / 100;
        if (!acc.has(part.user_id)) {
          acc.set(part.user_id, {
            user_id: part.user_id, nome: nomeOf(part.user_id),
            papel: part.papel, vendido: 0, vendido_bruto: 0, qtd: 0, pedidos: [],
          });
        }
        const row = acc.get(part.user_id)!;
        row.vendido += valor;
        row.vendido_bruto += valorBruto;
        row.qtd += 1;
        row.pedidos.push({ pedido_id: p.id, valor_atribuido: valor, valor_bruto_atribuido: valorBruto, percentual: pct });
      });
    });
    return Array.from(acc.values()).sort((a, b) => b.vendido - a.vendido);
  }, [pedidos, pessoasCatalogo]);

  const totais = useMemo(() => {
    const vendido = pessoas.reduce((s, r) => s + r.vendido, 0);
    const premio = pessoas.reduce((s, r) => s + calcularPremio(r.vendido, regras), 0);
    const elegiveis = pessoas.filter((r) => r.vendido >= regras.meta_minima).length;
    return { vendido, premio, elegiveis };
  }, [pessoas, regras]);

  const salvarRegras = async () => {
    setSaving(true);
    const payload: any = {
      loja_id: regras.loja_id, meta_minima: regras.meta_minima, modo: regras.modo,
      comissao_percentual: regras.comissao_percentual, premiacao_tiers: regras.premiacao_tiers,
      premiacao_step_a_partir_de: regras.premiacao_step_a_partir_de,
      premiacao_step_tamanho: regras.premiacao_step_tamanho,
      premiacao_step_valor: regras.premiacao_step_valor,
    };
    const { error } = regras.id
      ? await supabase.from("regras_comissao" as any).update(payload).eq("id", regras.id)
      : await supabase.from("regras_comissao" as any).insert(payload);
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Regras salvas");
  };

  const addTier = () => setRegras((r) => ({ ...r, premiacao_tiers: [...r.premiacao_tiers, { vendido_min: 0, valor: 0 }].sort((a, b) => a.vendido_min - b.vendido_min) }));
  const removeTier = (i: number) => setRegras((r) => ({ ...r, premiacao_tiers: r.premiacao_tiers.filter((_, k) => k !== i) }));
  const updateTier = (i: number, patch: Partial<Tier>) => setRegras((r) => ({ ...r, premiacao_tiers: r.premiacao_tiers.map((t, k) => (k === i ? { ...t, ...patch } : t)) }));

  // Exports
  const exportExcel = () => {
    const resumo = pessoas.map((r) => ({
      Pessoa: r.nome,
      Papel: r.papel,
      Qtd: r.qtd,
      "Venda Bruta": r.vendido_bruto,
      "Venda Liquida": r.vendido,
      "% Meta": regras.meta_minima > 0 ? Math.round((r.vendido / regras.meta_minima) * 100) : 0,
      Premio: calcularPremio(r.vendido, regras),
    }));
    const detalhes: any[] = [];
    pessoas.forEach((r) => {
      const ordenados = r.pedidos
        .map((rp) => ({ rp, ped: pedidos.find((p) => p.id === rp.pedido_id)! }))
        .filter((x) => x.ped)
        .sort((a, b) => +new Date(b.ped.data) - +new Date(a.ped.data));
      ordenados.forEach(({ rp, ped }) => {
        detalhes.push({
          Pessoa: r.nome,
          Papel: r.papel,
          Pedido: ped.codigo,
          Cliente: ped.cliente_nome,
          Data: ped.data ? new Date(ped.data).toLocaleDateString("pt-BR") : "",
          "Valor Bruto": ped.valor_total,
          RT: ped.rt,
          Juros: ped.juros,
          "Valor Liquido": ped.valor_liquido,
          "% Atribuido": rp.percentual,
          "Bruto Atribuido": rp.valor_bruto_atribuido,
          "Liquido Atribuido": rp.valor_atribuido,
          Divisao: ped.override ? "personalizada" : "padrao",
        });
      });
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhes), "Vendas");
    XLSX.writeFile(wb, `comissoes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Cálculo de Comissão", 14, 16);
    doc.setFontSize(9);
    doc.text(`Período: ${inicio?.toLocaleDateString("pt-BR") || "—"} a ${fim?.toLocaleDateString("pt-BR") || "—"}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Pessoa", "Papel", "Qtd", "V. Bruta", "V. Líquida", "% Meta", "Prêmio"]],
      body: pessoas.map((r) => [
        r.nome, r.papel, r.qtd, fmtBRL(r.vendido_bruto), fmtBRL(r.vendido),
        `${regras.meta_minima > 0 ? Math.round((r.vendido / regras.meta_minima) * 100) : 0}%`,
        fmtBRL(calcularPremio(r.vendido, regras)),
      ]),
      styles: { fontSize: 8 },
    });
    doc.save(`comissoes_${new Date().toISOString().slice(0, 10)}.pdf`);
  };
  const imprimir = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4 print:hidden">
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
              Vendas com consultor ≠ projetista são divididas 50/50. Edite qualquer pedido para dividir ou transferir.
            </p>
          </div>
        </div>
        <PageFilters
          value={periodo} onChange={setPeriodo}
          lojas={lojasFiltro} onLojasChange={setLojasFiltro}
          options={["mes", "ano", "personalizado"]}
        />
      </div>

      {/* Regras */}
      <div className="surface-card p-5 space-y-4 print:hidden">
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
            <label className="text-[11px] uppercase text-muted-foreground tracking-wider">Meta mínima para ganhar</label>
            <Input type="number" step="100" value={regras.meta_minima}
              onChange={(e) => setRegras({ ...regras, meta_minima: Number(e.target.value) })} className="mt-1" />
            <div className="text-[11px] text-muted-foreground mt-1">{fmtBRL(regras.meta_minima)}</div>
          </div>
          <div>
            <label className="text-[11px] uppercase text-muted-foreground tracking-wider">Modo</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRegras({ ...regras, modo: "comissao" })}
                className={`h-9 rounded-md border text-[12px] flex items-center justify-center gap-1.5 transition-colors ${regras.modo === "comissao" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted/50"}`}>
                <Percent className="w-3.5 h-3.5" /> Comissão (%)
              </button>
              <button type="button" onClick={() => setRegras({ ...regras, modo: "premiacao" })}
                className={`h-9 rounded-md border text-[12px] flex items-center justify-center gap-1.5 transition-colors ${regras.modo === "premiacao" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted/50"}`}>
                <Trophy className="w-3.5 h-3.5" /> Premiação (faixas)
              </button>
            </div>
          </div>
          {regras.modo === "comissao" ? (
            <div>
              <label className="text-[11px] uppercase text-muted-foreground tracking-wider">Percentual sobre vendas</label>
              <Input type="number" step="0.1" value={regras.comissao_percentual}
                onChange={(e) => setRegras({ ...regras, comissao_percentual: Number(e.target.value) })} className="mt-1" />
              <div className="text-[11px] text-muted-foreground mt-1">{regras.comissao_percentual}% do faturamento individual</div>
            </div>
          ) : (
            <div>
              <label className="text-[11px] uppercase text-muted-foreground tracking-wider">Resumo</label>
              <div className="text-[12px] mt-2 leading-relaxed">
                {regras.premiacao_tiers.length} faixa(s) · acima de <b>{fmtBRL(regras.premiacao_step_a_partir_de)}</b>, +{fmtBRL(regras.premiacao_step_valor)} a cada {fmtBRL(regras.premiacao_step_tamanho)} vendidos.
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
                  <Input type="number" step="1000" value={t.vendido_min}
                    onChange={(e) => updateTier(i, { vendido_min: Number(e.target.value) })} className="w-40" />
                  <div className="text-[11px] text-muted-foreground">→ ganha</div>
                  <Input type="number" step="50" value={t.valor}
                    onChange={(e) => updateTier(i, { valor: Number(e.target.value) })} className="w-40" />
                  <Button size="icon" variant="ghost" onClick={() => removeTier(i)}>
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-border">
              <div>
                <label className="text-[11px] uppercase text-muted-foreground tracking-wider">Step a partir de</label>
                <Input type="number" step="1000" value={regras.premiacao_step_a_partir_de}
                  onChange={(e) => setRegras({ ...regras, premiacao_step_a_partir_de: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <label className="text-[11px] uppercase text-muted-foreground tracking-wider">Tamanho do step</label>
                <Input type="number" step="1000" value={regras.premiacao_step_tamanho}
                  onChange={(e) => setRegras({ ...regras, premiacao_step_tamanho: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <label className="text-[11px] uppercase text-muted-foreground tracking-wider">Valor por step</label>
                <Input type="number" step="50" value={regras.premiacao_step_valor}
                  onChange={(e) => setRegras({ ...regras, premiacao_step_valor: Number(e.target.value) })} className="mt-1" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="surface-card p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wider">Total vendido</div>
          <div className="text-[22px] font-medium mt-1">{fmtBRL(totais.vendido)}</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wider">Pessoas elegíveis</div>
          <div className="text-[22px] font-medium mt-1">{totais.elegiveis} <span className="text-[12px] text-muted-foreground">de {pessoas.length}</span></div>
        </div>
        <div className="surface-card p-4">
          <div className="text-[11px] uppercase text-muted-foreground tracking-wider">Total a pagar</div>
          <div className="text-[22px] font-medium mt-1 text-amber-600">{fmtBRL(totais.premio)}</div>
        </div>
      </div>

      {/* Pessoas */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-3 print:hidden">
          <div className="text-[14px] font-medium flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" /> Cálculo individual
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportExcel}>
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Excel
            </Button>
            <Button size="sm" variant="outline" onClick={exportPDF}>
              <FileText className="w-3.5 h-3.5 mr-1.5" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={imprimir}>
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Imprimir
            </Button>
          </div>
        </div>
        {loading ? (
          <div className="py-8 text-center text-[12px] text-muted-foreground animate-pulse">Carregando…</div>
        ) : pessoas.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-muted-foreground">Nenhuma pessoa encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 px-2 font-normal w-6"></th>
                  <th className="py-2 px-2 font-normal">Pessoa</th>
                  <th className="py-2 px-2 font-normal">Papel</th>
                  <th className="py-2 px-2 font-normal text-right">Qtd</th>
                  <th className="py-2 px-2 font-normal text-right">Vendido</th>
                  <th className="py-2 px-2 font-normal text-right">% Meta</th>
                  <th className="py-2 px-2 font-normal text-right">Prêmio</th>
                </tr>
              </thead>
              <tbody>
                {pessoas.map((r) => {
                  const premio = calcularPremio(r.vendido, regras);
                  const pct = regras.meta_minima > 0 ? (r.vendido / regras.meta_minima) * 100 : 0;
                  const elegivel = r.vendido >= regras.meta_minima;
                  const isOpen = expandido === r.user_id;
                  const pedidosDaPessoa = r.pedidos
                    .map((rp) => ({ ...rp, pedido: pedidos.find((p) => p.id === rp.pedido_id)! }))
                    .filter((x) => x.pedido)
                    .sort((a, b) => +new Date(b.pedido.data) - +new Date(a.pedido.data));
                  return (
                    <Fragment key={r.user_id}>
                      <tr
                        className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                        onClick={() => setExpandido(isOpen ? null : r.user_id)}>
                        <td className="py-2 px-2">
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </td>
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
                      {isOpen && (
                        <tr className="bg-muted/20 print:hidden">
                          <td colSpan={7} className="p-0">
                            <div className="p-3">
                              {pedidosDaPessoa.length === 0 ? (
                                <div className="text-[11px] text-muted-foreground text-center py-3">Sem pedidos no período.</div>
                              ) : (
                                <table className="w-full text-[11px]">
                                  <thead>
                                    <tr className="text-left text-muted-foreground">
                                      <th className="py-1.5 px-2 font-normal">Pedido</th>
                                      <th className="py-1.5 px-2 font-normal">Cliente</th>
                                      <th className="py-1.5 px-2 font-normal">Data</th>
                                      <th className="py-1.5 px-2 font-normal text-right">Valor total</th>
                                      <th className="py-1.5 px-2 font-normal text-right">% atribuído</th>
                                      <th className="py-1.5 px-2 font-normal text-right">Atribuído</th>
                                      <th className="py-1.5 px-2 font-normal text-center">Divisão</th>
                                      <th className="py-1.5 px-2"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {pedidosDaPessoa.map((x) => (
                                      <tr key={x.pedido_id} className="border-t border-border/40">
                                        <td className="py-1.5 px-2 font-medium">{x.pedido.codigo}</td>
                                        <td className="py-1.5 px-2">{x.pedido.cliente_nome}</td>
                                        <td className="py-1.5 px-2">{fmtDate(x.pedido.data)}</td>
                                        <td className="py-1.5 px-2 text-right">{fmtBRL(x.pedido.valor_total)}</td>
                                        <td className="py-1.5 px-2 text-right">{x.percentual.toFixed(0)}%</td>
                                        <td className="py-1.5 px-2 text-right font-medium">{fmtBRL(x.valor_atribuido)}</td>
                                        <td className="py-1.5 px-2 text-center text-muted-foreground">
                                          {x.pedido.override ? "personalizada" : "padrão"}
                                        </td>
                                        <td className="py-1.5 px-2 text-right">
                                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDialogPedido(x.pedido); }}>
                                            <Split className="w-3.5 h-3.5 mr-1" /> Editar
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DivisaoDialog
        pedido={dialogPedido}
        pessoasCatalogo={pessoasCatalogo}
        onClose={() => setDialogPedido(null)}
        onSaved={() => { setDialogPedido(null); setReloadKey((k) => k + 1); }}
      />
    </div>
  );
}

function DivisaoDialog({
  pedido, pessoasCatalogo, onClose, onSaved,
}: {
  pedido: PedidoRow | null;
  pessoasCatalogo: { user_id: string; nome: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [parts, setParts] = useState<Participante[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pedido) setParts(pedido.participantes.length > 0 ? [...pedido.participantes] : [{ user_id: "", percentual: 100, papel: "Vendedor/Consultor" }]);
  }, [pedido]);

  if (!pedido) return null;

  const total = parts.reduce((s, p) => s + (Number(p.percentual) || 0), 0);
  const valido = Math.abs(total - 100) < 0.01 && parts.every((p) => p.user_id);

  const salvar = async () => {
    if (!valido) { toast.error("Os percentuais devem somar 100% e todas as pessoas devem ser preenchidas."); return; }
    setSaving(true);
    await supabase.from("pedido_comissao_divisoes" as any).delete().eq("pedido_id", pedido.id);
    const { error } = await supabase.from("pedido_comissao_divisoes" as any).insert(
      parts.map((p) => ({ pedido_id: pedido.id, user_id: p.user_id, papel: p.papel, percentual: p.percentual })),
    );
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else { toast.success("Divisão salva"); onSaved(); }
  };

  const restaurar = async () => {
    setSaving(true);
    await supabase.from("pedido_comissao_divisoes" as any).delete().eq("pedido_id", pedido.id);
    setSaving(false);
    toast.success("Divisão restaurada para o padrão");
    onSaved();
  };

  return (
    <Dialog open={!!pedido} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Dividir comissão · {pedido.codigo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-[12px] text-muted-foreground">
            Cliente: <b className="text-foreground">{pedido.cliente_nome}</b> · Valor: <b className="text-foreground">{fmtBRL(pedido.valor_total)}</b>
          </div>
          <div className="space-y-2">
            {parts.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={p.user_id} onValueChange={(v) => setParts((arr) => arr.map((x, k) => k === i ? { ...x, user_id: v } : x))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione pessoa" /></SelectTrigger>
                  <SelectContent>
                    {pessoasCatalogo.map((pe) => (<SelectItem key={pe.user_id} value={pe.user_id}>{pe.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={p.papel} onValueChange={(v) => setParts((arr) => arr.map((x, k) => k === i ? { ...x, papel: v } : x))}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vendedor/Consultor">Vendedor/Consultor</SelectItem>
                    <SelectItem value="Projetista">Projetista</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" step="1" className="w-20" value={p.percentual}
                  onChange={(e) => setParts((arr) => arr.map((x, k) => k === i ? { ...x, percentual: Number(e.target.value) } : x))} />
                <span className="text-[11px] text-muted-foreground">%</span>
                <Button size="icon" variant="ghost" onClick={() => setParts((arr) => arr.filter((_, k) => k !== i))}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Button size="sm" variant="outline" onClick={() => setParts((arr) => [...arr, { user_id: "", percentual: 0, papel: "Vendedor/Consultor" }])}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar pessoa
            </Button>
            <div className={`text-[12px] ${valido ? "text-emerald-600" : "text-rose-500"}`}>
              Total: {total.toFixed(1)}%
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {pedido.override && (
            <Button variant="outline" onClick={restaurar} disabled={saving}>Restaurar padrão</Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || !valido}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
