import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, X } from "lucide-react";
import { concluirLote, cancelarLote } from "@/lib/lotesProducao";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

type LoteRow = {
  id: string;
  numero_lote: string;
  descricao: string | null;
  status_lote: string;
  data_criacao: string;
  data_previsao_conclusao: string | null;
  qtd_pedidos: number;
};

function fmt(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-slate-100 text-slate-700",
  em_producao: "bg-violet-100 text-violet-700",
  concluido: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-red-100 text-red-700",
};

export function LotesAtivos({ reloadKey, onChanged }: { reloadKey?: number; onChanged?: () => void }) {
  const { selectedLojaId } = useLoja();
  const { can, isAdmin } = usePermissions();
  const podeEditar = isAdmin || can("fabrica_lotes", "edit");
  const [loading, setLoading] = useState(true);
  const [lotes, setLotes] = useState<LoteRow[]>([]);

  async function carregar() {
    setLoading(true);
    let q = (supabase as any)
      .from("lotes_producao")
      .select("id, numero_lote, descricao, status_lote, data_criacao, data_previsao_conclusao, lote_pedidos(count)")
      .order("created_at", { ascending: false });
    if (selectedLojaId) q = q.eq("loja_id", selectedLojaId);
    const { data, error } = await q;
    if (error) {
      console.error(error);
      setLotes([]);
    } else {
      setLotes(
        (data || []).map((l: any) => ({
          id: l.id,
          numero_lote: l.numero_lote,
          descricao: l.descricao,
          status_lote: l.status_lote,
          data_criacao: l.data_criacao,
          data_previsao_conclusao: l.data_previsao_conclusao,
          qtd_pedidos: Array.isArray(l.lote_pedidos) ? (l.lote_pedidos[0]?.count ?? 0) : 0,
        }))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("fabrica-lotes-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "lotes_producao" }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedLojaId, reloadKey]);

  async function handleConcluir(id: string, numero: string) {
    if (!confirm(`Concluir lote ${numero}?`)) return;
    try {
      await concluirLote(id);
      toast.success(`Lote ${numero} concluído.`);
      onChanged?.();
      carregar();
    } catch (e: any) {
      toast.error("Erro: " + (e.message || ""));
    }
  }

  async function handleCancelar(id: string, numero: string) {
    if (!confirm(`Cancelar lote ${numero}? Os pedidos voltarão para liberados.`)) return;
    try {
      // primeiro reverte status_fabrica dos pedidos do lote
      const { data: pedidosLote } = await (supabase as any)
        .from("lote_pedidos").select("pedido_id").eq("lote_id", id);
      const pedidoIds = (pedidosLote || []).map((p: any) => p.pedido_id);
      if (pedidoIds.length > 0) {
        await (supabase as any)
          .from("pedidos")
          .update({ status_fabrica: "liberado_para_lote" })
          .in("id", pedidoIds);
      }
      await cancelarLote(id);
      toast.success(`Lote ${numero} cancelado.`);
      onChanged?.();
      carregar();
    } catch (e: any) {
      toast.error("Erro: " + (e.message || ""));
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Nenhum lote criado ainda. Use o botão "Criar Lote" para começar.
      </Card>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2">Número</th>
            <th className="text-left px-3 py-2">Descrição</th>
            <th className="text-left px-3 py-2">Pedidos</th>
            <th className="text-left px-3 py-2">Criação</th>
            <th className="text-left px-3 py-2">Previsão</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-right px-3 py-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {lotes.map((l) => (
            <tr key={l.id} className="border-t hover:bg-muted/20">
              <td className="px-3 py-2 font-mono font-medium">{l.numero_lote}</td>
              <td className="px-3 py-2">{l.descricao || "—"}</td>
              <td className="px-3 py-2">{l.qtd_pedidos}</td>
              <td className="px-3 py-2">{fmt(l.data_criacao)}</td>
              <td className="px-3 py-2">{fmt(l.data_previsao_conclusao)}</td>
              <td className="px-3 py-2">
                <Badge className={STATUS_COLORS[l.status_lote] || ""}>{l.status_lote.replace("_", " ")}</Badge>
              </td>
              <td className="px-3 py-2 text-right">
                {podeEditar && (l.status_lote === "em_producao" || l.status_lote === "rascunho") && (
                  <div className="inline-flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleConcluir(l.id, l.numero_lote)}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Concluir
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleCancelar(l.id, l.numero_lote)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
