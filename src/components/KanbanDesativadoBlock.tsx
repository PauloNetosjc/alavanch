import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { KanbanSquare, Home } from "lucide-react";

export default function KanbanDesativadoBlock({ nome }: { nome?: string }) {
  return (
    <div className="surface-card p-10 text-center max-w-xl mx-auto mt-10">
      <div className="w-12 h-12 mx-auto rounded-lg bg-muted flex items-center justify-center mb-3">
        <KanbanSquare className="w-6 h-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-display mb-1">Kanban desativado</h2>
      <p className="text-sm text-muted-foreground mb-5">
        {nome ? `O ${nome} está desativado` : "Este kanban está desativado"} nas configurações do sistema.
        Os dados continuam preservados; apenas a navegação foi ocultada.
      </p>
      <Button asChild variant="default">
        <Link to="/dashboard"><Home className="w-4 h-4" /> Voltar para o início</Link>
      </Button>
    </div>
  );
}
