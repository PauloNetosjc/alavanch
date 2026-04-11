import { DepartmentKanban } from '@/components/orders/DepartmentKanban';

export default function Revisao() {
  return (
    <DepartmentKanban
      pipelineType="revisao"
      statusField="revision_status"
      title="Revisão"
      subtitle="Kanban de revisão de projetos"
    />
  );
}
