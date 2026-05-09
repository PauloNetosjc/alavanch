import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ConcluirAcao = "proxima" | "outro_kanban" | "remover" | "desativado";

export type StageConcluirConfig = {
  id: string;
  nome: string;
  ordem?: number;
  concluir_acao: ConcluirAcao | null;
  concluir_pipeline_destino: string | null;
  concluir_estagio_destino_id: string | null;
};

export type StageBasic = { id: string; nome: string; ordem?: number };

const isConcluidos = (nome: string) =>
  (nome || "").trim().toLowerCase().replace(/í/g, "i") === "concluidos";

async function logEvento(pedidoId: string | null, tipo: string, descricao: string, metadata: Record<string, any>) {
  if (!pedidoId) return;
  try {
    const { data: u } = await supabase.auth.getUser();
    await (supabase as any).from("timeline_eventos").insert({
      entidade_tipo: "pedido", entidade_id: pedidoId, tipo, descricao,
      usuario_id: u.user?.id ?? null, metadata,
    });
  } catch (e) { console.error(e); }
}

export async function executarConcluirAction(params: {
  cardId: string;
  pedidoId: string | null;
  pipeline: string;
  estagioAtual: StageConcluirConfig;
  estagiosPipeline: StageBasic[];
}): Promise<boolean> {
  const { cardId, pedidoId, pipeline, estagioAtual, estagiosPipeline } = params;
  const acao: ConcluirAcao = (estagioAtual.concluir_acao ?? "proxima") as ConcluirAcao;

  if (acao === "desativado") {
    toast.info("Ação de concluir não configurada para este estágio. Configure em Editar estágios.");
    return false;
  }

  try {
    if (acao === "remover") {
      const { error } = await (supabase as any).from("kanban_cards").delete().eq("id", cardId);
      if (error) throw error;
      await logEvento(pedidoId, "kanban_removido",
        `[${pipeline}] Card removido do kanban (pedido preservado)`,
        { pipeline, card_id: cardId, origem: "concluir_config" });
      toast.success("Card removido do kanban");
      return true;
    }

    if (acao === "proxima") {
      const sorted = [...estagiosPipeline]
        .filter((s) => !isConcluidos(s.nome))
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      const idx = sorted.findIndex((s) => s.id === estagioAtual.id);
      const prox = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
      if (!prox) {
        toast.info("Não há próxima etapa neste kanban.");
        return false;
      }
      const { error } = await (supabase as any).from("kanban_cards")
        .update({ estagio_id: prox.id, iniciado_em: new Date().toISOString(), notificacao_atraso_em: null })
        .eq("id", cardId);
      if (error) throw error;
      await logEvento(pedidoId, "kanban_movimento",
        `[${pipeline}] ${estagioAtual.nome} → ${prox.nome} (concluir)`,
        { pipeline, de: estagioAtual.nome, para: prox.nome, card_id: cardId, origem: "concluir_config" });
      toast.success(`Card movido para "${prox.nome}"`);
      return true;
    }

    if (acao === "outro_kanban") {
      const destPipeline = estagioAtual.concluir_pipeline_destino;
      const destEstagioId = estagioAtual.concluir_estagio_destino_id;
      if (!destPipeline || !destEstagioId) {
        toast.error("Destino não configurado para esta etapa. Ajuste em Editar estágios.");
        return false;
      }
      if (!pedidoId) throw new Error("Card sem pedido vinculado");
      const { data: existente } = await (supabase as any).from("kanban_cards")
        .select("id").eq("pipeline", destPipeline).eq("pedido_id", pedidoId).maybeSingle();
      if (existente?.id) {
        const { error } = await (supabase as any).from("kanban_cards")
          .update({ estagio_id: destEstagioId, iniciado_em: new Date().toISOString(), notificacao_atraso_em: null })
          .eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("kanban_cards").insert({
          pipeline: destPipeline, pedido_id: pedidoId, estagio_id: destEstagioId,
          iniciado_em: new Date().toISOString(),
        });
        if (error) throw error;
      }
      await (supabase as any).from("kanban_cards").delete().eq("id", cardId);
      await logEvento(pedidoId, "kanban_transferido",
        `[${pipeline}] → [${destPipeline}] (concluir configurado)`,
        { de_pipeline: pipeline, para_pipeline: destPipeline, para_estagio_id: destEstagioId, card_id: cardId, origem: "concluir_config" });
      toast.success("Card enviado para outro kanban");
      return true;
    }
  } catch (e: any) {
    toast.error(e?.message || "Erro ao executar ação de concluir");
    return false;
  }
  return false;
}

export const ACOES_LABEL: Record<ConcluirAcao, string> = {
  proxima: "Mover para próxima etapa",
  outro_kanban: "Enviar para outro kanban",
  remover: "Remover do kanban",
  desativado: "Desativado (sem ação)",
};
