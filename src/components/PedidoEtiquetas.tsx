import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tags, Check, Plus } from "lucide-react";
import { toast } from "sonner";

type Etiqueta = { id: string; nome: string; cor: string; ativo: boolean };

interface Props {
  pedidoId: string;
  /** Renderização compacta para usar no header (PV-LOJ-...) */
  compact?: boolean;
}

export function PedidoEtiquetas({ pedidoId, compact }: Props) {
  const [todas, setTodas] = useState<Etiqueta[]>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    const [{ data: et }, { data: vinc }] = await Promise.all([
      supabase.from("etiquetas" as any).select("*").eq("ativo", true).order("nome"),
      supabase.from("pedido_etiquetas" as any).select("etiqueta_id").eq("pedido_id", pedidoId),
    ]);
    setTodas(((et as unknown) as Etiqueta[]) || []);
    setSelecionadas(((vinc as any[]) || []).map(v => v.etiqueta_id));
    setLoading(false);
  };
  useEffect(() => { if (pedidoId) carregar(); }, [pedidoId]);

  const toggle = async (etiquetaId: string) => {
    const isSel = selecionadas.includes(etiquetaId);
    if (isSel) {
      const { error } = await supabase.from("pedido_etiquetas" as any)
        .delete().eq("pedido_id", pedidoId).eq("etiqueta_id", etiquetaId);
      if (error) return toast.error(error.message);
      setSelecionadas(s => s.filter(x => x !== etiquetaId));
    } else {
      const { error } = await supabase.from("pedido_etiquetas" as any)
        .insert({ pedido_id: pedidoId, etiqueta_id: etiquetaId });
      if (error) return toast.error(error.message);
      setSelecionadas(s => [...s, etiquetaId]);
    }
  };

  const visiveis = todas.filter(t => selecionadas.includes(t.id));

  return (
    <div className={compact ? "inline-flex items-center gap-1.5 flex-wrap" : "flex items-center gap-2 flex-wrap"}>
      {visiveis.map(e => (
        <span
          key={e.id}
          className={
            compact
              ? "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full text-white"
              : "inline-flex items-center gap-1 text-[13px] font-bold uppercase tracking-wider px-3 py-1.5 rounded text-white shadow-sm"
          }
          style={{ background: e.cor }}
        >
          {e.nome}
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size={compact ? "sm" : "default"}
            variant="outline"
            className={compact ? "h-6 px-2 text-[11px] gap-1" : "h-9 px-3 text-[13px] gap-1.5"}
          >
            <Tags className={compact ? "w-3 h-3" : "w-4 h-4"} />{compact ? (visiveis.length ? "Editar" : "Etiquetas") : "Etiquetas"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 px-1">Selecionar etiquetas</div>
          {loading ? (
            <div className="text-[12px] text-muted-foreground p-2">Carregando…</div>
          ) : todas.length === 0 ? (
            <div className="text-[12px] text-muted-foreground p-2">Cadastre etiquetas em Administração.</div>
          ) : (
            <div className="space-y-0.5 max-h-64 overflow-y-auto">
              {todas.map(e => {
                const sel = selecionadas.includes(e.id);
                return (
                  <button key={e.id} type="button" onClick={() => toggle(e.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left text-[12px]">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: e.cor }} />
                    <span className="flex-1">{e.nome}</span>
                    {sel && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
