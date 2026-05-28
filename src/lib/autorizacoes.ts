import { supabase } from "@/integrations/supabase/client";

export type AutCategoria = "revisao" | "agenda" | "desconto" | "outro";
export type AutStatus = "pendente" | "aprovada" | "rejeitada" | "expirada" | "cancelada";

export const CATEGORIA_LABEL: Record<AutCategoria, string> = {
  revisao: "Revisões",
  agenda: "Agenda",
  desconto: "Descontos",
  outro: "Outros",
};

export const TIPO_LABEL: Record<string, string> = {
  desconto_acima_limite: "Desconto acima do limite",
  agenda_fora_horario: "Agenda fora do horário",
  agenda_fora_dia: "Agenda em dia não permitido",
  agenda_dia_nao_permitido: "Agenda em dia não permitido",
  agenda_lead_time: "Lead time abaixo do mínimo",
  lead_time_abaixo_minimo: "Lead time abaixo do mínimo",
  revisao_sem_diferenca_aguardando_aprovacao: "Revisão sem diferença — aguardando aprovação",
  revisao_com_diferenca_positiva: "Revisão com diferença para mais",
  revisao_com_diferenca_negativa: "Revisão com diferença para menos",
  revisao_adendo_pendente: "Revisão com adendo pendente",
  outro: "Outro",
};

interface SolicitarParams {
  categoria: AutCategoria;
  tipo: string;
  titulo: string;
  descricao?: string;
  dados_contexto?: Record<string, any>;
  motivo_solicitacao?: string;
  origem_modulo: string;
  origem_id: string;
  loja_id?: string | null;
  pedido_id?: string | null;
  orcamento_id?: string | null;
  agenda_evento_id?: string | null;
  cliente_id?: string | null;
  valor_solicitado?: number | null;
  limite_padrao?: number | null;
  prioridade?: "baixa" | "media" | "alta" | null;
}

/**
 * Cria (ou atualiza, se já existir pendente para mesma origem) uma solicitação
 * na Central de Autorizações. Evita duplicidade via origem_modulo + origem_id.
 */
export async function solicitarAutorizacao(p: SolicitarParams) {
  const { data: u } = await supabase.auth.getUser();
  const userId = u?.user?.id || null;
  const email = u?.user?.email || null;

  // Procura uma pendente já existente para a mesma origem.
  const { data: existente } = await supabase
    .from("autorizacoes" as any)
    .select("id")
    .eq("origem_modulo", p.origem_modulo)
    .eq("origem_id", p.origem_id)
    .eq("status", "pendente")
    .maybeSingle();

  const payload: any = {
    categoria: p.categoria,
    tipo: p.tipo,
    titulo: p.titulo,
    descricao: p.descricao || null,
    contexto: p.dados_contexto || {},
    motivo_solicitacao: p.motivo_solicitacao || null,
    origem_modulo: p.origem_modulo,
    origem_id: p.origem_id,
    loja_id: p.loja_id || null,
    pedido_id: p.pedido_id || null,
    orcamento_id: p.orcamento_id || null,
    agenda_evento_id: p.agenda_evento_id || null,
    cliente_id: p.cliente_id || null,
    valor_solicitado: p.valor_solicitado ?? null,
    limite_padrao: p.limite_padrao ?? null,
    prioridade: p.prioridade || null,
    status: "pendente",
    solicitante_id: userId,
    solicitante_email: email,
  };

  if (existente?.id) {
    const { error } = await supabase
      .from("autorizacoes" as any)
      .update(payload)
      .eq("id", (existente as any).id);
    if (error) throw error;
    return (existente as any).id as string;
  }

  const { data: criado, error } = await supabase
    .from("autorizacoes" as any)
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return (criado as any).id as string;
}

/** Atualiza autorização correspondente para "aprovada" (sem disparar fluxo reverso de novo). */
export async function marcarAutorizacaoAprovadaPorOrigem(origem_modulo: string, origem_id: string, observacao?: string) {
  const { data: u } = await supabase.auth.getUser();
  await supabase
    .from("autorizacoes" as any)
    .update({
      status: "aprovada",
      aprovador_id: u?.user?.id || null,
      aprovador_email: u?.user?.email || null,
      decidido_em: new Date().toISOString(),
      decisao_observacao: observacao || null,
    })
    .eq("origem_modulo", origem_modulo)
    .eq("origem_id", origem_id)
    .eq("status", "pendente");
}
