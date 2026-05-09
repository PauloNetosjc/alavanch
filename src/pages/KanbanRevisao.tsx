import KanbanBoard from "@/components/kanban/KanbanBoard";
import { findKanban } from "@/components/kanban/kanbanRegistry";
const def = findKanban("revisao");
export default function KanbanRevisao() {
  return <KanbanBoard activeKey="revisao" pipeline={def.pipeline!} title={def.label} subtitle={def.subtitle} icon={def.icon} iconVariant={def.variant} useStageDialog />;
}
