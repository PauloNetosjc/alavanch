import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import KanbanComercial from "./KanbanComercial";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Briefcase, Workflow, Wallet, ClipboardCheck, Hammer, Building2,
  ChevronDown, Plus, type LucideIcon,
} from "lucide-react";

type KanbanKey = "comercial" | "operacional" | "pos_venda" | "revisao" | "montagem" | "fabrica";

type KanbanDef = {
  key: KanbanKey;
  label: string;
  icon: LucideIcon;
  variant: "purple" | "blue" | "green" | "amber" | "rose";
  pipeline?: string;
  stageColumn?: string;
  subtitle?: string;
  estagiosPath: string;
};

const KANBANS: KanbanDef[] = [
  { key: "comercial",   label: "CRM Comercial",         icon: Briefcase,      variant: "purple", estagiosPath: "/administracao?tab=crm" },
  { key: "operacional", label: "Kanban Operacional",    icon: Workflow,       variant: "purple", pipeline: "operacional", stageColumn: "estagio_operacional_id", subtitle: "Workflow vinculado ao pedido de venda", estagiosPath: "/administracao?tab=pipelines" },
  { key: "pos_venda",   label: "Pós-Venda e Financeiro",icon: Wallet,         variant: "green",  pipeline: "pos_venda",   stageColumn: "estagio_pos_venda_id",   subtitle: "Contratos, boletos e envios", estagiosPath: "/administracao?tab=pipelines" },
  { key: "revisao",     label: "Revisão de Projeto",    icon: ClipboardCheck, variant: "blue",   pipeline: "revisao",     stageColumn: "estagio_revisao_id",     subtitle: "Análise, conferência e assinatura do PDF final", estagiosPath: "/administracao?tab=pipelines" },
  { key: "montagem",    label: "Montagem",              icon: Hammer,         variant: "amber",  pipeline: "montagem",    stageColumn: "estagio_montagem_id",    subtitle: "Entregas, montagens agendadas e vistorias", estagiosPath: "/administracao?tab=pipelines" },
  { key: "fabrica",     label: "Fábrica",               icon: Building2,      variant: "purple", pipeline: "fabrica",     stageColumn: "estagio_fabrica_id",     subtitle: "Produção, lotes e expedição", estagiosPath: "/administracao?tab=pipelines" },
];

export default function Kanbans() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = (params.get("k") as KanbanKey) || "comercial";
  const [active, setActive] = useState<KanbanKey>(initial);

  const def = useMemo(() => KANBANS.find((k) => k.key === active)!, [active]);

  const switchTo = (key: KanbanKey) => {
    setActive(key);
    setParams({ k: key }, { replace: true });
  };

  const Switcher = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-1.5 rounded-xl">
          <def.icon className="w-4 h-4" /> {def.label} <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {KANBANS.map((k) => (
          <DropdownMenuItem key={k.key} onClick={() => switchTo(k.key)}>
            <k.icon className="w-4 h-4 mr-2" /> {k.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (active === "comercial") {
    return <KanbanComercial switcher={Switcher} />;
  }

  const extra = null;

  return (
    <KanbanBoard
      key={def.key}
      pipeline={def.pipeline!}
      stageColumn={def.stageColumn!}
      title={def.label}
      subtitle={def.subtitle}
      icon={def.icon}
      iconVariant={def.variant}
      switcher={Switcher}
      estagiosPath={def.estagiosPath}
      extraActions={extra}
    />
  );
}
