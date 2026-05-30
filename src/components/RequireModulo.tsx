import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Package, Home } from "lucide-react";
import { useModulosLoja } from "@/hooks/useModulosLoja";

interface Props {
  modulo: string;
  nome?: string;
  children: ReactNode;
}

export function RequireModulo({ modulo, nome, children }: Props) {
  const { isModuloAtivo, loading } = useModulosLoja();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-[12px] text-muted-foreground animate-pulse">Carregando módulo…</div>
      </div>
    );
  }

  if (!isModuloAtivo(modulo)) {
    return (
      <div className="surface-card p-10 text-center max-w-xl mx-auto mt-10">
        <div className="w-12 h-12 mx-auto rounded-lg bg-muted flex items-center justify-center mb-3">
          <Package className="w-6 h-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-display mb-1">Módulo desativado</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Este módulo {nome ? <strong>{nome}</strong> : null} está desativado para esta base.
          Para ativá-lo, acesse a gestão de módulos do sistema.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button asChild variant="default">
            <Link to="/dashboard"><Home className="w-4 h-4" /> Voltar para o início</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/sistema/gestao-modulos">Gestão de Módulos</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
