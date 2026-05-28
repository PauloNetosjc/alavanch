import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Ban } from "lucide-react";

export default function AuditoriaParceiros() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4 rounded-xl border bg-card p-8 shadow-sm">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Ban className="w-6 h-6 text-muted-foreground" />
        </div>
        <h1 className="font-playfair text-2xl font-semibold">Relatório desativado</h1>
        <p className="text-sm text-muted-foreground">
          Este relatório foi desativado nas configurações do sistema.
        </p>
        <Link to="/financeiro">
          <Button className="mt-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para o Financeiro
          </Button>
        </Link>
      </div>
    </div>
  );
}
