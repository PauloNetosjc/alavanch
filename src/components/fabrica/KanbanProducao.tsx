import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, ArrowRight, AlertCircle } from "lucide-react";
import { carregarEtapasFabrica, moverPedidoEtapa, type EtapaFabrica } from "@/lib/lotesProducao";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

type Card = {
  lote_pedido_id: string;
  pedido_id: string;
  lote_id: string;
  numero_lote: string;
  codigo: string | null;
  cliente_nome: string | null;
  data_limite_entrega: string | null;
  etapa_atual: string;
};

function fmt(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

function diasUteisAte(iso: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(iso + "T00:00:00");
  const diff = Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function corPrazo(dias: number | null): string {
  if (dias == null) return "text-muted-foreground";
  if (dias < 0) return "text-destructive font-semibold";
  if (dias <= 3) return "text-amber-600 font-semibold";
  return "text-emerald-700";
}

export function KanbanProducao({ reloadKey }: { reloadKey?: number }) {
  const { selectedLojaId } = useLoja();
  const { can, isAdmin } = usePermissions();
  const podeEditar = isAdmin || can("fabrica_lotes", "edit");

  const [etapas, setEtapas] = useState<EtapaFabrica[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const es = await carregarEtapasFabrica(selectedLojaId);
      setEtapas(es);

      // lotes ativos da loja
      let lotesQ = (supabase as any)
        .from("lotes_producao")
        .select("id, numero_lote, loja_id")
        .in("status_lote", ["em_producao", "rascunho"]);
      if (selectedLojaId) lotesQ = lotesQ.eq("loja_id", selectedLojaId);
      const { data: lotes } = await lotesQ;
      const loteIds = (lotes || []).map((l: any) => l.id);
      const loteMap = new Map<string, string>((lotes || []).map((l: any) => [l.id, l.numero_lote]));

      if (loteIds.length === 0) {
        setCards([]);
        return;
      }

      const { data: lpData } = await (supabase as any)
        .from("lote_pedidos")
        .select("id, lote_id, pedido_id, etapa_atual, pedido:pedidos(codigo, data_limite_entrega, cliente:clientes(nome))")
        .in("lote_id", loteIds);

      setCards(
        (lpData || []).map((r: any) => ({
          lote_pedido_id: r.id,
          pedido_id: r.pedido_id,
          lote_id: r.lote_id,
          numero_lote: loteMap.get(r.lote_id) || "—",
          codigo: r.pedido?.codigo ?? null,
          cliente_nome: r.pedido?.cliente?.nome ?? null,
          data_limite_entrega: r.pedido?.data_limite_entrega ?? null,
          etapa_atual: r.etapa_atual || "corte",
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("fabrica-kanban-producao")
      .on("postgres_changes", { event: "*", schema: "public", table: "lote_pedidos" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "lotes_producao" }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedLojaId, reloadKey]);

  const grupos = useMemo(() => {
    const m = new Map<string, Card[]>();
    etapas.forEach((e) => m.set(e.chave, []));
    cards.forEach((c) => {
      if (!m.has(c.etapa_atual)) m.set(c.etapa_atual, []);
      m.get(c.etapa_atual)!.push(c);
    });
    return m;
  }, [etapas, cards]);

  async function handleDrop(etapaNova: string) {
    if (!dragId) return;
    const card = cards.find((c) => c.lote_pedido_id === dragId);
    setDragId(null);
    if (!card || card.etapa_atual === etapaNova) return;
    if (!podeEditar) {
      toast.error("Você não tem permissão para mover cards.");
      return;
    }
    try {
      await moverPedidoEtapa({
        lotePedidoId: card.lote_pedido_id,
        pedidoId: card.pedido_id,
        loteId: card.lote_id,
        etapaAnterior: card.etapa_atual,
        etapaNova,
      });
      toast.success(`${card.codigo} → ${etapas.find((e) => e.chave === etapaNova)?.nome || etapaNova}`);
      carregar();
    } catch (e: any) {
      toast.error("Erro: " + (e.message || ""));
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando produção…
      </div>
    );
  }

  if (etapas.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Nenhuma etapa configurada para a fábrica.
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {etapas.map((etapa) => {
          const lista = grupos.get(etapa.chave) || [];
          return (
            <div
              key={etapa.id}
              className="w-[280px] shrink-0"
              onDragOver={(e) => { if (podeEditar) e.preventDefault(); }}
              onDrop={() => handleDrop(etapa.chave)}
            >
              <div
                className="rounded-t-lg px-3 py-2 border-t-[3px]"
                style={{ borderTopColor: etapa.cor_hex || "#8b7355", backgroundColor: (etapa.cor_hex || "#8b7355") + "15" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[12px] font-semibold uppercase" style={{ color: etapa.cor_hex || "#8b7355" }}>
                    {etapa.nome}
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-background text-foreground">
                    {lista.length}
                  </span>
                </div>
              </div>
              <div className="bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[200px]">
                {lista.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground text-center py-4">Vazio</div>
                ) : (
                  lista.map((c) => {
                    const dias = diasUteisAte(c.data_limite_entrega);
                    return (
                      <Card
                        key={c.lote_pedido_id}
                        draggable={podeEditar}
                        onDragStart={() => setDragId(c.lote_pedido_id)}
                        onDragEnd={() => setDragId(null)}
                        className="border-l-4 p-3 space-y-2 hover:shadow-md transition-shadow cursor-move"
                        style={{ borderLeftColor: etapa.cor_hex || "#8b7355" }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[12px] font-bold text-primary">{c.codigo || "—"}</div>
                            <div className="text-[12px] font-medium truncate max-w-[200px]">{c.cliente_nome || "—"}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{c.numero_lote}</Badge>
                        </div>
                        <div className="grid gap-0.5 text-[10px]">
                          <span className={corPrazo(dias)}>
                            {dias != null && dias < 0 && <AlertCircle className="w-3 h-3 inline mr-0.5" />}
                            Prazo: {fmt(c.data_limite_entrega)}
                            {dias != null && (dias < 0 ? ` (${-dias}d atraso)` : ` (${dias}d)`)}
                          </span>
                        </div>
                        <Button asChild size="sm" variant="outline" className="w-full h-7 text-[11px]">
                          <Link to={`/pedidos/${c.pedido_id}`}>
                            <Eye className="w-3 h-3 mr-1" /> Ver pedido
                          </Link>
                        </Button>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!podeEditar && (
        <p className="text-[11px] text-muted-foreground mt-2 italic flex items-center gap-1">
          <ArrowRight className="w-3 h-3" /> Visualização somente leitura — você não tem permissão para mover cards.
        </p>
      )}
    </div>
  );
}
