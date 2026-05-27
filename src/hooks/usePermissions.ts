import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Permissao = { modulo: string; acao: string };

/** Hook central de permissões.
 *  - Admin tem acesso total a tudo.
 *  - Demais usuários: validamos contra a view `v_my_permissions` que combina
 *    permissões padrão do cargo (role_permissoes) + concessões individuais (permissoes).
 *
 *  Implementado com react-query para que múltiplos componentes na mesma tela
 *  (Sidebar, RequirePermission, Can, páginas) compartilhem o mesmo cache e
 *  evitem N requisições simultâneas a cada navegação.
 */
export function usePermissions() {
  const { user, role, loading: authLoading } = useAuth();

  const enabled = !authLoading && !!user && role !== "admin" && role != null;

  const { data: perms = [], isLoading } = useQuery({
    queryKey: ["my-permissions", user?.id, role],
    enabled,
    staleTime: 5 * 60 * 1000, // 5min — permissões mudam raramente durante a sessão
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("v_my_permissions" as any)
        .select("modulo,acao");
      return ((data as unknown) as Permissao[]) || [];
    },
  });

  // Admin não consulta; usuário sem role ainda carregando autenticação
  const loading =
    authLoading ||
    (!!user && role !== "admin" && role == null) ||
    (enabled && isLoading);

  /** Verifica permissão. Para acoes derivadas (view), 'edit' implica 'view'. */
  function can(modulo: string, acao: string = "view"): boolean {
    if (role === "admin") return true;
    return perms.some(
      (p) => p.modulo === modulo && (p.acao === acao || (acao === "view" && p.acao === "edit"))
    );
  }

  function hasPerfil(perfil: "financeiro" | "auditor" | "diretoria"): boolean {
    if (role === "admin") return true;
    if (perfil === "financeiro") return can("financeiro", "view");
    if (perfil === "diretoria") return role === "diretor" || can("relatorios", "view");
    if (perfil === "auditor") return can("auditoria_parceiros", "view");
    return false;
  }

  return { can, hasPerfil, loading, isAdmin: role === "admin", role };
}
