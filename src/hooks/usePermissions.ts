import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Permissao = { modulo: string; acao: string };

/** Hook central de permissões.
 *  - Admin tem acesso total a tudo.
 *  - Demais usuários: validamos contra a view `v_my_permissions` que combina
 *    permissões padrão do cargo (role_permissoes) + concessões individuais (permissoes).
 */
export function usePermissions() {
  const { user, role } = useAuth();
  const [perms, setPerms] = useState<Permissao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setPerms([]); setLoading(false); return; }
    if (role === "admin") { setPerms([]); setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("v_my_permissions" as any)
        .select("modulo,acao");
      setPerms(((data as unknown) as Permissao[]) || []);
      setLoading(false);
    })();
  }, [user, role]);

  /** Verifica permissão. Para acoes derivadas (view), 'edit' implica 'view'. */
  function can(modulo: string, acao: string = "view"): boolean {
    if (role === "admin") return true;
    return perms.some(
      (p) => p.modulo === modulo && (p.acao === acao || (acao === "view" && p.acao === "edit"))
    );
  }

  function hasPerfil(perfil: "financeiro" | "auditor" | "diretoria"): boolean {
    if (role === "admin") return true;
    // compatibilidade com perfis antigos baseados em módulo
    if (perfil === "financeiro") return can("financeiro", "view");
    if (perfil === "diretoria") return role === "diretor" || can("relatorios", "view");
    if (perfil === "auditor") return can("auditoria_parceiros", "view");
    return false;
  }

  return { can, hasPerfil, loading, isAdmin: role === "admin", role };
}
