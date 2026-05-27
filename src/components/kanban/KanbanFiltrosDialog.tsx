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
  dataVenda?: string;
  unidadeId?: string;
  responsavelId?: string;
  urgencia?: UrgenciaNivel;
  somenteAtrasados: boolean;
  mostrarValores: boolean;
};

export const FILTROS_DEFAULT: KanbanFiltros = {
  somenteAtrasados: false,
  mostrarValores: true,
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
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Data da venda</Label>
            <Input type="date" value={draft.dataVenda || ""} onChange={(e) => set("dataVenda", e.target.value || undefined)} />
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
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-1">Urgência</Label>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => set("urgencia", undefined)}
                className={`px-3 py-1.5 rounded-full border text-[12px] ${!draft.urgencia ? "bg-foreground text-background border-foreground" : "bg-card"}`}>
                Todas
              </button>
              {(["baixa", "media", "alta"] as const).map((u) => {
                const meta = URGENCIA_META[u];
                const active = draft.urgencia === u;
                return (
                  <button key={u} type="button" onClick={() => set("urgencia", u)}
                    className="px-3 py-1.5 rounded-full border text-[12px] inline-flex items-center gap-1.5"
                    style={active
                      ? { background: meta.color, color: "#fff", borderColor: meta.color }
                      : { background: meta.bg, color: meta.color, borderColor: meta.color + "55" }}>
                    <Flame className="w-3 h-3" /> {meta.label}
                  </button>
                );
              })}
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
