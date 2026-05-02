import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";

interface Branding {
  nome: string;
  logoUrl: string | null;
  loading: boolean;
  refresh: () => void;
}

const Ctx = createContext<Branding | undefined>(undefined);
const DEFAULT_NAME = "Planejados Pro";

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { selectedLojaId, lojas } = useLoja();
  const [nome, setNome] = useState(DEFAULT_NAME);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Loja alvo: a selecionada, ou a primeira disponível (consolidado/admin)
      const targetId = selectedLojaId || lojas[0]?.id || null;
      if (!targetId) {
        setNome(DEFAULT_NAME);
        setLogoUrl(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("configuracoes_empresa" as any)
        .select("nome_empresa, nome_fantasia, logo_url")
        .eq("loja_id", targetId)
        .maybeSingle();
      if (cancelled) return;
      const d = (data as any) || {};
      setNome(d.nome_fantasia || d.nome_empresa || DEFAULT_NAME);
      setLogoUrl(d.logo_url || null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedLojaId, lojas, tick]);

  return (
    <Ctx.Provider value={{ nome, logoUrl, loading, refresh: () => setTick((t) => t + 1) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBranding() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBranding must be used within BrandingProvider");
  return c;
}
