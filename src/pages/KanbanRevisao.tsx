import KanbanBoard from "@/components/kanban/KanbanBoard";
import { ClipboardCheck } from "lucide-react";
export default function KanbanRevisao() {
  return <KanbanBoard pipeline="revisao" stageColumn="estagio_revisao_id" title="Revisão de Projeto" subtitle="Análise, conferência e assinatura do PDF final" icon={ClipboardCheck} iconVariant="blue" />;
}
