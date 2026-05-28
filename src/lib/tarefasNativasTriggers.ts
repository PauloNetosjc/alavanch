import { supabase } from "@/integrations/supabase/client";

/**
 * Gatilhos suportados pelo Motor de Tarefas Nativas do Pedido.
 * Mantenha alinhado com tarefas_nativas_modelos.gatilho.
 */
export type TarefaNativaGatilho =
  | "pedido_criado"
  | "pedido_assinado"
  | "contrato_criado"
  | "medicao_tecnica_agendada"
  | "medicao_tecnica_concluida"
  | "revisao_final_agendada"
  | "revisao_final_concluida"
  | "revisao_projeto_concluida"
  | "pdf_projeto_final_assinado"
  | "implantacao_fabrica_concluida"
  | "entrega_agendada"
  | "entrega_concluida"
  | "montagem_agendada"
  | "montagem_concluida"
  | "assistencia_aberta"
  | "assistencia_agendada"
  | "assistencia_pedido_peca"
  | "assistencia_concluida"
  | "tarefa_anterior_concluida"
  | "pedido_concluido";

export interface DispararTarefasContexto {
  pedido_id: string;
  cliente_id?: string | null;
  origem?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Dispara a criação automática de tarefas nativas para um pedido.
 *
 * - Idempotente: a função SQL `fn_instanciar_tarefas_nativas` evita duplicar
 *   tarefas para o mesmo (pedido_id, modelo_id).
 * - Tolerante a falhas: nunca lança exceção; apenas loga e retorna 0
 *   para não quebrar o fluxo principal (assinatura, agendamento, kanban).
 *
 * Observação: a maior parte dos gatilhos imediatos é disparada por
 * triggers SQL (solicitacoes_assinatura, agenda_eventos). Este helper
 * existe para pontos onde o fluxo é controlado no frontend ou para
 * gatilhos sem evento SQL claro (ex.: revisao_projeto_concluida).
 */
export async function dispararTarefasNativas(
  gatilho: TarefaNativaGatilho,
  ctx: DispararTarefasContexto
): Promise<number> {
  try {
    if (!ctx?.pedido_id) {
      if (import.meta.env.DEV) {
        console.warn("[tarefasNativas] pedido_id ausente", { gatilho, ctx });
      }
      return 0;
    }

    const { data, error } = await (supabase as any).rpc(
      "fn_instanciar_tarefas_nativas",
      { p_pedido_id: ctx.pedido_id, p_gatilho: gatilho }
    );

    if (error) {
      console.error("[tarefasNativas] RPC erro", gatilho, error);
      return 0;
    }

    const criadas = typeof data === "number" ? data : 0;
    if (import.meta.env.DEV) {
      console.info("[tarefasNativas]", gatilho, "criadas:", criadas, ctx);
    }
    return criadas;
  } catch (e) {
    console.error("[tarefasNativas] exceção", gatilho, e);
    return 0;
  }
}
