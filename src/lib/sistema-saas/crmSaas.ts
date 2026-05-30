import { supabase } from "@/integrations/supabase/client";

export const ETAPAS_CRM = [
  { value: "lead_novo", label: "Lead novo", className: "bg-zinc-100 text-zinc-800" },
  { value: "qualificacao", label: "Qualificação", className: "bg-blue-100 text-blue-800" },
  { value: "apresentacao_agendada", label: "Apresentação agendada", className: "bg-indigo-100 text-indigo-800" },
  { value: "proposta_enviada", label: "Proposta enviada", className: "bg-violet-100 text-violet-800" },
  { value: "negociacao", label: "Negociação", className: "bg-amber-100 text-amber-800" },
  { value: "fechamento_ganho", label: "Fechamento ganho", className: "bg-emerald-100 text-emerald-800" },
  { value: "fechamento_perdido", label: "Fechamento perdido", className: "bg-red-100 text-red-800" },
  { value: "convertido_em_base", label: "Convertido em base", className: "bg-teal-100 text-teal-800" },
] as const;

export type EtapaCrm = typeof ETAPAS_CRM[number]["value"];

export const STATUS_CRM = [
  { value: "aberto", label: "Aberto" },
  { value: "ganho", label: "Ganho" },
  { value: "perdido", label: "Perdido" },
  { value: "convertido", label: "Convertido" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export const ORIGENS_CRM = [
  "indicação", "tráfego pago", "outbound", "inbound",
  "parceiro", "evento", "orgânico", "outro",
] as const;

export const TIPOS_EVENTO = [
  { value: "reuniao", label: "Reunião" },
  { value: "apresentacao", label: "Apresentação" },
  { value: "follow_up", label: "Follow-up" },
  { value: "fechamento", label: "Fechamento" },
  { value: "implantacao", label: "Implantação" },
  { value: "treinamento", label: "Treinamento" },
  { value: "suporte", label: "Suporte" },
  { value: "outro", label: "Outro" },
] as const;

export const STATUS_EVENTO = [
  { value: "agendado", label: "Agendado", className: "bg-blue-100 text-blue-800" },
  { value: "realizado", label: "Realizado", className: "bg-emerald-100 text-emerald-800" },
  { value: "cancelado", label: "Cancelado", className: "bg-red-100 text-red-800" },
  { value: "remarcado", label: "Remarcado", className: "bg-amber-100 text-amber-800" },
  { value: "pendente", label: "Pendente", className: "bg-zinc-100 text-zinc-700" },
] as const;

export const etapaLabel = (v: string) => ETAPAS_CRM.find(e => e.value === v)?.label ?? v;
export const etapaClass = (v: string) => ETAPAS_CRM.find(e => e.value === v)?.className ?? "bg-zinc-100 text-zinc-700";
export const eventoStatusClass = (v: string) => STATUS_EVENTO.find(s => s.value === v)?.className ?? "bg-zinc-100 text-zinc-700";

export type Oportunidade = {
  id: string;
  nome_empresa: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  responsavel_nome: string | null;
  email: string | null;
  telefone: string | null;
  origem: string | null;
  sistema_saas_id: string | null;
  plano_interesse: string | null;
  valor_implantacao_proposto: number | null;
  valor_mensal_proposto: number | null;
  lojas_previstas: number | null;
  usuarios_previstos: number | null;
  armazenamento_previsto_gb: number | null;
  status: string;
  etapa: string;
  probabilidade: number | null;
  data_prevista_fechamento: string | null;
  data_fechamento: string | null;
  motivo_perda: string | null;
  observacoes: string | null;
  base_cliente_id: string | null;
  created_at: string;
  updated_at: string;
};

export type EventoAgenda = {
  id: string;
  oportunidade_id: string | null;
  base_cliente_id: string | null;
  titulo: string;
  tipo: string;
  data_inicio: string;
  data_fim: string | null;
  status: string;
  responsavel_id: string | null;
  participantes: string | null;
  link_reuniao: string | null;
  local: string | null;
  observacoes: string | null;
  created_at: string;
};

export async function registrarHistoricoCrm(input: {
  oportunidade_id: string;
  tipo_evento: string;
  descricao?: string | null;
  etapa_anterior?: string | null;
  etapa_nova?: string | null;
  dados_anteriores?: Record<string, unknown> | null;
  dados_novos?: Record<string, unknown> | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("saas_crm_historico" as any).insert({
    oportunidade_id: input.oportunidade_id,
    tipo_evento: input.tipo_evento,
    descricao: input.descricao ?? null,
    etapa_anterior: input.etapa_anterior ?? null,
    etapa_nova: input.etapa_nova ?? null,
    dados_anteriores: input.dados_anteriores ?? null,
    dados_novos: input.dados_novos ?? null,
    criado_por: u.user?.id ?? null,
  });
}

export const fmtBRL = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
