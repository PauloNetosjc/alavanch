import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Permissao = { modulo: string; acao: string; perfil: string | null };

/** Hook central de permissões.
 *  - Admin tem acesso total a tudo.
 *  - Demais usuários: validamos contra a tabela `permissoes`.
 *  Módulos esperados: 'financeiro', 'contas', 'cartoes', 'extrato', 'categorias_financeiras',
 *  'lancamentos', 'auditoria_parceiros', 'parceiros', 'diretoria', 'dashboard', 'relatorios'.
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
        .from("permissoes" as any)
        .select("modulo,acao,perfil")
        .eq("user_id", user.id);
      setPerms((data as Permissao[]) || []);
      setLoading(false);
    })();
  }, [user, role]);

  function can(modulo: string, acao: "view" | "edit" | "delete" = "view"): boolean {
    if (role === "admin") return true;
    return perms.some(
      (p) => p.modulo === modulo && (p.acao === acao || p.acao === "edit" || p.acao === "delete")
    );
  }

  function hasPerfil(perfil: "financeiro" | "auditor" | "diretoria"): boolean {
    if (role === "admin") return true;
    return perms.some((p) => p.perfil === perfil);
  }

  return { can, hasPerfil, loading, isAdmin: role === "admin" };
}
