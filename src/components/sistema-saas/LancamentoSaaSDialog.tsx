import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { SaasLancamento, SaasCategoria, SaasCentro, SaasConta, SaasForma } from "./saasFinTypes";

type Base = { id: string; nome: string; sistema_saas_id: string | null };

export function LancamentoSaaSDialog({
  tipo, lanc, bases, categorias, centros, contas, formas, onClose, onSaved,
}: {
  tipo: "receita" | "despesa";
  lanc: SaasLancamento | null;
  bases: Base[];
  categorias: SaasCategoria[];
  centros: SaasCentro[];
  contas: SaasConta[];
  formas: SaasForma[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [d, setD] = useState<Partial<SaasLancamento>>(
    lanc || {
      tipo,
      origem: "manual",
      status: "pendente",
      valor: 0,
      data_vencimento: new Date().toISOString().slice(0, 10),
      data_competencia: new Date().toISOString().slice(0, 10),
    }
  );
  useEffect(() => {
    if (lanc) setD(lanc);
  }, [lanc]);

  const editavel = d.status !== "pago";

  const salvar = async () => {
    if (!d.descricao || !d.valor) { toast.error("Preencha descrição e valor"); return; }
    const payload: any = {
      tipo: d.tipo || tipo,
      origem: d.origem || "manual",
      base_cliente_id: d.base_cliente_id || null,
      fornecedor_nome: d.fornecedor_nome || null,
      descricao: d.descricao,
      categoria_id: d.categoria_id || null,
      centro_custo_id: d.centro_custo_id || null,
      conta_bancaria_id: d.conta_bancaria_id || null,
      forma_pagamento_prevista: d.forma_pagamento_prevista || null,
      valor: d.valor,
      data_competencia: d.data_competencia || null,
      data_vencimento: d.data_vencimento || null,
      observacoes: d.observacoes || null,
    };
    let err;
    if (lanc?.id) {
      ({ error: err } = await supabase
        .from("saas_lancamentos_financeiros" as any)
        .update({ ...payload, atualizado_por: user?.id ?? null })
        .eq("id", lanc.id));
    } else {
      ({ error: err } = await supabase
        .from("saas_lancamentos_financeiros" as any)
        .insert({ ...payload, criado_por: user?.id ?? null }));
    }
    if (err) { toast.error(err.message); return; }
    toast.success("Lançamento salvo");
    onSaved(); onClose();
  };

  const catsTipo = categorias.filter((c) => c.tipo === (d.tipo || tipo) && c.ativo);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lanc ? "Editar" : "Novo"} lançamento — {tipo === "receita" ? "A Receber" : "A Pagar"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {tipo === "receita" ? (
            <div className="col-span-2">
              <Label className="text-xs">Base / Cliente</Label>
              <Select value={d.base_cliente_id || ""} onValueChange={(v) => setD({ ...d, base_cliente_id: v })} disabled={!editavel}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="col-span-2">
              <Label className="text-xs">Fornecedor / Contato</Label>
              <Input value={d.fornecedor_nome || ""} onChange={(e) => setD({ ...d, fornecedor_nome: e.target.value })} disabled={!editavel} />
            </div>
          )}

          <div className="col-span-2">
            <Label className="text-xs">Descrição</Label>
            <Input value={d.descricao || ""} onChange={(e) => setD({ ...d, descricao: e.target.value })} disabled={!editavel} />
          </div>

          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={d.categoria_id || ""} onValueChange={(v) => setD({ ...d, categoria_id: v })} disabled={!editavel}>
              <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
              <SelectContent>{catsTipo.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Centro de Custo</Label>
            <Select value={d.centro_custo_id || ""} onValueChange={(v) => setD({ ...d, centro_custo_id: v })} disabled={!editavel}>
              <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
              <SelectContent>{centros.filter((c) => c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Conta bancária prevista</Label>
            <Select value={d.conta_bancaria_id || ""} onValueChange={(v) => setD({ ...d, conta_bancaria_id: v })} disabled={!editavel}>
              <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
              <SelectContent>{contas.filter((c) => c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Forma pgto. prevista</Label>
            <Select value={d.forma_pagamento_prevista || ""} onValueChange={(v) => setD({ ...d, forma_pagamento_prevista: v })} disabled={!editavel}>
              <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
              <SelectContent>{formas.filter((f) => f.ativo).map((f) => <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Valor</Label>
            <Input type="number" step="0.01" value={d.valor || 0} onChange={(e) => setD({ ...d, valor: Number(e.target.value) })} disabled={!editavel} />
          </div>
          <div>
            <Label className="text-xs">Competência</Label>
            <Input type="date" value={d.data_competencia || ""} onChange={(e) => setD({ ...d, data_competencia: e.target.value })} disabled={!editavel} />
          </div>
          <div>
            <Label className="text-xs">Vencimento</Label>
            <Input type="date" value={d.data_vencimento || ""} onChange={(e) => setD({ ...d, data_vencimento: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea value={d.observacoes || ""} onChange={(e) => setD({ ...d, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
