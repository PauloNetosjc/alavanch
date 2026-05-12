import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CrmEstagiosEditDialog } from "@/components/CrmEstagiosEditDialog";

export function CrmEstagiosAdmin() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Estágios do Kanban CRM Comercial</Label>
          <p className="text-[11px] text-muted-foreground">Edite, reordene, ative/desative e marque ganho/perdido — mesmo padrão dos demais Kanbans.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/kanban-comercial")}>
            <ExternalLink className="w-4 h-4 mr-1" /> Abrir Kanban
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Settings className="w-4 h-4 mr-1" /> Editar estágios
          </Button>
        </div>
      </div>
      <CrmEstagiosEditDialog open={open} onOpenChange={setOpen} onChanged={() => {}} />
    </div>
  );
}
