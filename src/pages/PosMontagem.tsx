import { DepartmentKanban } from '@/components/orders/DepartmentKanban';

export default function PosMontagem() {
  return (
    <DepartmentKanban
      pipelineType="pos_montagem"
      statusField="post_assembly_status"
      title="Pós-montagem"
      subtitle="Assistências e pós-venda"
    />
  );
}
