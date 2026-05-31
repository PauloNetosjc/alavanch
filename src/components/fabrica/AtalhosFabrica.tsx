import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Boxes, AlertTriangle, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { cn } from "@/lib/utils";

export type AtalhoFabrica = "almoxarifado" | "ocorrencias" | "requisicoes" | null;

export function AtalhosFabrica({
  active,
  onSelect,
}: {
  active: AtalhoFabrica;
  onSelect: (v: AtalhoFabrica) => void;
}) {
  const { selectedLojaId } = useLoja();
  const [counts, setCounts] = useState({ ocorrencias: 0, requisicoes: 0, criticas: 0 });

  useEffect(() => {
    (async () => {
      try {
        // Ocorrências abertas
        let qOc = (supabase as any)
          .from("fabrica_ocorrencias")
          .select("id, prioridade, status", { count: "exact" })
          .in("status", ["aberta", "em_analise", "em_andamento", "pendente"]);
        if (selectedLojaId) qOc = qOc.eq("loja_id", selectedLojaId);
        const { data: oc } = await qOc;
        const criticas = (oc || []).filter((o: any) => o.prioridade === "alta" || o.prioridade === "critica").length;

        // Requisições pendentes
        let qRq = (supabase as any)
          .from("fabrica_requisicoes_compra")
          .select("id")
          .in("status", ["pendente", "solicitado", "comprado"]);
        if (selectedLojaId) qRq = qRq.or(`loja_id.eq.${selectedLojaId},loja_id.is.null`);
        const { data: rq } = await qRq;

        setCounts({
          ocorrencias: (oc || []).length,
          requisicoes: (rq || []).length,
          criticas,
        });
      } catch {
        /* ignore */
      }
    })();
  }, [selectedLojaId, active]);

  const itens: Array<{ key: AtalhoFabrica; label: string; icon: any; badge?: number; tone?: "danger" | "info" }> = [
    { key: "almoxarifado", label: "Almoxarifado", icon: Boxes },
    { key: "ocorrencias", label: "Ocorrências", icon: AlertTriangle, badge: counts.ocorrencias, tone: counts.criticas > 0 ? "danger" : "info" },
    { key: "requisicoes", label: "Requisições de Compra", icon: ShoppingCart, badge: counts.requisicoes, tone: "info" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {itens.map((i) => {
        const Icon = i.icon;
        const isActive = active === i.key;
        return (
          <Button
            key={i.key}
            type="button"
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onSelect(isActive ? null : i.key)}
            className="gap-2"
          >
            <Icon className="h-4 w-4" />
            {i.label}
            {typeof i.badge === "number" && i.badge > 0 && (
              <Badge
                variant="secondary"
                className={cn(
                  "ml-1 h-5 px-1.5 text-[11px]",
                  i.tone === "danger" ? "bg-red-100 text-red-700 border-red-200" : ""
                )}
              >
                {i.badge}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
