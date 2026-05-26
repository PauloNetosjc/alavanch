import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, PieChart, Search, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { BRL } from "@/lib/financeiro";
import { LojasFilter } from "@/components/financeiro/LojasFilter";
import { useLoja } from "@/contexts/LojaContext";

type Pedido = { id: string; codigo: string; cliente_id: string | null; valor_total: number; loja_id: string | null };

type Lanc = {
  id: string;
  tipo: string;
  descricao: string | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string | null;
  categoria_id: string | null;
};
type Cat = { id: string; nome: string };

export default function AnaliseFinanceira() {
  const { id } = useParams<{ id?: string }>();
  const nav = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [busca, setBusca] = useState("");
  const [pedidoSel, setPedidoSel] = useState<Pedido | null>(null);
  const [cliente, setCliente] = useState<string>("");
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);

  const { selectedLojaId } = useLoja();
  const [lojasFiltro, setLojasFiltro] = useState<string[]>([]);
  useEffect(() => {
    if (selectedLojaId) setLojasFiltro([selectedLojaId]); else setLojasFiltro([]);
  }, [selectedLojaId]);

  useEffect(() => {
    supabase
      .from("pedidos")
      .select("id, codigo, cliente_id, valor_total, loja_id")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setPedidos((data as Pedido[]) || []));
    supabase
      .from("categorias_financeiras")
      .select("id, nome")
      .then(({ data }) => setCats((data as Cat[]) || []));
  }, []);



  useEffect(() => {
    if (!id) return;
    const p = pedidos.find((x) => x.id === id);
    if (p) selecionar(p);
  }, [id, pedidos]);

  async function selecionar(p: Pedido) {
    setPedidoSel(p);
    nav(`/financeiro/analise/${p.id}`, { replace: true });
    if (p.cliente_id) {
      const { data: c } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", p.cliente_id)
        .maybeSingle();
      setCliente((c as any)?.nome || "");
    }
    const { data: l } = await supabase
      .from("lancamentos_financeiros")
      .select("id, tipo, descricao, valor, data_vencimento, data_pagamento, status, categoria_id")
      .eq("pedido_id", p.id)
      .order("data_vencimento", { ascending: true });
    setLancs((l as Lanc[]) || []);
  }

  const filtrados = useMemo(
    () => pedidos.filter((p) =>
      p.codigo.toLowerCase().includes(busca.toLowerCase()) &&
      (lojasFiltro.length === 0 || lojasFiltro.includes(p.loja_id || ""))
    ),
    [pedidos, busca, lojasFiltro]
  );


  const recebimentoReal = useMemo(
    () => lancs.filter((l) => l.tipo === "entrada" && l.status === "pago").reduce((a, b) => a + Number(b.valor), 0),
    [lancs]
  );
  const saidasReais = useMemo(
    () => lancs.filter((l) => l.tipo === "saida" && l.status === "pago").reduce((a, b) => a + Number(b.valor), 0),
    [lancs]
  );
  const meta = pedidoSel?.valor_total || 0;
  const lucroReal = recebimentoReal - saidasReais;
  const margem = recebimentoReal > 0 ? (lucroReal / recebimentoReal) * 100 : 0;

  const composicao = useMemo(() => {
    const map = new Map<string, number>();
    lancs
      .filter((l) => l.tipo === "saida")
      .forEach((l) => {
        const nome = cats.find((c) => c.id === l.categoria_id)?.nome || "Outros";
        map.set(nome, (map.get(nome) || 0) + Number(l.valor));
      });
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(map.entries())
      .map(([nome, valor]) => ({ nome, valor, perc: (valor / total) * 100 }))
      .sort((a, b) => b.valor - a.valor);
  }, [lancs, cats]);

  // Tela de seleção
  if (!pedidoSel) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => nav("/financeiro")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <PieChart className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display">Resultado</h1>
            <p className="text-xs text-muted-foreground">Análise de Contratos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl p-8 text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
            <PieChart className="w-10 h-10 mb-4 opacity-80" />
            <h2 className="text-3xl font-display leading-tight">Análise Financeira Inteligente</h2>
            <p className="mt-3 text-sm opacity-90">
              Acompanhe receitas, custos e lucratividade de cada contrato em tempo real.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              <li className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Receitas e Despesas Reais</li>
              <li className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Comparação Previsto vs Realizado</li>
              <li className="flex items-center gap-2"><Wallet className="w-4 h-4" /> Detalhamento de Custos</li>
            </ul>
          </div>

          <div className="surface-card p-6">
            <h3 className="text-lg font-medium">Começar Análise</h3>
            <p className="text-xs text-muted-foreground mb-4">Selecione ou busque um contrato</p>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Buscar Contrato"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {filtrados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selecionar(p)}
                  className="w-full text-left px-4 py-3 rounded-lg border hover:bg-muted transition"
                >
                  <div className="text-xs text-muted-foreground">Contrato {p.codigo}</div>
                </button>
              ))}
              {!filtrados.length && (
                <div className="text-xs text-muted-foreground text-center py-4">Nenhum contrato encontrado.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tela de resultado
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => { setPedidoSel(null); nav("/financeiro/analise"); }}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <PieChart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display">Resultado Financeiro</h1>
          <p className="text-xs text-muted-foreground">{pedidoSel.codigo}{cliente ? ` - ${cliente}` : ""}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-5" style={{ background: "hsl(142 70% 95%)" }}>
          <div className="text-[10px] uppercase tracking-wider text-green-700 font-medium">Recebimento Real</div>
          <div className="text-3xl font-display text-green-800 mt-2">{BRL(recebimentoReal)}</div>
          <div className="text-xs text-green-700 mt-1">Meta: {BRL(meta)}</div>
          <div className="h-1.5 bg-green-200 rounded mt-2 overflow-hidden">
            <div className="h-full bg-green-600" style={{ width: `${Math.min(100, meta ? (recebimentoReal / meta) * 100 : 0)}%` }} />
          </div>
          <div className="text-[11px] text-green-700 mt-2">
            {meta ? ((recebimentoReal / meta) * 100).toFixed(1) : 0}% Coletado
          </div>
        </div>
        <div className="rounded-xl p-5" style={{ background: "hsl(0 70% 96%)" }}>
          <div className="text-[10px] uppercase tracking-wider text-red-700 font-medium">Saídas Reais</div>
          <div className="text-3xl font-display text-red-800 mt-2">{BRL(saidasReais)}</div>
          <div className="text-xs text-red-700 mt-1">Teto: {BRL(meta * 0.55)}</div>
          <div className="h-1.5 bg-red-200 rounded mt-2 overflow-hidden">
            <div className="h-full bg-red-600" style={{ width: `${Math.min(100, recebimentoReal ? (saidasReais / recebimentoReal) * 100 : 0)}%` }} />
          </div>
          <div className="text-[11px] text-red-700 mt-2">
            {recebimentoReal ? ((saidasReais / recebimentoReal) * 100).toFixed(1) : 0}% Consumido
          </div>
        </div>
        <div className="rounded-xl p-5" style={{ background: "hsl(250 70% 96%)" }}>
          <div className="text-[10px] uppercase tracking-wider text-purple-700 font-medium">Lucro Líquido Real</div>
          <div className="text-3xl font-display text-purple-800 mt-2">{BRL(lucroReal)}</div>
          <div className="flex justify-between text-xs text-purple-700 mt-1">
            <span>Esperado:</span>
            <span>{BRL(meta - saidasReais)}</span>
          </div>
          <Badge className="mt-2 bg-purple-600 text-white border-0">{margem.toFixed(1)}% Margem</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 surface-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-primary" />
            <h3 className="font-medium">Detalhamento Financeiro Real</h3>
          </div>
          <div className="grid grid-cols-3 text-[10px] uppercase tracking-wider text-muted-foreground py-2 border-b">
            <span>Data</span>
            <span>Descrição</span>
            <span className="text-right">Valor</span>
          </div>
          <div className="divide-y">
            {lancs.map((l) => (
              <div key={l.id} className="grid grid-cols-3 py-3 text-sm items-start">
                <span className="text-xs text-muted-foreground">
                  {l.data_pagamento ? new Date(l.data_pagamento + "T00:00").toLocaleDateString("pt-BR") :
                   l.data_vencimento ? new Date(l.data_vencimento + "T00:00").toLocaleDateString("pt-BR") : "—"}
                </span>
                <div>
                  <div>{l.descricao || "—"}</div>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline" className={l.tipo === "entrada" ? "text-green-700 border-green-300" : "text-red-700 border-red-300"}>
                      {l.tipo === "entrada" ? "Entrada" : "Saída"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {cats.find((c) => c.id === l.categoria_id)?.nome || "Sem categoria"}
                    </Badge>
                  </div>
                </div>
                <span className={"text-right font-medium " + (l.tipo === "entrada" ? "text-green-700" : "text-red-700")}>
                  {l.tipo === "saida" ? "- " : ""}{BRL(l.valor)}
                </span>
              </div>
            ))}
            {!lancs.length && <div className="py-6 text-center text-sm text-muted-foreground">Sem lançamentos para este contrato.</div>}
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="font-medium">Composição de Custos</h3>
            </div>
            <span className="text-xs text-muted-foreground">Valor</span>
          </div>
          <div className="space-y-4">
            {composicao.map((c) => (
              <div key={c.nome}>
                <div className="flex justify-between text-sm">
                  <span>{c.nome}</span>
                  <span className="font-medium">{BRL(c.valor)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded mt-1 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${c.perc}%` }} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{c.perc.toFixed(1)}%</div>
              </div>
            ))}
            {!composicao.length && <div className="text-xs text-muted-foreground">Sem custos lançados.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
