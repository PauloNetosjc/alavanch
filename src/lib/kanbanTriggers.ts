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

/**
 * Cria automaticamente um card nos estágios (pipeline_estagios ou crm_estagios)
 * que tenham o gatilho `trigger` marcado em `criar_card_em`.
 *
 * Evita duplicidade: se já existir um card do mesmo pedido no mesmo pipeline,
 * a inserção é ignorada.
 */
export async function dispatchKanbanTrigger(
  trigger: KanbanTrigger,
  ctx: { pedidoId: string; responsavelId?: string | null }
): Promise<void> {
  if (!ctx.pedidoId) return;
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

    const alvos: { estagio_id: string; pipeline: string; sla: number | null }[] = [
      ...((ests1 ?? []) as any[]).map((e) => ({
        estagio_id: e.id,
        pipeline: e.pipeline,
        sla: e.sla_dias_uteis ?? null,
      })),
      ...((ests2 ?? []) as any[]).map((e) => ({
        estagio_id: e.id,
        pipeline: "comercial",
        sla: e.sla_dias_uteis ?? null,
      })),
    ];

    if (alvos.length === 0) return;

    for (const alvo of alvos) {
      // dedupe: já existe card para este pedido neste pipeline?
      const { data: existente } = await (supabase as any)
        .from("kanban_cards")
        .select("id")
        .eq("pipeline", alvo.pipeline)
        .eq("pedido_id", ctx.pedidoId)
        .limit(1)
        .maybeSingle();
      if (existente) continue;

      const { error } = await (supabase as any).from("kanban_cards").insert({
        pipeline: alvo.pipeline,
        estagio_id: alvo.estagio_id,
        pedido_id: ctx.pedidoId,
        responsavel_id: ctx.responsavelId ?? null,
        sla_dias_uteis: alvo.sla,
      });
      if (error) {
        console.error("dispatchKanbanTrigger insert kanban_cards error", error);
        continue;
      }

      try {
        const { data: u } = await supabase.auth.getUser();
        await supabase.from("timeline_eventos").insert({
          entidade_tipo: "pedido",
          entidade_id: ctx.pedidoId,
          tipo: "card_criado_auto",
          descricao: `Card criado automaticamente (gatilho: ${trigger})`,
          usuario_id: u.user?.id ?? null,
          metadata: { trigger, pipeline: alvo.pipeline, estagio_id: alvo.estagio_id },
        });
      } catch (e) {
        console.warn("timeline_eventos log failed", e);
      }
    }
  } catch (e) {
    console.error("dispatchKanbanTrigger failed", e);
  }
}
