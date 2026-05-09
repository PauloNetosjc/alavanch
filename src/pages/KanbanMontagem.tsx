import KanbanBoard from "@/components/kanban/KanbanBoard";
import { Hammer } from "lucide-react";
export default function KanbanMontagem() {
  return <KanbanBoard pipeline="montagem" stageColumn="estagio_montagem_id" title="Montagem" subtitle="Entregas, montagens agendadas e vistorias" icon={Hammer} iconVariant="amber" />;
}
