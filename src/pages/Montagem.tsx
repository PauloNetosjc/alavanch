import { DepartmentKanban } from '@/components/orders/DepartmentKanban';

export default function Montagem() {
  return (
    <DepartmentKanban
      pipelineType="montagem"
      statusField="assembly_status"
      title="Montagem"
      subtitle="Kanban de montagem e entregas"
    />
  );
}
