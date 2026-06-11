import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ShieldCheck, Check, X, Clock, Calendar, Percent, FileEdit, Layers, Split } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIA_LABEL, TIPO_LABEL, type AutCategoria, type AutStatus } from "@/lib/autorizacoes";

interface Autorizacao {
  id: string;
  categoria: AutCategoria | null;
  tipo: string;
  status: AutStatus;
  titulo: string;
  descricao: string | null;
  contexto: any;
  loja_id: string | null;
  pedido_id: string | null;
  orcamento_id: string | null;
  agenda_evento_id: string | null;
  origem_modulo: string | null;
  origem_id: string | null;
  motivo_solicitacao: string | null;
  motivo_rejeicao: string | null;
  valor_solicitado: number | null;
  limite_padrao: number | null;
  solicitante_email: string | null;
  aprovador_email: string | null;
  decidido_em: string | null;
  decisao_observacao: string | null;
  created_at: string;
}

const STATUS_COR: Record<string, string> = {
  pendente: "bg-amber-500/15 text-amber-700 border-amber-300",
  aprovada: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  rejeitada: "bg-rose-500/15 text-rose-700 border-rose-300",
  expirada: "bg-slate-500/15 text-slate-600 border-slate-300",
  cancelada: "bg-slate-500/15 text-slate-600 border-slate-300",
};

