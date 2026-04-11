import { DepartmentKanban } from '@/components/orders/DepartmentKanban';

export default function FinanceiroKanban() {
  return (
    <DepartmentKanban
      pipelineType="financeiro"
      statusField="financial_status"
      title="Financeiro"
      subtitle="Kanban do processo financeiro"
    />
  );
}
