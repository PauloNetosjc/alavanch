import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { KANBANS, findKanban, type KanbanKey } from "./kanbanRegistry";
import { useKanbansVisibilidade, type KanbanChave } from "@/hooks/useKanbansVisibilidade";

const KEY_MAP: Record<KanbanKey, KanbanChave> = {
  comercial: "crm_comercial",
  pos_venda: "pos_venda",
  revisao: "revisao",
  montagem: "montagem",
  fabrica: "fabrica",
};

export function KanbanSwitcher({ active }: { active: KanbanKey }) {
  const nav = useNavigate();
  const { isAtivo } = useKanbansVisibilidade();
  const def = findKanban(active);
  const Icon = def.icon;

  const visibleKanbans = KANBANS.filter((k) => isAtivo(KEY_MAP[k.key]));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-1.5 rounded-xl">
          <Icon className="w-4 h-4" /> {def.label} <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {visibleKanbans.map((k) => (
          <DropdownMenuItem key={k.key} onClick={() => nav(k.route)}>
            <k.icon className="w-4 h-4 mr-2" /> {k.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
