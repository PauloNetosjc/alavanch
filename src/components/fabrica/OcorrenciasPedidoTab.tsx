import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import {
  listarOcorrencias,
  TIPO_OCORRENCIA_LABEL,
  SETOR_LABEL,
  PRIORIDADE_LABEL,
  STATUS_OCORRENCIA_LABEL,
  prioridadeBadge,
  statusOcorrenciaBadge,
} from "@/lib/fabrica/ocorrencias";
import { NovaOcorrenciaDialog } from "./NovaOcorrenciaDialog";
import { OcorrenciaDetalheSheet } from "./OcorrenciaDetalheSheet";

export function OcorrenciasPedidoTab({ pedidoId }: { pedidoId: string | null }) {
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState<any[]>([]);
  const [novaOpen, setNovaOpen] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  async function carregar() {
    if (!pedidoId) return;
    setLoading(true);
    try { setLista(await listarOcorrencias({ pedidoId })); }
    finally { setLoading(false); }
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [pedidoId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{lista.length} ocorrência(s)</div>
        <Button size="sm" onClick={() => setNovaOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova ocorrência</Button>
      </div>
      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : lista.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Sem ocorrências registradas.</Card>
      ) : (
        <Card className="divide-y divide-border/50">
          {lista.map((o) => (
            <div key={o.id} className="p-3 flex items-center gap-3 text-sm">
              <div className="font-mono text-xs w-28 shrink-0">{o.codigo}</div>
              <div className="flex-1 min-w-0">
                <div className="truncate">{o.titulo}</div>
                <div className="text-xs text-muted-foreground">{TIPO_OCORRENCIA_LABEL[o.tipo_ocorrencia]} · {SETOR_LABEL[o.setor_responsavel]}</div>
              </div>
              <Badge variant="outline" className={prioridadeBadge(o.prioridade)}>{PRIORIDADE_LABEL[o.prioridade]}</Badge>
              <Badge variant="outline" className={statusOcorrenciaBadge(o.status)}>{STATUS_OCORRENCIA_LABEL[o.status]}</Badge>
              <Button size="sm" variant="outline" onClick={() => setAberta(o.id)}>Ver</Button>
            </div>
          ))}
        </Card>
      )}
      <NovaOcorrenciaDialog open={novaOpen} onOpenChange={setNovaOpen} pedidoId={pedidoId} onCreated={carregar} />
      <OcorrenciaDetalheSheet ocorrenciaId={aberta} onOpenChange={(o) => !o && setAberta(null)} onChanged={carregar} />
    </div>
  );
}
