import { Briefcase, Workflow, Wallet, ClipboardCheck, Hammer, Building2, type LucideIcon } from "lucide-react";

export type KanbanKey = "comercial" | "pos_venda" | "revisao" | "montagem" | "fabrica";

export type KanbanDef = {
  key: KanbanKey;
  label: string;
  icon: LucideIcon;
  variant: "purple" | "blue" | "green" | "amber" | "rose";
  /** Pipeline value in pipeline_estagios (omit for comercial which uses crm_estagios) */
  pipeline?: string;
  subtitle?: string;
  route: string;
  /** Show stage action popup on card click (instead of navigating to pedido) */
  stageDialog?: boolean;
};

export const KANBANS: KanbanDef[] = [
  { key: "comercial",   label: "CRM Comercial",          icon: Briefcase,      variant: "purple", route: "/kanban-comercial",   subtitle: "Funil de orçamentos por estágio" },
  { key: "pos_venda",   label: "Pós-Venda e Financeiro", icon: Wallet,         variant: "green",  route: "/kanban-pos-venda",   pipeline: "pos_venda",   subtitle: "Contratos, boletos e envios", stageDialog: true },
  { key: "revisao",     label: "Revisão de Projeto",     icon: ClipboardCheck, variant: "blue",   route: "/kanban-revisao",     pipeline: "revisao",     subtitle: "Análise, conferência e assinatura do PDF final", stageDialog: true },
  { key: "montagem",    label: "Montagem",               icon: Hammer,         variant: "amber",  route: "/kanban-montagem",    pipeline: "montagem",    subtitle: "Entregas, montagens agendadas e vistorias", stageDialog: true },
  { key: "fabrica",     label: "Fábrica",                icon: Building2,      variant: "purple", route: "/kanban-fabrica",     pipeline: "fabrica",     subtitle: "Produção, lotes e expedição", stageDialog: true },
];

export const findKanban = (key: KanbanKey) => KANBANS.find((k) => k.key === key)!;
