import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { EtiquetaVolume80x60 } from "./EtiquetaVolume80x60";
import { registrarImpressao } from "@/lib/fabrica/conferencia";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedidoId: string;
  pedidoCodigo?: string;
  cliente?: string;
  projeto?: string;
  volume: any;
  pecas: any[];
}

export function EtiquetaPreviewDialog({ open, onOpenChange, pedidoId, pedidoCodigo, cliente, projeto, volume, pecas }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  async function imprimir() {
    const el = ref.current;
    if (!el) return;
    const html = el.outerHTML;
    const w = window.open("", "_blank", "width=400,height=400");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Etiqueta ${volume?.numero_volume}</title>
      <style>
        @page { size: 80mm 60mm; margin: 0; }
        html,body { margin:0; padding:0; }
        .etiqueta-print { width:80mm !important; height:60mm !important; position: relative; }
      </style>
    </head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 200);
    if (pedidoId && volume?.id) await registrarImpressao(pedidoId, volume.id);
  }

  if (!volume) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Etiqueta · Volume #{volume.numero_volume}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center p-4 bg-muted/30 rounded-md">
          <div style={{ transform: "scale(1.5)", transformOrigin: "top center" }}>
            <EtiquetaVolume80x60
              ref={ref}
              cliente={cliente}
              projeto={projeto}
              pedido={pedidoCodigo}
              volume={volume}
              pecas={pecas}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={imprimir}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
