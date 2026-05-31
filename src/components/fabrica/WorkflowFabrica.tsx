import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import {
  Upload, Boxes, Factory, ClipboardCheck, Truck, ChevronRight,
} from "lucide-react";

export interface EtapaWorkflow {
  value: string;
  label: string;
  icon: any;
  /** lista de status_fabrica que contam para essa etapa */
  statuses: string[];
}

export const ETAPAS_WORKFLOW: EtapaWorkflow[] = [
  {
    value: "importar",
    label: "Importar Produção",
    icon: Upload,
    statuses: ["aguardando_arquivos", "arquivos_importados"],
  },
  {
    value: "lotes",
    label: "Lotes",
    icon: Boxes,
    statuses: ["liberado_para_lote", "aguardando_corte"],
  },
  {
    value: "producao",
    label: "Produção",
    icon: Factory,
    statuses: ["em_corte", "corte_finalizado", "atelie", "em_producao"],
  },
  {
    value: "conferencia",
    label: "Conferência",
    icon: ClipboardCheck,
    statuses: ["aguardando_conferencia", "em_separacao_pecas"],
  },
  {
    value: "expedicao",
    label: "Expedição",
    icon: Truck,
    statuses: ["aguardando_almoxarifado", "em_separacao_almoxarifado", "pronto_para_expedicao", "em_expedicao", "expedido"],
  },
];

export function WorkflowFabrica({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (v: string) => void;
}) {
  const { selectedLojaId } = useLoja();
  const [contagens, setContagens] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      let q = (supabase as any)
        .from("pedidos")
        .select("status_fabrica", { count: "exact", head: false })
        .not("status_fabrica", "is", null);
      if (selectedLojaId) q = q.eq("loja_id", selectedLojaId);
      const { data } = await q;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const etapa = ETAPAS_WORKFLOW.find((e) => e.statuses.includes(r.status_fabrica));
        if (etapa) map[etapa.value] = (map[etapa.value] || 0) + 1;
      });
      setContagens(map);
    })();
  }, [selectedLojaId, active]);

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex items-stretch gap-1 min-w-max">
        {ETAPAS_WORKFLOW.map((etapa, idx) => {
          const Icon = etapa.icon;
          const isActive = etapa.value === active;
          const count = contagens[etapa.value] || 0;
          return (
            <div key={etapa.value} className="flex items-stretch">
              <button
                onClick={() => onSelect(etapa.value)}
                className={cn(
                  "flex flex-col items-start gap-1 px-4 py-3 rounded-lg border min-w-[160px] text-left transition",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card hover:bg-muted/50 border-border"
                )}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className={cn(
                    "h-7 w-7 rounded-md flex items-center justify-center text-xs font-bold",
                    isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                  )}>
                    {idx + 1}
                  </div>
                  <Icon className="h-4 w-4 ml-auto opacity-80" />
                </div>
                <div className="text-sm font-semibold leading-tight">{etapa.label}</div>
                <div className={cn(
                  "text-[11px]",
                  isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                )}>
                  {count} {count === 1 ? "pedido" : "pedidos"}
                </div>
              </button>
              {idx < ETAPAS_WORKFLOW.length - 1 && (
                <div className="flex items-center px-1 text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
