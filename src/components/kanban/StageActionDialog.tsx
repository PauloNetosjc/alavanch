import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink, FileText, Flame, Clock, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";

type CardLite = {
  id: string;
  pedido_id: string;
  estagio_id: string;
  prazo: string | null;
  iniciado_em: string | null;
};
type Stage = { id: string; nome: string; ordem?: number; cor: string | null; checklist_template_id: string | null };
type Pedido = {
  id: string; codigo: string; valor_total: number | null;
  urgencia: string | null;
  cliente: { nome: string } | null;
};
type Contrato = { id: string; numero: string; status: string; signing_token: string | null; assinado_em: string | null };
type ChkItem = { id: string; descricao: string; concluido: boolean; ordem: number };

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const diffDays = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
};

async function logPedidoEvento(pedidoId: string, tipo: string, descricao: string, metadata: Record<string, any> = {}) {
  try {
    const { data: u } = await supabase.auth.getUser();
    await (supabase as any).from("timeline_eventos").insert({
      entidade_tipo: "pedido",
      entidade_id: pedidoId,
      tipo,
      descricao,
      usuario_id: u.user?.id ?? null,
      metadata,
    });
  } catch (e) {
    console.error("logPedidoEvento failed", e);
  }
}

export function StageActionDialog({
  open, onOpenChange, card, stage, pipeline, estagios, onUpdated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  card: CardLite | null;
  stage: Stage | null;
  pipeline: string;
  estagios: Stage[];
  onUpdated: () => void;
}) {
  const nav = useNavigate();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [items, setItems] = useState<ChkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const isPosVenda = pipeline === "pos_venda";

  const load = async () => {
    if (!card || !stage) return;
    setLoading(true);
    const ped0 = await supabase.from("pedidos").select("orcamento_id").eq("id", card.pedido_id).maybeSingle();
    const [{ data: ped }, { data: ctr }] = await Promise.all([
      supabase.from("pedidos").select("id,codigo,valor_total,urgencia,cliente:clientes(nome)").eq("id", card.pedido_id).maybeSingle(),
      supabase.from("contratos").select("id,numero,status,signing_token,assinado_em").eq("orcamento_id", ped0.data?.orcamento_id ?? "").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setPedido(ped as Pedido | null);
    setContrato(ctr as Contrato | null);

    const { data: existing } = await supabase
      .from("pedido_estagio_checklist")
      .select("id,descricao,concluido,ordem")
      .eq("pedido_id", card.pedido_id)
      .eq("estagio_id", card.estagio_id)
      .order("ordem");

    if ((existing?.length ?? 0) === 0 && stage.checklist_template_id) {
      const { data: tplItems } = await supabase
        .from("checklist_template_itens")
        .select("descricao,ordem")
        .eq("template_id", stage.checklist_template_id)
        .order("ordem");
      if (tplItems && tplItems.length) {
        const payload = tplItems.map((t, i) => ({
          pedido_id: card.pedido_id, estagio_id: card.estagio_id, descricao: t.descricao, ordem: t.ordem ?? i,
        }));
        const { data: created } = await supabase.from("pedido_estagio_checklist").insert(payload).select("id,descricao,concluido,ordem").order("ordem");
        setItems((created ?? []) as ChkItem[]);
      } else {
        setItems([]);
      }
    } else {
      setItems((existing ?? []) as ChkItem[]);
    }
    setLoading(false);
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, card?.id, stage?.id]);

  const proximoEstagio = (): Stage | null => {
    if (!stage) return null;
    const sorted = [...estagios].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const idx = sorted.findIndex((s) => s.id === stage.id);
    if (idx < 0 || idx >= sorted.length - 1) return null;
    return sorted[idx + 1];
  };

  const moverParaProximo = async (auto: boolean) => {
    if (!card || !stage || !pedido) return;
    const prox = proximoEstagio();
    if (!prox) {
      if (!auto) toast.info("Este já é o último estágio do pipeline.");
      return false;
    }
    setBusy(true);
    const { error } = await (supabase as any).from("kanban_cards")
      .update({ estagio_id: prox.id, iniciado_em: new Date().toISOString(), notificacao_atraso_em: null })
      .eq("id", card.id);
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    await logPedidoEvento(pedido.id, "kanban_movimento",
      `[${pipeline}] ${stage.nome} → ${prox.nome}${auto ? " (checklist concluído)" : ""}`,
      { pipeline, de: stage.nome, para: prox.nome, card_id: card.id, auto }
    );
    toast.success(auto ? "Checklist concluído — card avançou" : "Card movido");
    onUpdated();
    onOpenChange(false);
    return true;
  };

  const toggle = async (item: ChkItem) => {
    const novo = !item.concluido;
    const novosItems = items.map((x) => (x.id === item.id ? { ...x, concluido: novo } : x));
    setItems(novosItems);
    const { error } = await supabase.from("pedido_estagio_checklist").update({
      concluido: novo,
      concluido_em: novo ? new Date().toISOString() : null,
    }).eq("id", item.id);
    if (error) {
      toast.error(error.message);
      setItems((arr) => arr.map((x) => (x.id === item.id ? { ...x, concluido: !novo } : x)));
      return;
    }
    if (pedido) {
      await logPedidoEvento(pedido.id, "checklist_item",
        `[${pipeline}/${stage?.nome}] ${novo ? "✓" : "○"} ${item.descricao}`,
        { pipeline, estagio: stage?.nome, item: item.descricao, concluido: novo }
      );
    }
    // Auto-advance when checklist fully complete (não para pós-venda)
    if (!isPosVenda && novo && novosItems.length > 0 && novosItems.every((i) => i.concluido)) {
      await moverParaProximo(true);
    }
  };

  const concluirCard = async () => {
    if (!card || !pedido) return;
    if (!confirm("Concluir e remover este card? O pedido permanece no sistema.")) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc("concluir_kanban_card", { _card_id: card.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    await logPedidoEvento(pedido.id, "kanban_concluido",
      `[${pipeline}] Card concluído na etapa "${stage?.nome}"`,
      { pipeline, estagio: stage?.nome, card_id: card.id }
    );
    toast.success("Card concluído");
    onUpdated();
    onOpenChange(false);
  };

  if (!card || !stage) return null;
  const d = diffDays(card.prazo);
  const atrasado = d != null && d < 0;
  const prox = proximoEstagio();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: stage.cor || "#6b7280" }} />
            {stage.nome}
          </DialogTitle>
        </DialogHeader>

        {loading || !pedido ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Carregando…</div>
        ) : (
          <div className="space-y-4">
            <div className="border rounded-lg p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground font-mono">{pedido.codigo}</div>
                  <div className="font-semibold">{pedido.cliente?.nome ?? "—"}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold">{fmtBrl(Number(pedido.valor_total) || 0)}</div>
                  {pedido.urgencia && (
                    <div className="text-[11px] inline-flex items-center gap-1 mt-1 text-muted-foreground">
                      <Flame className="w-3 h-3" /> Urgência {pedido.urgencia}
                    </div>
                  )}
                </div>
              </div>
              {card.prazo && (
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                  atrasado ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                }`}>
                  {atrasado ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {d == null ? "—" : d < 0 ? `${Math.abs(d)}d em atraso` : d === 0 ? "Vence hoje" : `${d}d restantes`}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => nav(`/pedidos/${pedido.id}`)}>
                <ExternalLink className="w-4 h-4 mr-1" /> Abrir pedido
              </Button>
              {contrato && (
                <Button variant="outline" size="sm" onClick={() => nav(`/contratos/${contrato.id}`)}>
                  <FileText className="w-4 h-4 mr-1" /> Contrato {contrato.numero}
                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                    contrato.status === "assinado" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}>{contrato.status}</span>
                </Button>
              )}
              {contrato?.signing_token && contrato.status === "aguardando_assinatura" && (
                <Button variant="outline" size="sm" onClick={() => window.open(`/contrato/${contrato.signing_token}`, "_blank")}>
                  <ExternalLink className="w-4 h-4 mr-1" /> Link de assinatura
                </Button>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold">Checklist da etapa</div>
                {!isPosVenda && (
                  <div className="text-[11px] text-muted-foreground">
                    {prox
                      ? items.length > 0
                        ? `Concluir checklist avança para "${prox.nome}"`
                        : `Sem checklist — movimentação manual (próximo: "${prox.nome}")`
                      : "Último estágio — aguarda conclusão manual"}
                  </div>
                )}
              </div>
              {items.length === 0 ? (
                <div className="text-xs text-muted-foreground border rounded-lg p-3 text-center">
                  Nenhum checklist configurado para esta etapa. Defina um modelo em <strong>Editar estágios</strong>.
                </div>
              ) : (
                <div className="space-y-1.5 border rounded-lg p-3">
                  {items.map((it) => (
                    <label key={it.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={it.concluido} onCheckedChange={() => toggle(it)} />
                      <span className={it.concluido ? "line-through text-muted-foreground" : ""}>{it.descricao}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {!isPosVenda && prox && (
            <Button variant="secondary" disabled={busy} onClick={() => moverParaProximo(false)}>
              Avançar para "{prox.nome}"
            </Button>
          )}
          <Button disabled={busy} onClick={concluirCard} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Check className="w-4 h-4 mr-1" /> Concluir card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
