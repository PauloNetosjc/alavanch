import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Loja = { id: string; nome: string; cnpj: string | null };

interface LojaCtx {
  lojas: Loja[];
  /** id da loja selecionada (null = todas, só admin) */
  selectedLojaId: string | null;
  setSelectedLojaId: (id: string | null) => void;
  loading: boolean;
}

const Ctx = createContext<LojaCtx | undefined>(undefined);
const STORAGE_KEY = "selected_loja_id";

export function LojaProvider({ children }: { children: ReactNode }) {
  const { user, profile, role } = useAuth();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [selectedLojaId, setSelectedLojaIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLojas([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      let list: Loja[] = [];
      if (role === "admin") {
        const { data } = await supabase.from("lojas").select("id,nome,cnpj").eq("ativo", true).order("nome");
        list = (data || []) as Loja[];
      } else {
        // Carrega apenas lojas que o usuário tem acesso (user_lojas)
        const { data } = await supabase
          .from("user_lojas")
          .select("loja_id, lojas:loja_id(id,nome,cnpj,ativo)")
          .eq("user_id", user.id);
        list = ((data || []) as any[])
          .map((r) => r.lojas)
          .filter((l) => l && l.ativo)
          .map((l) => ({ id: l.id, nome: l.nome, cnpj: l.cnpj })) as Loja[];
        list.sort((a, b) => a.nome.localeCompare(b.nome));
        // Fallback: se ainda não tem vínculo mas tem loja no profile
        if (list.length === 0 && profile?.loja_id) {
          const { data: l } = await supabase.from("lojas").select("id,nome,cnpj").eq("id", profile.loja_id).maybeSingle();
          if (l) list = [l as Loja];
        }
      }
      setLojas(list);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (role === "admin") {
        setSelectedLojaIdState(stored === "__all__" ? null : (stored || null));
      } else {
        // Se o stored estiver entre as lojas permitidas, mantém; senão usa a primeira / loja do profile
        const allowed = list.map((l) => l.id);
        const candidate = stored && stored !== "__all__" && allowed.includes(stored) ? stored : (profile?.loja_id && allowed.includes(profile.loja_id) ? profile.loja_id : (list[0]?.id || null));
        setSelectedLojaIdState(candidate);
      }
      setLoading(false);
    })();
  }, [user, role, profile?.loja_id]);

  const setSelectedLojaId = (id: string | null) => {
    setSelectedLojaIdState(id);
    localStorage.setItem(STORAGE_KEY, id ?? "__all__");
  };

  return (
    <Ctx.Provider value={{ lojas, selectedLojaId, setSelectedLojaId, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLoja() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLoja must be used within LojaProvider");
  return c;
}
