import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

/** Renderiza children apenas se o usuário tiver a permissão.
 *  Útil para esconder colunas/campos sensíveis (custo, markup, comissão).
 */
export function Can({
  modulo, acao = "view", fallback = null, children,
}: {
  modulo: string;
  acao?: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  return can(modulo, acao) ? <>{children}</> : <>{fallback}</>;
}
