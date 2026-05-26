import { useState, useRef, useEffect } from "react";
import { Store, Check, ChevronDown } from "lucide-react";
import { useLoja } from "@/contexts/LojaContext";
import { useAuth } from "@/contexts/AuthContext";

export function TopbarLojaSwitcher() {
  const { lojas, selectedLojaId, setSelectedLojaId, loading } = useLoja();
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (loading || lojas.length === 0) return null;

  const current = lojas.find((l) => l.id === selectedLojaId);
  const label = current?.nome ?? "Selecionar loja";

  // Se só tem 1 loja, mostra apenas como rótulo
  if (lojas.length === 1) {
    return (
      <div
        className="hidden sm:flex items-center gap-1.5 h-9 px-2.5 rounded-md text-[12px] text-foreground bg-card"
        style={{ border: "0.5px solid hsl(var(--border))" }}
        title="Loja ativa"
      >
        <Store className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="max-w-[140px] truncate">{label}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-9 px-2.5 rounded-md text-[12px] text-foreground bg-card hover:bg-secondary transition-colors"
        style={{ border: "0.5px solid hsl(var(--border))" }}
        title="Trocar loja principal"
      >
        <Store className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="hidden sm:inline max-w-[140px] truncate">{label}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 min-w-[220px] bg-card rounded-md shadow-lg z-50 overflow-hidden"
          style={{ border: "0.5px solid hsl(var(--border))" }}
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
            Loja principal
          </div>
          {lojas.map((l) => (
            <button
              key={l.id}
              onClick={() => { setSelectedLojaId(l.id); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-secondary flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="truncate">{l.nome}</div>
                {l.cnpj && <div className="text-[11px] text-muted-foreground truncate">{l.cnpj}</div>}
              </div>
              {selectedLojaId === l.id && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
