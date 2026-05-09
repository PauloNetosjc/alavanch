import KanbanBoard from "@/components/kanban/KanbanBoard";
import { Building2 } from "lucide-react";
export default function KanbanFabrica() {
  return <KanbanBoard pipeline="fabrica" stageColumn="estagio_fabrica_id" title="Fábrica" subtitle="Produção, lotes e expedição" icon={Building2} iconVariant="purple" />;
}
