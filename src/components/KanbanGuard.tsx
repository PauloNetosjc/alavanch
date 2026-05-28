import { ReactNode } from "react";
import { useKanbansVisibilidade, KANBANS_CATALOGO, KanbanChave } from "@/hooks/useKanbansVisibilidade";
import KanbanDesativadoBlock from "./KanbanDesativadoBlock";

export default function KanbanGuard({ chave, children }: { chave: KanbanChave; children: ReactNode }) {
  const { isAtivo, loading } = useKanbansVisibilidade();
  if (loading) return null;
  if (!isAtivo(chave)) {
    const def = KANBANS_CATALOGO.find((k) => k.chave === chave);
    return <KanbanDesativadoBlock nome={def?.nome} />;
  }
  return <>{children}</>;
}
