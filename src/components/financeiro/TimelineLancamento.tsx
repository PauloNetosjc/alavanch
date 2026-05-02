import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock } from "lucide-react";

type Evento = {
  id: string;
  tipo: string;
  descricao: string | null;
  created_at: string;
  metadata: any;
};

export function TimelineLancamento({ lancamentoId }: { lancamentoId: string }) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("timeline_eventos")
        .select("id, tipo, descricao, created_at, metadata")
        .eq("entidade_tipo", "lancamento_financeiro")
        .eq("entidade_id", lancamentoId)
        .order("created_at", { ascending: false });
      setEventos((data as Evento[]) || []);
      setLoading(false);
    })();
  }, [lancamentoId]);

  if (loading) return <div className="text-xs text-muted-foreground">Carregando histórico…</div>;
  if (!eventos.length)
    return <div className="text-xs text-muted-foreground">Nenhum evento registrado.</div>;

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {eventos.map((e) => (
        <div key={e.id} className="flex gap-2 items-start border-l-2 border-primary/30 pl-3 py-1">
          <Clock className="w-3 h-3 text-muted-foreground mt-1 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium">{e.descricao || e.tipo}</div>
            <div className="text-[10px] text-muted-foreground">
              {new Date(e.created_at).toLocaleString("pt-BR")}
            </div>
            {e.metadata && Object.keys(e.metadata).length > 0 && (
              <pre className="text-[10px] text-muted-foreground/70 mt-1 whitespace-pre-wrap break-words">
                {JSON.stringify(e.metadata, null, 0).slice(0, 200)}
              </pre>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
