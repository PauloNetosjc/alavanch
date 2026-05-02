import { Building2, Check, ChevronDown } from "lucide-react";
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

export function LojaSelector() {
  const { lojas, selectedLojaId, setSelectedLojaId, loading } = useLoja();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  if (loading || lojas.length === 0) return null;
  // Se há só uma loja e não é admin, não mostra seletor
  if (lojas.length === 1 && !isAdmin) return null;

  const current = lojas.find((l) => l.id === selectedLojaId);
  const label = current?.nome ?? (isAdmin ? "Todas as lojas" : "—");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-9 px-3 rounded-md text-[12px] flex items-center gap-2 bg-card hover:bg-secondary transition-colors"
          style={{ border: "0.5px solid hsl(var(--border))" }}
        >
          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="max-w-[160px] truncate">{label}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Filtrar por loja
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem onClick={() => setSelectedLojaId(null)}>
            <span className="flex-1">Todas as lojas</span>
            {selectedLojaId === null && <Check className="w-3.5 h-3.5" />}
          </DropdownMenuItem>
        )}
        {lojas.map((l) => (
          <DropdownMenuItem
            key={l.id}
            onClick={() => setSelectedLojaId(l.id)}
            disabled={!isAdmin && selectedLojaId !== l.id}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[12px] truncate">{l.nome}</div>
              {l.cnpj && <div className="text-[10px] text-muted-foreground truncate">{l.cnpj}</div>}
            </div>
            {selectedLojaId === l.id && <Check className="w-3.5 h-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
