import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { LojasFilter } from "@/components/financeiro/LojasFilter";

export type PeriodoKey = "dia" | "semana" | "mes" | "ano" | "tudo" | "personalizado";

export type PeriodoState = {
  key: PeriodoKey;
  /** Data de referência usada por dia/semana/mês/ano (mês corrente etc). */
  ref: Date;
  /** Quando key="personalizado": início. */
  start?: Date;
  /** Quando key="personalizado": fim. */
  end?: Date;
};

/** Resolve a janela [inicio, fim] do período, ambos inclusivos. */
export function resolvePeriodo(p: PeriodoState): { inicio: Date | null; fim: Date | null; label: string } {
  const r = p.ref;
  const y = r.getFullYear();
  const m = r.getMonth();
  switch (p.key) {
    case "dia": {
      const i = new Date(y, m, r.getDate(), 0, 0, 0);
      const f = new Date(y, m, r.getDate(), 23, 59, 59);
      return { inicio: i, fim: f, label: i.toLocaleDateString("pt-BR") };
    }
    case "semana": {
      const dow = r.getDay();
      const ini = new Date(y, m, r.getDate() - dow);
      const fim = new Date(y, m, r.getDate() + (6 - dow), 23, 59, 59);
      return { inicio: ini, fim,
        label: `${ini.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` };
    }
    case "mes": {
      const i = new Date(y, m, 1);
      const f = new Date(y, m + 1, 0, 23, 59, 59);
      return { inicio: i, fim: f, label: r.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase()) };
    }
    case "ano": {
      const i = new Date(y, 0, 1);
      const f = new Date(y, 11, 31, 23, 59, 59);
      return { inicio: i, fim: f, label: String(y) };
    }
    case "tudo":
      return { inicio: null, fim: null, label: "Tudo" };
    case "personalizado": {
      const i = p.start || new Date(y, m, 1);
      const f = p.end ? new Date(p.end.getFullYear(), p.end.getMonth(), p.end.getDate(), 23, 59, 59) : new Date();
      return { inicio: i, fim: f,
        label: `${i.toLocaleDateString("pt-BR")} – ${f.toLocaleDateString("pt-BR")}` };
    }
  }
}

const PERIODOS: { v: PeriodoKey; label: string }[] = [
  { v: "dia", label: "Dia" },
  { v: "semana", label: "Semana" },
  { v: "mes", label: "Mês" },
  { v: "ano", label: "Ano" },
  { v: "tudo", label: "Tudo" },
  { v: "personalizado", label: "Personalizado" },
];

export function PageFilters({
  value,
  onChange,
  showLoja = true,
  lojas,
  onLojasChange,
  options = ["dia", "semana", "mes", "ano", "tudo", "personalizado"],
}: {
  value: PeriodoState;
  onChange: (v: PeriodoState) => void;
  showLoja?: boolean;
  lojas?: string[];
  onLojasChange?: (ids: string[]) => void;
  options?: PeriodoKey[];
}) {
  const [open, setOpen] = useState(false);
  const periodos = useMemo(() => PERIODOS.filter((p) => options.includes(p.v)), [options]);
  const resolved = resolvePeriodo(value);

  const stepRef = (delta: number) => {
    const r = new Date(value.ref);
    if (value.key === "dia") r.setDate(r.getDate() + delta);
    else if (value.key === "semana") r.setDate(r.getDate() + delta * 7);
    else if (value.key === "mes") r.setMonth(r.getMonth() + delta);
    else if (value.key === "ano") r.setFullYear(r.getFullYear() + delta);
    else return;
    onChange({ ...value, ref: r });
  };

  const stepDisabled = value.key === "tudo" || value.key === "personalizado";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Navegação ◀ Mês/Ano/Dia ▶ */}
      <div className="flex items-center gap-1 rounded-md bg-card" style={{ border: "0.5px solid hsl(var(--border))" }}>
        <button
          onClick={() => stepRef(-1)}
          disabled={stepDisabled}
          className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-l-md"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className="px-3 py-1.5 text-[12px] font-medium min-w-[120px] hover:bg-muted flex items-center gap-1.5"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="capitalize">{resolved.label}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="end">
            <div className="flex flex-wrap gap-1 mb-3">
              {periodos.map((p) => (
                <button
                  key={p.v}
                  onClick={() => onChange({ ...value, key: p.v })}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    value.key === p.v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {value.key === "personalizado" ? (
              <div className="flex gap-2">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Início</div>
                  <Calendar mode="single" selected={value.start} onSelect={(d) => onChange({ ...value, start: d || undefined })} />
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Fim</div>
                  <Calendar mode="single" selected={value.end} onSelect={(d) => onChange({ ...value, end: d || undefined })} />
                </div>
              </div>
            ) : value.key === "tudo" ? (
              <div className="text-[12px] text-muted-foreground text-center py-3">Sem filtro de período</div>
            ) : (
              <Calendar
                mode="single"
                selected={value.ref}
                onSelect={(d) => d && onChange({ ...value, ref: d })}
              />
            )}
          </PopoverContent>
        </Popover>
        <button
          onClick={() => stepRef(1)}
          disabled={stepDisabled}
          className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-r-md"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {showLoja && lojas !== undefined && onLojasChange && (
        <LojasFilter value={lojas} onChange={onLojasChange} />
      )}
    </div>
  );
}

/** Estado inicial conveniente: mês corrente. */
export const defaultPeriodoMes = (): PeriodoState => ({ key: "mes", ref: new Date() });
export const defaultPeriodoAno = (): PeriodoState => ({ key: "ano", ref: new Date() });
