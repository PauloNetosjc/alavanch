import { useMemo, useState } from "react";
import { Building2, Check, ChevronDown, Globe } from "lucide-react";
import { useLoja } from "@/contexts/LojaContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/**
 * Filtro multi-seleção de lojas para telas financeiras.
 * Inicializa com a loja atualmente selecionada no topbar.
 * `selected = []` significa "todas as lojas que o usuário pode acessar".
 */
export function LojasFilter({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { lojas } = useLoja();

  const todas = value.length === 0 || value.length === lojas.length;
  const label = useMemo(() => {
    if (todas) return "Todas as lojas";
    if (value.length === 1) return lojas.find((l) => l.id === value[0])?.nome ?? "1 loja";
    return `${value.length} lojas`;
  }, [value, lojas, todas]);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };

  if (lojas.length <= 1) {
    // Apenas uma loja disponível — só exibe rótulo
    const only = lojas[0];
    if (!only) return null;
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-9 px-3 rounded-md text-[12px] flex items-center gap-2 bg-card hover:bg-secondary transition-colors"
          style={{ border: "0.5px solid hsl(var(--border))" }}
          title={label}
        >
          {todas ? <Globe className="w-3.5 h-3.5 text-primary" /> : <Building2 className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="max-w-[180px] truncate">{label}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[240px] max-h-[420px] overflow-hidden flex flex-col">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Filtrar por loja
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="overflow-y-auto">
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); onChange([]); }} className="gap-2">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span className="flex-1">Todas as lojas</span>
            {todas && <Check className="w-3.5 h-3.5" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {lojas.map((l) => {
            const checked = value.includes(l.id);
            return (
              <DropdownMenuItem
                key={l.id}
                onClick={(e) => { e.preventDefault(); toggle(l.id); }}
                className="gap-2"
              >
                <input type="checkbox" readOnly checked={checked} className="pointer-events-none" />
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="flex-1 text-[12px] truncate">{l.nome}</span>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
