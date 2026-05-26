import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, ShieldCheck, Check, X, AlertTriangle, ArrowDownCircle, ArrowUpCircle, CheckCheck } from "lucide-react";
import { BRL } from "@/lib/financeiro";
import { toast } from "sonner";
import { LojasFilter } from "@/components/financeiro/LojasFilter";
import { useLoja } from "@/contexts/LojaContext";


type Lanc = {
  id: string;
  tipo: string;
  descricao: string | null;
  valor: number;
  data_vencimento: string | null;
  categoria_id: string | null;
  conta_id: string | null;
  pedido_id: string | null;
  aprovacao_status: string | null;
  created_at: string;
};
type Cat = { id: string; nome: string };
type Conta = { id: string; nome: string };
type Pedido = { id: string; codigo: string };

function fmt(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d + "T00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}

export default function AprovadorFinanceiro() {
  const { user, role } = useAuth();
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [perm, setPerm] = useState<{ pagar: boolean; receber: boolean }>({ pagar: false, receber: false });
  const [tab, setTab] = useState<"pagar" | "receber">("pagar");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  async function loadPerm() {
    if (!user) return;
    if (role === "admin") { setPerm({ pagar: true, receber: true }); return; }
    const { data } = await supabase
      .from("aprovadores_financeiros" as any)
      .select("aprova_pagar, aprova_receber")
      .eq("user_id", user.id);
    const rows = (data as any[]) || [];
    setPerm({
      pagar: rows.some((r) => r.aprova_pagar),
      receber: rows.some((r) => r.aprova_receber),
    });
  }

  async function load() {
    const [{ data: l }, { data: c }, { data: ct }, { data: pd }] = await Promise.all([
      supabase.from("lancamentos_financeiros").select("*").eq("aprovacao_status", "pendente_aprovacao").order("created_at", { ascending: false }).limit(2000),
      supabase.from("categorias_financeiras").select("id,nome").order("nome"),
      supabase.from("contas_bancarias").select("id,nome").order("nome"),
      supabase.from("pedidos").select("id,codigo").limit(500),
    ]);
    setLancs((l as Lanc[]) || []);
    setCats((c as Cat[]) || []);
    setContas((ct as Conta[]) || []);
    setPedidos((pd as Pedido[]) || []);
    setSelecionados(new Set());
  }

  useEffect(() => { loadPerm(); load(); }, [user, role]);

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.nome || "—";
  const contaName = (id: string | null) => contas.find((c) => c.id === id)?.nome || "—";
  const pedidoCod = (id: string | null) => pedidos.find((p) => p.id === id)?.codigo || null;

  const pendentesPagar = useMemo(() => lancs.filter((l) => l.tipo === "saida"), [lancs]);
  const pendentesReceber = useMemo(() => lancs.filter((l) => l.tipo === "entrada"), [lancs]);

  function toggleSel(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll(lista: Lanc[]) {
    const ids = lista.map((l) => l.id);
    const allSel = ids.every((id) => selecionados.has(id));
    setSelecionados((s) => {
      const n = new Set(s);
      if (allSel) ids.forEach((id) => n.delete(id));
      else ids.forEach((id) => n.add(id));
      return n;
    });
  }

  async function aprovar(l: Lanc) {
    if (l.tipo === "saida" && !perm.pagar) return toast.error("Você não é aprovador de contas a pagar");
    if (l.tipo === "entrada" && !perm.receber) return toast.error("Você não é aprovador de contas a receber");
    const { error } = await supabase
      .from("lancamentos_financeiros")
      .update({ aprovacao_status: "aprovado", aprovado_por: user?.id, aprovado_em: new Date().toISOString() })
      .eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Lançamento aprovado");
    load();
  }

  async function aprovarLote(lista: Lanc[]) {
    const alvo = lista.filter((l) => selecionados.has(l.id));
    if (!alvo.length) return toast.error("Nenhum lançamento selecionado");
    const tipo = alvo[0].tipo;
    if (tipo === "saida" && !perm.pagar) return toast.error("Você não é aprovador de contas a pagar");
    if (tipo === "entrada" && !perm.receber) return toast.error("Você não é aprovador de contas a receber");
    if (!confirm(`Aprovar ${alvo.length} lançamento(s) em lote?`)) return;
    const { error } = await supabase
      .from("lancamentos_financeiros")
      .update({ aprovacao_status: "aprovado", aprovado_por: user?.id, aprovado_em: new Date().toISOString() })
      .in("id", alvo.map((l) => l.id));
    if (error) return toast.error(error.message);
    toast.success(`${alvo.length} lançamento(s) aprovado(s)`);
    load();
  }

  async function rejeitar(l: Lanc) {
    if (l.tipo === "saida" && !perm.pagar) return toast.error("Você não é aprovador de contas a pagar");
    if (l.tipo === "entrada" && !perm.receber) return toast.error("Você não é aprovador de contas a receber");
    const motivo = prompt("Motivo da rejeição (opcional):") ?? "";
    const { error } = await supabase
      .from("lancamentos_financeiros")
      .update({ aprovacao_status: "rejeitado", aprovado_por: user?.id, aprovado_em: new Date().toISOString(), aprovacao_motivo: motivo })
      .eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Lançamento rejeitado");
    load();
  }

  const totalPagar = pendentesPagar.reduce((s, l) => s + Number(l.valor || 0), 0);
  const totalReceber = pendentesReceber.reduce((s, l) => s + Number(l.valor || 0), 0);

  const podeAlgo = perm.pagar || perm.receber;

  function renderTabela(lista: Lanc[], cor: "rose" | "emerald", podeAprovar: boolean) {
    const ids = lista.map((l) => l.id);
    const allSel = ids.length > 0 && ids.every((id) => selecionados.has(id));
    const someSel = ids.some((id) => selecionados.has(id));
    const qtdSel = ids.filter((id) => selecionados.has(id)).length;
    return (
      <div className="space-y-3">
        {lista.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2">
            <div className="text-xs text-muted-foreground">
              {qtdSel > 0 ? `${qtdSel} selecionado(s)` : "Selecione para aprovar em lote"}
            </div>
            <Button
              size="sm"
              disabled={!podeAprovar || qtdSel === 0}
              onClick={() => aprovarLote(lista)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCheck className="w-4 h-4 mr-1" /> Aprovar em Lote ({qtdSel})
            </Button>
          </div>
        )}
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
                  <th className="text-center py-3 px-3 font-medium w-8">
                    <Checkbox
                      checked={allSel}
                      onCheckedChange={() => toggleAll(lista)}
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="text-left py-3 px-2 font-medium">Lançado em</th>
                  <th className="text-left py-3 font-medium">Vencimento</th>
                  <th className="text-left py-3 font-medium">Descrição</th>
                  <th className="text-left py-3 font-medium">Categoria</th>
                  <th className="text-left py-3 font-medium">Conta</th>
                  <th className="text-right py-3 font-medium">Valor</th>
                  <th className="text-right py-3 px-5 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => {
                  const cod = pedidoCod(l.pedido_id);
                  const sel = selecionados.has(l.id);
                  return (
                    <tr key={l.id} className={`border-b hover:bg-muted/30 ${sel ? "bg-amber-50/40" : ""}`}>
                      <td className="text-center px-3">
                        <Checkbox checked={sel} onCheckedChange={() => toggleSel(l.id)} />
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="whitespace-nowrap">{fmt(l.data_vencimento)}</td>
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
                      <td className={`text-right font-semibold whitespace-nowrap text-${cor}-700`}>{BRL(Number(l.valor || 0))}</td>
                      <td className="text-right px-5">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" disabled={!podeAprovar} onClick={() => aprovar(l)}
                            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                            <Check className="w-4 h-4 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" disabled={!podeAprovar} onClick={() => rejeitar(l)}
                            className="text-rose-700 border-rose-300 hover:bg-rose-50">
                            <X className="w-4 h-4 mr-1" /> Rejeitar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!lista.length && (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-60" />
                    Nenhum lançamento aguardando aprovação
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/financeiro">
            <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao Financeiro</Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Aprovador</h1>
              <p className="text-sm text-muted-foreground">Contas pendentes de aprovação</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">Pagar: {perm.pagar ? "✓" : "—"}</Badge>
          <Badge variant="outline">Receber: {perm.receber ? "✓" : "—"}</Badge>
        </div>
      </div>

      {!podeAlgo && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Você ainda não foi cadastrado como aprovador. Solicite a um administrador em Configurações → Financeiro → Aprovador.
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setSelecionados(new Set()); }}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="pagar">
            <ArrowDownCircle className="w-4 h-4 mr-1.5 text-rose-600" />
            A Pagar ({pendentesPagar.length}) · {BRL(totalPagar)}
          </TabsTrigger>
          <TabsTrigger value="receber">
            <ArrowUpCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
            A Receber ({pendentesReceber.length}) · {BRL(totalReceber)}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pagar" className="mt-4">{renderTabela(pendentesPagar, "rose", perm.pagar)}</TabsContent>
        <TabsContent value="receber" className="mt-4">{renderTabela(pendentesReceber, "emerald", perm.receber)}</TabsContent>
      </Tabs>
    </div>
  );
}
