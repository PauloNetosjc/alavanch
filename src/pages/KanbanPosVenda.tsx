import KanbanBoard from "@/components/kanban/KanbanBoard";
import { findKanban } from "@/components/kanban/kanbanRegistry";
const def = findKanban("pos_venda");
export default function KanbanPosVenda() {
  return <KanbanBoard activeKey="pos_venda" pipeline={def.pipeline!} title={def.label} subtitle={def.subtitle} icon={def.icon} iconVariant={def.variant} useStageDialog />;
}
