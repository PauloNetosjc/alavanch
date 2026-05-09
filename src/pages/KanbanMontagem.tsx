import KanbanBoard from "@/components/kanban/KanbanBoard";
import { findKanban } from "@/components/kanban/kanbanRegistry";
const def = findKanban("montagem");
export default function KanbanMontagem() {
  return <KanbanBoard activeKey="montagem" pipeline={def.pipeline!} title={def.label} subtitle={def.subtitle} icon={def.icon} iconVariant={def.variant} useStageDialog />;
}
