import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SaasLancamento, SaasConta, SaasForma } from "./saasFinTypes";

export function BaixaLancamentoSaaSDialog({
  lanc, contas, formas, onClose, onSaved,
}: {
  lanc: SaasLancamento;
  contas: SaasConta[];
  formas: SaasForma[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const acao = lanc.tipo === "receita" ? "Receber" : "Pagar";
  const [data, setData] = useState({
    data_pagamento: new Date().toISOString().slice(0, 10),
    conta_bancaria_id: lanc.conta_bancaria_id || "",
    forma_pagamento_real: lanc.forma_pagamento_real || lanc.forma_pagamento_prevista || "",
    valor: Number(lanc.valor || 0),
    observacoes: lanc.observacoes || "",
  });
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("saas_lancamentos_financeiros" as any)
      .update({
        status: "pago",
        data_pagamento: data.data_pagamento,
        conta_bancaria_id: data.conta_bancaria_id || null,
        forma_pagamento_real: data.forma_pagamento_real || null,
        valor: data.valor,
        observacoes: data.observacoes || null,
      })
      .eq("id", lanc.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }

    // se vinculado a cobrança, propaga para base_cobrancas
    if (lanc.cobranca_id) {
      await supabase
        .from("base_cobrancas" as any)
        .update({
          status: "pago",
          data_pagamento: data.data_pagamento,
          forma_pagamento: data.forma_pagamento_real || null,
        })
        .eq("id", lanc.cobranca_id);
    }
    toast.success(`Lançamento dado baixa (${acao.toLowerCase()})`);
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{acao} lançamento</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label className="text-xs">Data do {acao.toLowerCase()}imento</Label>
            <Input type="date" value={data.data_pagamento} onChange={(e) => setData({ ...data, data_pagamento: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Conta bancária SaaS</Label>
            <Select value={data.conta_bancaria_id} onValueChange={(v) => setData({ ...data, conta_bancaria_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {contas.filter((c) => c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Forma de pagamento real</Label>
            <Select value={data.forma_pagamento_real} onValueChange={(v) => setData({ ...data, forma_pagamento_real: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {formas.filter((f) => f.ativo).map((f) => <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Valor {lanc.tipo === "receita" ? "recebido" : "pago"}</Label>
            <Input type="number" step="0.01" value={data.valor} onChange={(e) => setData({ ...data, valor: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={data.observacoes} onChange={(e) => setData({ ...data, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>Confirmar {acao.toLowerCase()}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
