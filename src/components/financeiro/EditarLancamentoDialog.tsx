import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw } from "lucide-react";

export type EditarLancamentoData = {
  id: string;
  descricao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  valor: number;
  forma_pagamento: string | null;
  notas: string | null;
  status: string | null;
};

export type EditarPayload = {
  data_vencimento: string | null;
  data_pagamento: string | null;
  valor: number;
  forma_pagamento: string | null;
  notas: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: "entrada" | "saida";
  lanc: EditarLancamentoData | null;
  onSave: (p: EditarPayload) => Promise<void> | void;
  onEstornar?: () => Promise<void> | void;
};

const FORMAS = ["PIX", "Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Boleto", "Transferência", "Cheque", "Outro"];

export default function EditarLancamentoDialog({ open, onOpenChange, tipo, lanc, onSave, onEstornar }: Props) {
  const [dataVenc, setDataVenc] = useState("");
  const [dataPag, setDataPag] = useState("");
  const [valor, setValor] = useState<number>(0);
  const [forma, setForma] = useState<string>("PIX");
  const [notas, setNotas] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && lanc) {
      setDataVenc(lanc.data_vencimento || "");
      setDataPag(lanc.data_pagamento || "");
      setValor(Number(lanc.valor || 0));
      setForma(lanc.forma_pagamento || "PIX");
      setNotas(lanc.notas || "");
    }
  }, [open, lanc]);

  const pago = !!lanc && ["pago", "recebido", "conciliado"].includes(lanc.status || "");

  async function salvar() {
    setSaving(true);
    try {
      await onSave({
        data_vencimento: dataVenc || null,
        data_pagamento: dataPag || null,
        valor: Number(valor) || 0,
        forma_pagamento: forma || null,
        notas: notas || null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function estornar() {
    if (!onEstornar) return;
    setSaving(true);
    try {
      await onEstornar();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar {tipo === "entrada" ? "recebimento" : "pagamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {lanc?.descricao && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Descrição</div>
              <div className="font-medium">{lanc.descricao}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input type="date" value={dataVenc} onChange={(e) => setDataVenc(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data {tipo === "entrada" ? "recebimento" : "pagamento"}</Label>
              <Input type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observações internas sobre esta parcela…" />
          </div>
          {pago && onEstornar && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50/50 p-3 text-xs flex items-center justify-between gap-2">
              <span className="text-amber-800">Esta parcela está baixada. Você pode estornar.</span>
              <Button type="button" size="sm" variant="outline" className="text-amber-700 border-amber-300" onClick={estornar} disabled={saving}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Estornar
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
