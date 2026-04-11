import { DepartmentKanban } from '@/components/orders/DepartmentKanban';

export default function AcompanhamentoProd() {
  return (
    <DepartmentKanban
      pipelineType="producao"
      statusField="production_status"
      title="Acompanhamento da Produção"
      subtitle="Kanban de acompanhamento da produção"
    />
  );
}
