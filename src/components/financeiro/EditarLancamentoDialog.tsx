import { useEffect, useMemo, useState } from "react";
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
  forma_pagamento_prevista: string | null;
  notas: string | null;
  status: string | null;
  categoria_id?: string | null;
  centro_custo_id?: string | null;
};

export type EditarPayload = {
  data_vencimento: string | null;
  data_pagamento: string | null;
  valor: number;
  forma_pagamento: string | null;
  forma_pagamento_prevista: string | null;
  notas: string | null;
  categoria_id?: string | null;
  centro_custo_id?: string | null;
};

export type CatOption = { id: string; nome: string; tipo?: string | null; parent_id?: string | null; ativo?: boolean | null };
export type CentroOption = { id: string; nome: string; ativo?: boolean | null };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: "entrada" | "saida";
  lanc: EditarLancamentoData | null;
  onSave: (p: EditarPayload) => Promise<void> | void;
  onEstornar?: () => Promise<void> | void;
  cats?: CatOption[];
  centros?: CentroOption[];
};

const FORMAS = ["PIX", "Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Boleto", "Transferência", "Cheque", "Outro"];
export const FORMAS_PREVISTAS = ["PIX", "Boleto", "Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Transferência Bancária", "Cheque", "Permuta", "Outro"];

export default function EditarLancamentoDialog({ open, onOpenChange, tipo, lanc, onSave, onEstornar, cats, centros }: Props) {
  const [dataVenc, setDataVenc] = useState("");
  const [dataPag, setDataPag] = useState("");
  const [valor, setValor] = useState<number>(0);
  const [forma, setForma] = useState<string>("PIX");
  const [formaPrev, setFormaPrev] = useState<string>("");
  const [notas, setNotas] = useState<string>("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [centroCustoId, setCentroCustoId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && lanc) {
      setDataVenc(lanc.data_vencimento || "");
      setDataPag(lanc.data_pagamento || "");
      setValor(Number(lanc.valor || 0));
      setForma(lanc.forma_pagamento || "PIX");
      setFormaPrev(lanc.forma_pagamento_prevista || "");
      setNotas(lanc.notas || "");
      setCategoriaId(lanc.categoria_id || "");
      setCentroCustoId(lanc.centro_custo_id || "");
    }
  }, [open, lanc]);

  const pago = !!lanc && ["pago", "recebido", "conciliado"].includes(lanc.status || "");

  const catTipoEsperado = tipo === "entrada" ? "receita" : "despesa";
  const catsByParent = useMemo(() => {
    const map = new Map<string, string>();
    (cats || []).forEach((c) => map.set(c.id, c.nome));
    return map;
  }, [cats]);

  // Categorias ativas do tipo certo + a categoria atual (mesmo inativa) para preservar histórico
  const catsVisiveis = useMemo(() => {
    if (!cats) return [] as CatOption[];
    const filtered = cats.filter((c) => c.ativo !== false && (!c.tipo || c.tipo === catTipoEsperado));
    if (categoriaId && !filtered.some((c) => c.id === categoriaId)) {
      const atual = cats.find((c) => c.id === categoriaId);
      if (atual) return [atual, ...filtered];
    }
    return filtered;
  }, [cats, catTipoEsperado, categoriaId]);

  const centrosVisiveis = useMemo(() => {
    if (!centros) return [] as CentroOption[];
    const filtered = centros.filter((c) => c.ativo !== false);
    if (centroCustoId && !filtered.some((c) => c.id === centroCustoId)) {
      const atual = centros.find((c) => c.id === centroCustoId);
      if (atual) return [atual, ...filtered];
    }
    return filtered;
  }, [centros, centroCustoId]);

  async function salvar() {
    setSaving(true);
    try {
      await onSave({
        data_vencimento: dataVenc || null,
        data_pagamento: dataPag || null,
        valor: Number(valor) || 0,
        forma_pagamento: forma || null,
        forma_pagamento_prevista: formaPrev || null,
        notas: notas || null,
        categoria_id: cats ? (categoriaId || null) : undefined,
        centro_custo_id: centros ? (centroCustoId || null) : undefined,
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
          {(cats || centros) && (
            <div className="grid grid-cols-2 gap-3">
              {cats && (
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={categoriaId || "__none"} onValueChange={(v) => setCategoriaId(v === "__none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Selecione...</SelectItem>
                      {catsVisiveis.map((c) => {
                        const parentNome = c.parent_id ? catsByParent.get(c.parent_id) : null;
                        const label = parentNome ? `${parentNome} > ${c.nome}` : c.nome;
                        const inativa = c.ativo === false;
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            {label}{inativa ? " (inativa)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {centros && (
                <div className="space-y-1.5">
                  <Label>Centro de Custo</Label>
                  <Select value={centroCustoId || "__none"} onValueChange={(v) => setCentroCustoId(v === "__none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Selecione...</SelectItem>
                      {centrosVisiveis.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}{c.ativo === false ? " (inativo)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
              <Label>Forma de pagamento prevista</Label>
              <Select value={formaPrev || "__none"} onValueChange={(v) => setFormaPrev(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Não informado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Não informado</SelectItem>
                  {FORMAS_PREVISTAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Forma de pagamento {pago ? "(real)" : ""}</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
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
