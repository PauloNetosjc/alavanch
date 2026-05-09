import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink, FileText, Flame, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type CardLite = {
  id: string;          // kanban_cards.id
  pedido_id: string;
  estagio_id: string;
  prazo: string | null;
  iniciado_em: string | null;
};
type Stage = { id: string; nome: string; cor: string | null; checklist_template_id: string | null };
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

export function StageActionDialog({
  open, onOpenChange, card, stage, onUpdated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  card: CardLite | null;
  stage: Stage | null;
  onUpdated: () => void;
}) {
  const nav = useNavigate();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [items, setItems] = useState<ChkItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!card || !stage) return;
    setLoading(true);
    const [{ data: ped }, { data: ctr }] = await Promise.all([
      supabase.from("pedidos").select("id,codigo,valor_total,urgencia,cliente:clientes(nome)").eq("id", card.pedido_id).maybeSingle(),
      supabase.from("contratos").select("id,numero,status,signing_token,assinado_em").eq("orcamento_id", (await supabase.from("pedidos").select("orcamento_id").eq("id", card.pedido_id).maybeSingle()).data?.orcamento_id ?? "").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setPedido(ped as Pedido | null);
    setContrato(ctr as Contrato | null);

    // checklist: existing items for pedido+estagio
    const { data: existing } = await supabase
      .from("pedido_estagio_checklist")
      .select("id,descricao,concluido,ordem")
      .eq("pedido_id", card.pedido_id)
      .eq("estagio_id", card.estagio_id)
      .order("ordem");

    if ((existing?.length ?? 0) === 0 && stage.checklist_template_id) {
      // Instantiate from template
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

  const toggle = async (item: ChkItem) => {
    const novo = !item.concluido;
    setItems((arr) => arr.map((x) => (x.id === item.id ? { ...x, concluido: novo } : x)));
    const { error } = await supabase.from("pedido_estagio_checklist").update({
      concluido: novo,
      concluido_em: novo ? new Date().toISOString() : null,
    }).eq("id", item.id);
    if (error) {
      toast.error(error.message);
      setItems((arr) => arr.map((x) => (x.id === item.id ? { ...x, concluido: !novo } : x)));
    }
  };

  if (!card || !stage) return null;
  const d = diffDays(card.prazo);
  const atrasado = d != null && d < 0;

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
            {/* Pedido summary */}
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

            {/* Quick links */}
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

            {/* Checklist */}
            <div>
              <div className="text-sm font-semibold mb-2">Checklist da etapa</div>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
