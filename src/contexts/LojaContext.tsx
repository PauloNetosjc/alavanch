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
      const { data } = await supabase.from("lojas").select("id,nome,cnpj").eq("ativo", true).order("nome");
      const list = (data || []) as Loja[];
      setLojas(list);
      // Inicializa seleção: admin pode ter "todas" (null), demais ficam na própria loja.
      const stored = localStorage.getItem(STORAGE_KEY);
      if (role === "admin") {
        setSelectedLojaIdState(stored === "__all__" ? null : (stored || null));
      } else {
        setSelectedLojaIdState(profile?.loja_id || null);
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
