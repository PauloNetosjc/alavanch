import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useComunicadosSaaS, type Comunicado } from "@/hooks/useComunicadosSaaS";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnexoView } from "./AnexoView";

const tipoLabel: Record<string, string> = {
  novidade: "Novidade", aviso: "Aviso", manutencao: "Manutenção", financeiro: "Financeiro",
  treinamento: "Treinamento", sistema: "Sistema", urgente: "Urgente", outro: "Outro",
};
const prioColor: Record<string, string> = {
  critica: "bg-red-100 text-red-800",
  alta: "bg-amber-100 text-amber-800",
  normal: "bg-blue-100 text-blue-800",
  baixa: "bg-zinc-100 text-zinc-700",
};

export function ComunicadoPopup() {
  const { user } = useAuth();
  const { popupQueue, registrarFechamento } = useComunicadosSaaS();
  const [current, setCurrent] = useState<Comunicado | null>(null);

  useEffect(() => {
    if (!current && popupQueue.length > 0) setCurrent(popupQueue[0]);
  }, [popupQueue, current]);

  if (!user || !current) return null;

  const handleClose = async (marcarLido: boolean) => {
    await registrarFechamento(current.id, marcarLido);
    setCurrent(null);
  };

  return (
    <Dialog open={!!current} onOpenChange={(o) => { if (!o && current.permitir_fechar) handleClose(false); }}>
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={(e) => { if (!current.permitir_fechar) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!current.permitir_fechar) e.preventDefault(); }}
      >
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px]">{tipoLabel[current.tipo] || current.tipo}</Badge>
            <Badge className={`${prioColor[current.prioridade] || ""} border-0 capitalize text-[10px]`}>
              {current.prioridade}
            </Badge>
          </div>
          <DialogTitle className="text-xl font-display">{current.titulo}</DialogTitle>
        </DialogHeader>
        <div className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
          {current.mensagem}
        </div>
        <AnexoView c={current} />
        {current.link_url && (
          <a href={current.link_url} target="_blank" rel="noreferrer" className="text-[12px] text-primary underline">
            Saiba mais →
          </a>
        )}
        <div className="text-[11px] text-muted-foreground">
          {new Date(current.created_at).toLocaleString("pt-BR")}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          {current.permitir_fechar ? (
            <Button variant="outline" onClick={() => handleClose(false)}>Fechar</Button>
          ) : null}
          <Button onClick={() => handleClose(true)}>
            {current.permitir_fechar ? "Marcar como lido" : "Confirmar leitura"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
