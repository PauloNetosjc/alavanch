import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRL } from "@/lib/financeiro";

type Conta = { id: string; nome: string; banco?: string | null };

export type BaixaPayload = {
  conta_id: string;
  forma_pagamento: string;
  data_pagamento: string;
  valor: number;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: "entrada" | "saida";
  descricao: string | null;
  valorOriginal: number;
  jurosPrevisto?: number;
  contaIdAtual: string | null;
  contas: Conta[];
  onConfirm: (p: BaixaPayload) => Promise<void> | void;
};

const FORMAS = ["PIX", "Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Boleto", "Transferência", "Cheque", "Outro"];

export const TOLERANCIA_PERC = 2; // tolerância padrão para divergência negativa em baixa

export default function BaixaLancamentoDialog({
  open, onOpenChange, tipo, descricao, valorOriginal, jurosPrevisto = 0, contaIdAtual, contas, onConfirm,
}: Props) {
  const liquidoPrev = Math.max(0, Math.round((Number(valorOriginal) - Number(jurosPrevisto || 0)) * 100) / 100);
  const hoje = new Date().toISOString().slice(0, 10);
  const [contaId, setContaId] = useState<string>("");
  const [forma, setForma] = useState<string>("PIX");
  const [data, setData] = useState<string>(hoje);
  const [valor, setValor] = useState<number>(liquidoPrev);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setContaId(contaIdAtual || contas[0]?.id || "");
      setForma("PIX");
      setData(new Date().toISOString().slice(0, 10));
      setValor(liquidoPrev);
    }
  }, [open, contaIdAtual, liquidoPrev, contas]);


  const titulo = tipo === "entrada" ? "Receber lançamento" : "Pagar lançamento";
  const contaSel = contas.find((c) => c.id === contaId);

  async function confirmar() {
    if (!contaId) return;
    setSaving(true);
    try {
      await onConfirm({ conta_id: contaId, forma_pagamento: forma, data_pagamento: data, valor: Number(valor) || 0 });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {descricao && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Descrição</div>
              <div className="font-medium">{descricao}</div>
              <div className="text-xs text-muted-foreground mt-1">Valor bruto: {BRL(valorOriginal)}</div>
              {jurosPrevisto > 0 && (
                <div className="text-xs text-muted-foreground">Juros/taxa previsto: {BRL(jurosPrevisto)}</div>
              )}
              <div className="text-xs mt-1"><span className="text-muted-foreground">Valor líquido previsto:</span> <span className="font-medium">{BRL(liquidoPrev)}</span></div>
            </div>
          )}
          {(() => {
            const diff = Math.round((Number(valor || 0) - liquidoPrev) * 100) / 100;
            if (Math.abs(diff) < 0.005) return null;
            if (diff > 0) {
              return <div className="rounded-md border border-emerald-300/50 bg-emerald-50/50 p-2 text-[11px] text-emerald-800">Recebimento maior que o previsto em {BRL(diff)}. Será baixado direto.</div>;
            }
            const percDiff = liquidoPrev > 0 ? Math.abs(diff) / liquidoPrev * 100 : 100;
            if (percDiff <= TOLERANCIA_PERC) {
              return <div className="rounded-md border border-amber-300/50 bg-amber-50/50 p-2 text-[11px] text-amber-800">Diferença de {BRL(Math.abs(diff))} ({percDiff.toFixed(2)}%) dentro da tolerância de {TOLERANCIA_PERC}%. Baixa direta.</div>;
            }
            return <div className="rounded-md border border-red-300/50 bg-red-50/50 p-2 text-[11px] text-red-800">Diferença de {BRL(Math.abs(diff))} ({percDiff.toFixed(2)}%) acima da tolerância de {TOLERANCIA_PERC}%. Será enviada para o Aprovador.</div>;
          })()}

          <div className="space-y-1.5">
            <Label>Conta {contaSel?.banco ? <span className="text-muted-foreground font-normal">— {contaSel.banco}</span> : null}</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}{c.banco ? ` — ${c.banco}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={saving || !contaId}>
            {saving ? "Salvando..." : (tipo === "entrada" ? "Confirmar recebimento" : "Confirmar pagamento")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
