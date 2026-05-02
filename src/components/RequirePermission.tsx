import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

interface Props {
  modulo: string;
  acao?: "view" | "edit" | "delete";
  children: ReactNode;
  /** Para onde redirecionar quando não tem permissão */
  fallback?: string;
}

export function RequirePermission({ modulo, acao = "view", children, fallback = "/dashboard" }: Props) {
  const { can, loading } = usePermissions();
  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-[12px] text-muted-foreground animate-pulse">Verificando acesso…</div>
      </div>
    );
  }
  if (!can(modulo, acao)) {
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}
