import { DepartmentKanban } from '@/components/orders/DepartmentKanban';

export default function Entrega() {
  return (
    <DepartmentKanban
      pipelineType="entrega"
      statusField="delivery_status"
      title="Entrega"
      subtitle="Kanban de entregas"
    />
  );
}
