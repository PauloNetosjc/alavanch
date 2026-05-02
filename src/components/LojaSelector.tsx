import { useMemo, useState } from "react";
import { Building2, Check, ChevronDown, Search, Globe } from "lucide-react";
import { useLoja } from "@/contexts/LojaContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export function LojaSelector() {
  const { lojas, selectedLojaId, setSelectedLojaId, loading } = useLoja();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return lojas;
    const q = query.toLowerCase();
    return lojas.filter((l) => l.nome.toLowerCase().includes(q) || (l.cnpj || "").includes(q));
  }, [lojas, query]);

  if (loading) {
    return (
      <div
        className="h-9 px-3 rounded-md text-[12px] flex items-center gap-2 bg-card animate-pulse"
        style={{ border: "0.5px solid hsl(var(--border))" }}
      >
        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Carregando lojas…</span>
      </div>
    );
  }

  if (lojas.length === 0) return null;
  if (lojas.length === 1 && !isAdmin) {
    const only = lojas[0];
    return (
      <div
        className="h-9 px-3 rounded-md text-[12px] flex items-center gap-2 bg-card text-muted-foreground"
        style={{ border: "0.5px solid hsl(var(--border))" }}
        title={only.nome}
      >
        <Building2 className="w-3.5 h-3.5" />
        <span className="max-w-[160px] truncate">{only.nome}</span>
      </div>
    );
  }

  const current = lojas.find((l) => l.id === selectedLojaId);
  const showAll = isAdmin && selectedLojaId === null;
  const label = showAll ? "Todas as lojas" : current?.nome ?? "—";

  const showSearch = lojas.length > 6;

  const showSearch = lojas.length > 6;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-9 px-2 sm:px-3 rounded-md text-[12px] flex items-center gap-1.5 sm:gap-2 bg-card hover:bg-secondary transition-colors"
          style={{ border: "0.5px solid hsl(var(--border))" }}
          title={label}
        >
          {showAll ? (
            <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
          ) : (
            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="hidden sm:inline max-w-[180px] truncate">{label}</span>
          {isAdmin && lojas.length > 1 && (
            <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
              {lojas.length}
            </span>
          )}
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[260px] max-h-[420px] overflow-hidden flex flex-col">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Filtrar por loja
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {showSearch && (
          <div className="px-2 py-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar loja…"
                className="h-8 pl-7 text-[12px]"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
        <div className="overflow-y-auto">
          {isAdmin && (
            <DropdownMenuItem onClick={() => setSelectedLojaId(null)} className="gap-2">
              <Globe className="w-3.5 h-3.5 text-primary" />
              <span className="flex-1">Todas as lojas</span>
              {selectedLojaId === null && <Check className="w-3.5 h-3.5" />}
            </DropdownMenuItem>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
              Nenhuma loja encontrada
            </div>
          ) : (
            filtered.map((l) => (
              <DropdownMenuItem
                key={l.id}
                onClick={() => setSelectedLojaId(l.id)}
                disabled={!isAdmin && selectedLojaId !== l.id}
                className="gap-2"
              >
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] truncate">{l.nome}</div>
                  {l.cnpj && <div className="text-[10px] text-muted-foreground truncate">{l.cnpj}</div>}
                </div>
                {selectedLojaId === l.id && <Check className="w-3.5 h-3.5" />}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