const CAT_ICON: Record<string, any> = {
  revisao: FileEdit,
  agenda: Calendar,
  desconto: Percent,
  outro: Layers,
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function fmtBrl(n: number | null | undefined) {
  return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CategoriaDetalhes({ a }: { a: Autorizacao }) {
  const ctx = a.contexto || {};
  if (a.categoria === "desconto") {
    return (
      <div className="text-[12px] mt-1 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
        {ctx.valor_original != null && <div>Valor original: <strong>{fmtBrl(ctx.valor_original)}</strong></div>}
        {ctx.valor_com_desconto != null && <div>Valor final: <strong>{fmtBrl(ctx.valor_com_desconto)}</strong></div>}
        {(a.valor_solicitado ?? ctx.percentual_desconto) != null && (
          <div>Desconto: <strong>{Number(a.valor_solicitado ?? ctx.percentual_desconto).toFixed(2)}%</strong></div>
        )}
        {(a.limite_padrao ?? ctx.limite_permitido) != null && (
          <div>Limite: <strong>{Number(a.limite_padrao ?? ctx.limite_permitido).toFixed(2)}%</strong></div>
        )}
      </div>
    );
  }
  if (a.categoria === "agenda") {
    return (
      <div className="text-[12px] mt-1 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
        {ctx.data && <div>Data: <strong>{ctx.data} {ctx.hora_inicio || ""}{ctx.hora_fim ? `–${ctx.hora_fim}` : ""}</strong></div>}
        {ctx.tipo_evento && <div>Tipo: <strong>{ctx.tipo_evento}</strong></div>}
        {ctx.responsavel && <div>Responsável: <strong>{ctx.responsavel}</strong></div>}
        {ctx.endereco && <div className="col-span-2 md:col-span-3 truncate">Endereço: {ctx.endereco}</div>}
        {ctx.regra_violada && <div className="col-span-2 md:col-span-3 text-amber-700">Regra violada: {ctx.regra_violada}</div>}
      </div>
    );
  }
  if (a.categoria === "revisao") {
    return (
      <div className="text-[12px] mt-1 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
        {ctx.ambiente && <div>Ambiente: <strong>{ctx.ambiente}</strong></div>}
        {ctx.versao != null && <div>Versão: <strong>v{ctx.versao}</strong></div>}
        {ctx.valor_original != null && <div>Original: <strong>{fmtBrl(ctx.valor_original)}</strong></div>}
        {ctx.valor_revisado != null && <div>Revisado: <strong>{fmtBrl(ctx.valor_revisado)}</strong></div>}
        {ctx.diferenca != null && <div>Diferença: <strong>{fmtBrl(ctx.diferenca)}</strong></div>}
        {ctx.variacao_perc != null && <div>Variação: <strong>{Number(ctx.variacao_perc).toFixed(2)}%</strong></div>}
      </div>
    );
  }
  if (a.origem_modulo === "desmembramento") {
    const nomes: string[] = ctx.ambiente_nomes || [];
    return (
      <div className="text-[12px] mt-1">
        <div>
          Pedido: <strong>{ctx.codigo_pedido || "—"}</strong>
        </div>
        <div>
          Ambientes a desmembrar: <strong>{nomes.join(", ") || "—"}</strong>
        </div>
      </div>
    );
  }
  return null;
}

export default function Autorizacoes() {
  const { user, role } = useAuth();
  const { can } = usePermissions();
  const podeDecidir = role === "admin" || role === "diretor" || can("autorizacoes", "aprovar");

  const [items, setItems] = useState<Autorizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AutStatus | "todas">("pendente");
  const [filtroCat, setFiltroCat] = useState<AutCategoria | "todas">("todas");

  const [decisao, setDecisao] = useState<{ id: string; acao: "aprovada" | "rejeitada" } | null>(null);
  const [obs, setObs] = useState("");

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("autorizacoes" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setItems(((data as any) || []) as Autorizacao[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const visiveis = useMemo(() => {
    return items.filter((i) => {
      if (tab !== "todas" && i.status !== tab) return false;
      if (filtroCat !== "todas" && (i.categoria || "outro") !== filtroCat) return false;
      return true;
    });
  }, [items, tab, filtroCat]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { pendente: 0, aprovada: 0, rejeitada: 0, todas: items.length };
    items.forEach((i) => { c[i.status] = (c[i.status] || 0) + 1; });
    return c;
  }, [items]);

  // Contadores por categoria respeitam o status selecionado
  const catCounts = useMemo(() => {
    const base = items.filter((i) => tab === "todas" || i.status === tab);
    const c: Record<string, number> = { todas: base.length, revisao: 0, agenda: 0, desconto: 0, outro: 0 };
    base.forEach((i) => { const k = i.categoria || "outro"; c[k] = (c[k] || 0) + 1; });
    return c;
  }, [items, tab]);

  const criarParcAprovado = async (a: Autorizacao) => {
    if (!a.pedido_id) throw new Error("Solicitação sem pedido vinculado");
    const ctx = a.contexto || {};
    const ambIds: string[] = ctx.ambiente_ids || [];
    if (ambIds.length === 0) throw new Error("Sem ambientes para desmembrar");

    // próximo número sequencial PARC-NN
    const { count } = await supabase
      .from("pedido_desmembramentos" as any)
      .select("id", { count: "exact", head: true })
      .eq("pedido_id_original", a.pedido_id);
    const nn = String((count || 0) + 1).padStart(2, "0");
    const codigoBase = ctx.codigo_pedido || "PEDIDO";
    const codigo_parcial = `${codigoBase}-PARC-${nn}`;

    const { data: desm, error: e1 } = await supabase
      .from("pedido_desmembramentos" as any)
      .insert({
        pedido_id_original: a.pedido_id,
        codigo_parcial,
        status_operacional: "venda_futura",
        etapa_atual: "venda_futura",
        observacao: a.motivo_solicitacao || null,
        criado_por: user?.id || null,
        ativo: true,
      })
      .select("id")
      .single();
    if (e1 || !desm) throw e1 || new Error("Falha ao criar PARC");

    // buscar nomes/valores dos ambientes
    const { data: ambs } = await supabase
      .from("ambientes")
      .select("id, nome, preco_sugerido")
      .in("id", ambIds);

    const itens = (ambs || []).map((amb: any) => ({
      desmembramento_id: (desm as any).id,
      pedido_id_original: a.pedido_id!,
      ambiente_id: amb.id,
      descricao: amb.nome,
      valor_operacional: Number(amb.preco_sugerido) || 0,
      quantidade: 1,
      status_operacional: "em_andamento",
      etapa_atual: "venda_futura",
    }));
    if (itens.length > 0) {
      const { error: e2 } = await supabase
        .from("pedido_desmembramento_itens" as any)
        .insert(itens);
      if (e2) throw e2;
    }
    return codigo_parcial;
  };

  const decidir = async () => {
    if (!decisao) return;
    if (!podeDecidir) { toast.error("Você não tem permissão para decidir."); return; }
    const alvo = items.find((i) => i.id === decisao.id);
    const payload: any = {
      status: decisao.acao,
      aprovador_id: user?.id,
      aprovador_email: user?.email,
      decidido_em: new Date().toISOString(),
      decisao_observacao: obs || null,
    };
    if (decisao.acao === "rejeitada") payload.motivo_rejeicao = obs || null;
    try {
      if (decisao.acao === "aprovada" && alvo?.origem_modulo === "desmembramento") {
        const codigo = await criarParcAprovado(alvo);
        toast.success(`PARC ${codigo} criado`);
      }
      const { error } = await supabase
        .from("autorizacoes" as any)
        .update(payload)
        .eq("id", decisao.id);
      if (error) throw error;
      toast.success(decisao.acao === "aprovada" ? "Solicitação aprovada" : "Solicitação rejeitada");
      setDecisao(null); setObs("");
      reload();
    } catch (e: any) {
      toast.error(e.message || "Erro ao decidir");
    }
  };

  const catBtn = (key: AutCategoria | "todas", label: string, Icon?: any) => {
    const ativo = filtroCat === key;
    const count = catCounts[key] ?? 0;
    return (
      <button
        key={key}
        onClick={() => setFiltroCat(key)}
        className={`flex items-center gap-2 px-3 h-9 rounded-md border text-[13px] transition-colors ${
          ativo ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent border-border"
        }`}
      >
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span>{label}</span>
        <span className={`text-[11px] px-1.5 py-0 rounded ${ativo ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"}`}>{count}</span>
      </button>
    );
  };

  return (
    <div>
      <PageHeader
        title="Autorizações"
        subtitle="Central de aprovações: revisões, agenda, descontos e exceções"
        icon={ShieldCheck}
      />

      <div className="flex flex-col gap-3 mb-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pendente">Pendentes ({statusCounts.pendente})</TabsTrigger>
            <TabsTrigger value="aprovada">Aprovadas ({statusCounts.aprovada})</TabsTrigger>
            <TabsTrigger value="rejeitada">Rejeitadas ({statusCounts.rejeitada})</TabsTrigger>
            <TabsTrigger value="todas">Todas ({statusCounts.todas})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          {catBtn("todas", "Todas")}
          {catBtn("revisao", CATEGORIA_LABEL.revisao, CAT_ICON.revisao)}
          {catBtn("agenda", CATEGORIA_LABEL.agenda, CAT_ICON.agenda)}
          {catBtn("desconto", CATEGORIA_LABEL.desconto, CAT_ICON.desconto)}
          {catBtn("outro", CATEGORIA_LABEL.outro, CAT_ICON.outro)}
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando…</div>
        ) : visiveis.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhuma solicitação nesta visão.</div>
        ) : (
          <div className="divide-y">
            {visiveis.map((a) => {
              const Icon = CAT_ICON[a.categoria || "outro"];
              return (
                <div key={a.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${STATUS_COR[a.status] || ""} border`}>{a.status.toUpperCase()}</Badge>
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Icon className="w-3 h-3" />
                          {CATEGORIA_LABEL[(a.categoria || "outro") as AutCategoria]} · {TIPO_LABEL[a.tipo] || a.tipo}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {fmtDate(a.created_at)}
                        </span>
                      </div>
                      <div className="text-[15px] font-semibold mt-1">{a.titulo}</div>
                      {a.descricao && <div className="text-[13px] text-muted-foreground mt-0.5">{a.descricao}</div>}
                      {a.motivo_solicitacao && (
                        <div className="text-[12px] mt-1 italic">Motivo: {a.motivo_solicitacao}</div>
                      )}
                      <CategoriaDetalhes a={a} />
                      <div className="text-[12px] text-muted-foreground mt-1">
                        Solicitado por: <span className="font-medium text-foreground">{a.solicitante_email || "—"}</span>
                        {a.aprovador_email && (
                          <> · Decidido por: <span className="font-medium text-foreground">{a.aprovador_email}</span> em {fmtDate(a.decidido_em)}</>
                        )}
                      </div>
                      {a.decisao_observacao && (
                        <div className="text-[12px] mt-1 italic">Obs. da decisão: {a.decisao_observacao}</div>
                      )}
                    </div>
                    {a.status === "pendente" && podeDecidir && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => { setDecisao({ id: a.id, acao: "aprovada" }); setObs(""); }}>
                          <Check className="w-4 h-4 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setDecisao({ id: a.id, acao: "rejeitada" }); setObs(""); }}>
                          <X className="w-4 h-4 mr-1" /> Rejeitar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!decisao} onOpenChange={(v) => { if (!v) setDecisao(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisao?.acao === "aprovada" ? "Aprovar solicitação" : "Rejeitar solicitação"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-[12px] text-muted-foreground">
              {decisao?.acao === "rejeitada" ? "Motivo da rejeição" : "Observação (opcional)"}
            </label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Justificativa da decisão…" rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisao(null)}>Cancelar</Button>
            <Button onClick={decidir} disabled={decisao?.acao === "rejeitada" && !obs.trim()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
