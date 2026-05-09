import KanbanBoard from "@/components/kanban/KanbanBoard";
import { findKanban } from "@/components/kanban/kanbanRegistry";
const def = findKanban("fabrica");
export default function KanbanFabrica() {
  return <KanbanBoard activeKey="fabrica" pipeline={def.pipeline!} title={def.label} subtitle={def.subtitle} icon={def.icon} iconVariant={def.variant} useStageDialog />;
}
