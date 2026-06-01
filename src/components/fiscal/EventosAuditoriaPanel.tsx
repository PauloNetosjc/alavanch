import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Loader2 } from "lucide-react";

type Ev = {
  id: string; nota_fiscal_id: string; tipo_evento: string;
  status_anterior: string | null; status_novo: string | null;
  codigo_retorno: string | null; mensagem: string | null;
  protocolo: string | null; created_at: string;
  nota?: { numero: string | null; tipo: string } | null;
};

export function EventosAuditoriaPanel() {
  const { selectedLojaId } = useLoja();
  const [evs, setEvs] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedLojaId) return;
    setLoading(true);
    (async () => {
      const { data: notasDaLoja } = await supabase
        .from("notas_fiscais" as any).select("id,numero,tipo").eq("loja_id", selectedLojaId);
      const ids = (notasDaLoja || []).map((n: any) => n.id);
      const mapa = new Map<string, any>((notasDaLoja || []).map((n: any) => [n.id, n]));
      if (ids.length === 0) { setEvs([]); setLoading(false); return; }
      const { data } = await supabase
        .from("notas_fiscais_eventos" as any)
        .select("*")
        .in("nota_fiscal_id", ids)
        .order("created_at", { ascending: false })
        .limit(200);
      const enriched = ((data || []) as any[]).map((e) => ({ ...e, nota: mapa.get(e.nota_fiscal_id) || null }));
      setEvs(enriched as any);
      setLoading(false);
    })();
  }, [selectedLojaId]);

  if (!selectedLojaId) return <Card className="p-6 text-sm text-muted-foreground">Selecione uma loja no topo.</Card>;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-display flex items-center gap-2"><History className="w-5 h-5"/> Eventos e Auditoria</h2>
      <Card className="p-3">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>
        ) : evs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum evento registrado ainda.</div>
        ) : (
          <ul className="divide-y">
            {evs.map((e) => (
              <li key={e.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {e.nota ? `${e.nota.tipo.toUpperCase()} ${e.nota.numero || "(sem número)"}` : "Nota removida"}
                      <Badge variant="outline" className="text-[10px]">{e.tipo_evento}</Badge>
                    </div>
                    {e.mensagem && <div className="text-xs text-muted-foreground mt-0.5">{e.mensagem}</div>}
                    {(e.status_anterior || e.status_novo) && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {e.status_anterior || "—"} → <strong>{e.status_novo || "—"}</strong>
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground text-right">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                    {e.protocolo && <div>Protocolo: {e.protocolo}</div>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
