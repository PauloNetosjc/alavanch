import { DepartmentKanban } from '@/components/orders/DepartmentKanban';

export default function Contratos() {
  return (
    <DepartmentKanban
      pipelineType="contrato"
      statusField="contract_status"
      title="Contratos"
      subtitle="Kanban de gestão de contratos"
    />
  );
}
