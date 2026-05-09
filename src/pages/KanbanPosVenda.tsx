import KanbanBoard from "@/components/kanban/KanbanBoard";
import { Wallet } from "lucide-react";
export default function KanbanPosVenda() {
  return <KanbanBoard pipeline="pos_venda" stageColumn="estagio_pos_venda_id" title="Pós-Venda e Financeiro" subtitle="Acompanhamento de contratos, boletos e envios" icon={Wallet} iconVariant="green" />;
}
