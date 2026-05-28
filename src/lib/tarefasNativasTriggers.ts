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
  | "upload_projeto_revisado"
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

/**
 * Garante as tarefas obrigatórias do cronograma do pedido:
 *  - "Fazer medição técnica" (chave técnica: fazer_medicao_tecnica) quando
 *    existir Medição Técnica agendada na agenda do pedido.
 *  - "Preparo projeto revisão" (chave técnica: preparo_projeto_revisao)
 *    quando existir Revisão (tipo revisao_final) agendada.
 *
 * Idempotente: a RPC SQL `ensure_tarefas_cronograma_pedido` evita duplicar
 * tarefa ativa (pendente/em_andamento/atrasada) e recalcula os prazos com
 * base nas datas reais agendadas — medição = data da medição;
 * preparo projeto revisão = 1 dia útil antes da data da revisão.
 *
 * Tolerante a falhas: nunca lança exceção. Chame após
 * salvar/agendar Medição ou Revisão, ao salvar o pedido, e como fallback
 * no carregamento do painel de tarefas do pedido.
 */
export async function ensureTarefasCronogramaPedido(
  pedido_id: string
): Promise<void> {
  try {
    if (!pedido_id) return;
    const { error } = await (supabase as any).rpc(
      "ensure_tarefas_cronograma_pedido",
      { p_pedido_id: pedido_id }
    );
    if (error) {
      console.error("[ensureTarefasCronograma] RPC erro", error);
    }
  } catch (e) {
    console.error("[ensureTarefasCronograma] exceção", e);
  }
}

/**
 * Garante o fluxo Revisão Loja → Preparo e envio de PDF Projeto Final.
 *
 * Chama a RPC SQL `ensure_fluxo_revisao_e_pdf_final` que:
 *  - Cria/garante a tarefa "Revisão loja" (chave: revisao_loja) com prazo
 *    de 7 dias úteis após a data da Revisão Final agendada (ou após hoje,
 *    como fallback) — nunca deixa a tarefa sem prazo.
 *  - Conclui a "Revisão loja" automaticamente quando houver upload em
 *    Arquivos do Projeto > Projeto Revisado SEM revisão de valores
 *    pendente, ou quando a revisão de valores for aprovada.
 *  - Dispara a criação da tarefa "Preparo e envio de PDF Projeto Final"
 *    (chave: preparo_envio_pdf_projeto_final) com prazo de 7 dias úteis.
 *
 * Idempotente e tolerante a falhas. Chame após uploads em Projeto para
 * Revisão / Projeto Revisado, após aprovação de revisão de valores, e
 * como fallback no carregamento do painel de tarefas do pedido.
 */
export async function ensureFluxoRevisaoEPdfFinal(
  pedido_id: string
): Promise<void> {
  try {
    if (!pedido_id) return;
    const { error } = await (supabase as any).rpc(
      "ensure_fluxo_revisao_e_pdf_final",
      { p_pedido_id: pedido_id }
    );
    if (error) {
      console.error("[ensureFluxoRevisao] RPC erro", error);
    }
  } catch (e) {
    console.error("[ensureFluxoRevisao] exceção", e);
  }
}

/**
 * Garante o fluxo: PDF Projeto Final assinado + arquivo de Projeto para
 * Produção enviado. Só com as DUAS condições a tarefa
 * "Preparo e envio de PDF Projeto Final" é concluída, o pedido é liberado
 * para a Fábrica (status_fabrica = 'liberado_para_lote') e a tarefa
 * "Implantação Fábrica" é criada.
 *
 * Idempotente. Chame após:
 *  - upload em Arquivos do Projeto > Projeto para Produção
 *  - upload/assinatura do PDF Projeto Final na Central de Documentos
 *  - como fallback no carregamento do painel de tarefas do pedido
 */
export async function ensureFluxoProjetoFinalProducaoEFabrica(
  pedido_id: string
): Promise<void> {
  try {
    if (!pedido_id) return;
    const { error } = await (supabase as any).rpc(
      "ensure_fluxo_projeto_final_producao_e_fabrica",
      { p_pedido_id: pedido_id }
    );
    if (error) {
      console.error("[ensureFluxoProjetoFinalProducao] RPC erro", error);
    }
  } catch (e) {
    console.error("[ensureFluxoProjetoFinalProducao] exceção", e);
  }
}


