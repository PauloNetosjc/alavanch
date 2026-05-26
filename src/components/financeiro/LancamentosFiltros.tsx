import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, CalendarRange } from "lucide-react";

export type Cat = { id: string; nome: string; parent_id?: string | null };

interface Props {
  // busca
  busca: string;
  setBusca: (v: string) => void;
  // período
  dtIni: string;
  setDtIni: (v: string) => void;
  dtFim: string;
  setDtFim: (v: string) => void;
  // categoria
  cats: Cat[];
  categoriaFiltro: string;
  setCategoriaFiltro: (v: string) => void;
  // opções
  apenasPendentes: boolean;
  setApenasPendentes: (v: boolean) => void;
  mostrarCancelados: boolean;
  setMostrarCancelados: (v: boolean) => void;
}

export default function LancamentosFiltros(p: Props) {
  function setPreset(preset: "hoje" | "semana" | "mes" | "passado" | "ano") {
    const t = new Date();
    if (preset === "hoje") {
      const d = t.toISOString().slice(0, 10);
      p.setDtIni(d); p.setDtFim(d);
    }
    if (preset === "semana") {
      const dia = t.getDay();
      const ini = new Date(t); ini.setDate(t.getDate() - dia);
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
      p.setDtIni(ini.toISOString().slice(0, 10));
      p.setDtFim(fim.toISOString().slice(0, 10));
    }
    if (preset === "mes") {
      p.setDtIni(new Date(t.getFullYear(), t.getMonth(), 1).toISOString().slice(0, 10));
      p.setDtFim(new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString().slice(0, 10));
    }
    if (preset === "passado") {
      p.setDtIni(new Date(t.getFullYear(), t.getMonth() - 1, 1).toISOString().slice(0, 10));
      p.setDtFim(new Date(t.getFullYear(), t.getMonth(), 0).toISOString().slice(0, 10));
    }
    if (preset === "ano") {
      p.setDtIni(new Date(t.getFullYear(), 0, 1).toISOString().slice(0, 10));
      p.setDtFim(new Date(t.getFullYear(), 11, 31).toISOString().slice(0, 10));
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Busca */}
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Busca</div>
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar descrição..."
              value={p.busca}
              onChange={(e) => p.setBusca(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>
        </div>

        {/* Período */}
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Período</div>
            <CalendarRange className="w-3 h-3 text-muted-foreground" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { k: "hoje", l: "Hoje" }, { k: "semana", l: "Semana" }, { k: "mes", l: "Mês" },
              { k: "passado", l: "Passado" }, { k: "ano", l: "Ano" },
            ].map((b) => (
              <button
                key={b.k}
                onClick={() => setPreset(b.k as any)}
                className="px-2 py-1 rounded-md text-[11px] bg-muted hover:bg-muted/70"
              >
                {b.l}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={p.dtIni} onChange={(e) => p.setDtIni(e.target.value)} className="h-8 text-xs" />
            <Input type="date" value={p.dtFim} onChange={(e) => p.setDtFim(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Categoria */}
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Categoria</div>
          <Select
            value={p.categoriaFiltro || "all"}
            onValueChange={(v) => p.setCategoriaFiltro(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {p.cats.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.parent_id ? `↳ ${c.nome}` : c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Opções */}
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Opções</div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={p.apenasPendentes} onCheckedChange={(v) => p.setApenasPendentes(!!v)} />
            Apenas Pendentes
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={p.mostrarCancelados} onCheckedChange={(v) => p.setMostrarCancelados(!!v)} />
            Mostrar Cancelados
          </label>
        </div>
      </div>
    </div>
  );
}
