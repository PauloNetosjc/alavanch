import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { X, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type UrgenciaNivel = "baixa" | "media" | "alta";

export type KanbanFiltros = {
  dataFim?: string;
  unidadeId?: string;
  responsavelId?: string;
  tipoOcorrencia?: string;
  equipe?: string;
  grupoLinhasGrade?: string;
  urgencia?: UrgenciaNivel;
  somenteAtrasados: boolean;
  mostrarValores: boolean;
  mostrarTarefas: boolean;
  arquivados: boolean;
  ordenarPor: "indices" | "urgencia" | "entrega";
};

export const FILTROS_DEFAULT: KanbanFiltros = {
  somenteAtrasados: false,
  mostrarValores: true,
  mostrarTarefas: false,
  arquivados: false,
  ordenarPor: "indices",
};

export const URGENCIA_META: Record<UrgenciaNivel, { label: string; color: string; bg: string }> = {
  baixa: { label: "Baixa", color: "#16a34a", bg: "#dcfce7" },
  media: { label: "Média", color: "#ca8a04", bg: "#fef9c3" },
  alta: { label: "Alta", color: "#dc2626", bg: "#fee2e2" },
};

type Loja = { id: string; nome: string };
type Profile = { user_id: string; nome_completo: string | null };

export function KanbanFiltrosDialog({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: KanbanFiltros;
  onChange: (v: KanbanFiltros) => void;
}) {
  const [draft, setDraft] = useState<KanbanFiltros>(value);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => { if (open) setDraft(value); }, [open, value]);

  useEffect(() => {
    (async () => {
      const [{ data: ljs }, { data: profs }] = await Promise.all([
        supabase.from("lojas").select("id,nome").order("nome"),
        supabase.from("profiles").select("user_id,nome_completo").order("nome_completo"),
      ]);
      setLojas((ljs ?? []) as any);
      setProfiles((profs ?? []) as any);
    })();
  }, []);

  const set = <K extends keyof KanbanFiltros>(k: K, v: KanbanFiltros[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filtrar</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Data fim</Label>
            <Input type="date" value={draft.dataFim || ""} onChange={(e) => set("dataFim", e.target.value || undefined)} />
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Unidades de negócio</Label>
            <Select value={draft.unidadeId || "all"} onValueChange={(v) => set("unidadeId", v === "all" ? undefined : v)}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {lojas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Responsável</Label>
            <div className="flex gap-1">
              <Select value={draft.responsavelId || "all"} onValueChange={(v) => set("responsavelId", v === "all" ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.nome_completo || "—"}</SelectItem>)}
                </SelectContent>
              </Select>
              {draft.responsavelId && (
                <Button variant="ghost" size="icon" onClick={() => set("responsavelId", undefined)}><X className="w-4 h-4" /></Button>
              )}
            </div>
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Tipo de ocorrência</Label>
            <Input placeholder="Texto livre" value={draft.tipoOcorrencia || ""} onChange={(e) => set("tipoOcorrencia", e.target.value || undefined)} />
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Equipe</Label>
            <Input placeholder="Texto livre" value={draft.equipe || ""} onChange={(e) => set("equipe", e.target.value || undefined)} />
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Grupo de linhas de grade</Label>
            <Input placeholder="Texto livre" value={draft.grupoLinhasGrade || ""} onChange={(e) => set("grupoLinhasGrade", e.target.value || undefined)} />
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1">Estrelas (mínimo)</Label>
            <div className="flex gap-2 items-center">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set("estrelas", n)}
                  className="flex flex-col items-center"
                >
                  <Star
                    className={`w-7 h-7 ${
                      (draft.estrelas ?? 0) >= n && n > 0
                        ? "fill-amber-400 text-amber-400"
                        : n === 0 && (draft.estrelas ?? 0) === 0
                        ? "text-amber-400"
                        : "text-muted-foreground/40"
                    }`}
                  />
                  {n > 0 && <span className="text-[10px] -mt-1">{n}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={draft.somenteAtrasados} onCheckedChange={(v) => set("somenteAtrasados", !!v)} />
              Somente com tarefa atrasada
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={draft.mostrarValores} onCheckedChange={(v) => set("mostrarValores", !!v)} />
              Mostrar valores (mais lento)
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={draft.mostrarTarefas} onCheckedChange={(v) => set("mostrarTarefas", !!v)} />
              Mostrar tarefas (mais lento)
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={draft.arquivados} onCheckedChange={(v) => set("arquivados", !!v)} />
              Arquivados
            </label>
          </div>

          <div className="pt-2 border-t">
            <Label className="text-[13px] font-semibold block mb-2">Ordenar por</Label>
            <div className="space-y-1.5">
              {([
                ["indices", "Ordenar pelos índices"],
                ["estrelas", "Ordenar pelas estrelas"],
                ["entrega", "Ordenar pelas datas de entrega"],
              ] as const).map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 text-[13px] cursor-pointer">
                  <input
                    type="radio"
                    name="ord"
                    checked={draft.ordenarPor === v}
                    onChange={() => set("ordenarPor", v)}
                  />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button className="w-full" onClick={() => { onChange(draft); onOpenChange(false); }}>
            CONFIRMAR
          </Button>
          <div className="flex gap-2 w-full">
            <Button variant="ghost" className="flex-1" onClick={() => setDraft(FILTROS_DEFAULT)}>LIMPAR</Button>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>FECHAR</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
