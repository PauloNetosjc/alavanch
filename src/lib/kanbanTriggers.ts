import { supabase } from "@/integrations/supabase/client";

/**
 * Gatilhos disponíveis para criação automática de card em um estágio.
 * Configurados em `pipeline_estagios.criar_card_em` e `crm_estagios.criar_card_em`.
 */
export const KANBAN_TRIGGERS = [
  { value: "orcamento_criado", label: "Quando um orçamento é criado" },
  { value: "negociacao_criada", label: "Quando uma negociação é criada" },
  { value: "contrato_criado", label: "Quando um contrato é gerado" },
  { value: "revisao_concluida", label: "Quando a revisão de projeto é concluída" },
  { value: "entrega_agendada", label: "Quando uma entrega é agendada" },
  { value: "montagem_agendada", label: "Quando a montagem é agendada" },
  { value: "assistencia_aberta", label: "Quando uma nova assistência é aberta" },
] as const;

export type KanbanTrigger = (typeof KANBAN_TRIGGERS)[number]["value"];

export type TriggerContext = {
  pedidoId?: string | null;
  orcamentoId?: string | null;
  responsavelId?: string | null;
};

/**
 * Cria/posiciona automaticamente um card nos estágios configurados com o gatilho.
 * - Estágios de pipeline operacional (pipeline_estagios): insere em `kanban_cards` (precisa de pedidoId).
 * - Estágios do CRM Comercial (crm_estagios): atualiza `orcamentos.estagio_id` (precisa de orcamentoId).
 * Evita duplicidade.
 */
export async function dispatchKanbanTrigger(
  trigger: KanbanTrigger,
  ctx: TriggerContext
): Promise<void> {
  try {
    const [{ data: ests1 }, { data: ests2 }] = await Promise.all([
      (supabase as any)
        .from("pipeline_estagios")
        .select("id,pipeline,sla_dias_uteis,criar_card_em,ativo")
        .eq("ativo", true)
        .contains("criar_card_em", [trigger]),
      (supabase as any)
        .from("crm_estagios")
        .select("id,sla_dias_uteis,criar_card_em,ativo")
        .eq("ativo", true)
        .contains("criar_card_em", [trigger]),
    ]);

    // 1) Pipelines operacionais → kanban_cards (precisa pedidoId)
    if (ctx.pedidoId) {
      for (const e of ((ests1 ?? []) as any[])) {
        const { data: existente } = await (supabase as any)
          .from("kanban_cards")
          .select("id")
          .eq("pipeline", e.pipeline)
          .eq("pedido_id", ctx.pedidoId)
          .limit(1)
          .maybeSingle();
        if (existente) continue;

        const { error } = await (supabase as any).from("kanban_cards").insert({
          pipeline: e.pipeline,
          estagio_id: e.id,
          pedido_id: ctx.pedidoId,
          responsavel_id: ctx.responsavelId ?? null,
          sla_dias_uteis: e.sla_dias_uteis ?? null,
        });
        if (error) {
          console.error("dispatchKanbanTrigger kanban_cards insert", error);
          continue;
        }
        await logTrigger(trigger, "pedido", ctx.pedidoId, { pipeline: e.pipeline, estagio_id: e.id });
      }
    }

    // 2) CRM Comercial → orcamentos.estagio_id (precisa orcamentoId)
    if (ctx.orcamentoId && (ests2 ?? []).length > 0) {
      // Usa o primeiro estágio configurado com o gatilho
      const alvo = (ests2 as any[])[0];
      const { error } = await (supabase as any)
        .from("orcamentos")
        .update({ estagio_id: alvo.id })
        .eq("id", ctx.orcamentoId);
      if (error) {
        console.error("dispatchKanbanTrigger orcamentos.estagio_id update", error);
      } else {
        await logTrigger(trigger, "orcamento", ctx.orcamentoId, { estagio_id: alvo.id });
      }
    }
  } catch (e) {
    console.error("dispatchKanbanTrigger failed", e);
  }
}

async function logTrigger(
  trigger: KanbanTrigger,
  entidade_tipo: string,
  entidade_id: string,
  metadata: Record<string, any>
) {
  try {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("timeline_eventos").insert({
      entidade_tipo,
      entidade_id,
      tipo: "card_criado_auto",
      descricao: `Card criado automaticamente (gatilho: ${trigger})`,
      usuario_id: u.user?.id ?? null,
      metadata: { trigger, ...metadata },
    });
  } catch (e) {
    console.warn("timeline_eventos log failed", e);
  }
}
