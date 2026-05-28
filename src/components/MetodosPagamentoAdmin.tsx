import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditCard, Plus, Pencil, Trash2, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type ParcelaConfig = {
  numero: number;
  juros_perc: number;
  /** Pode ser string única (legado) ou lista de formas aceitas */
  forma_pagamento: string | string[];
  desconto_perc: number;
};

/** Normaliza para array de formas (suporta legado string) */
const toFormas = (v: string | string[] | undefined | null): string[] =>
  Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);

type Metodo = {
  id: string;
  nome: string;
  ativo: boolean;
  agrupado: boolean;
  juros_modo: "absorver" | "repassar";
  taxa_perc_parcela: number;
  max_parcelas: number;
  parcelas_config: ParcelaConfig[];
  prazo_recebimento_dias: number;
};

const FORMAS_FALLBACK = ["Boleto", "PIX", "Cartão de Crédito", "Cartão de Débito", "Dinheiro", "Transferência", "Cheque", "Crediário Próprio"];

function blankParcela(numero: number): ParcelaConfig {
  return { numero, juros_perc: 0, forma_pagamento: ["Boleto"], desconto_perc: 0 };
}

export function MetodosPagamentoAdmin() {
  const [rows, setRows] = useState<Metodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Metodo | null>(null);
  const [open, setOpen] = useState(false);
  const [FORMAS, setFORMAS] = useState<string[]>(FORMAS_FALLBACK);

  useEffect(() => {
    supabase.from("formas_pagamento").select("nome").eq("ativo", true).order("ordem").then(({ data }) => {
      const list = (data || []).map((r: any) => r.nome).filter(Boolean);
      if (list.length) setFORMAS(list);
    });
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("metodos_pagamento")
      .select("id, nome, ativo, agrupado, juros_modo, taxa_perc_parcela, max_parcelas, parcelas_config, prazo_recebimento_dias")
      .order("nome");
    if (error) toast.error(error.message);
    setRows(((data ?? []) as any[]).map((r) => ({
      ...r,
      agrupado: !!r.agrupado,
      juros_modo: (r.juros_modo === "absorver" ? "absorver" : "repassar") as Metodo["juros_modo"],
      parcelas_config: Array.isArray(r.parcelas_config) ? r.parcelas_config : [],
      prazo_recebimento_dias: Number(r.prazo_recebimento_dias) || 0,
    })) as Metodo[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing({ id: "", nome: "", ativo: true, agrupado: false, juros_modo: "repassar", taxa_perc_parcela: 0, max_parcelas: 12, parcelas_config: [blankParcela(1)], prazo_recebimento_dias: 0 });
    setOpen(true);
  };

  const openEdit = (m: Metodo) => {
    const parcelas: ParcelaConfig[] = m.parcelas_config.length > 0
      ? m.parcelas_config.map((p) => ({
          numero: p.numero,
          juros_perc: p.juros_perc ?? 0,
          forma_pagamento: toFormas(p.forma_pagamento).length ? toFormas(p.forma_pagamento) : ["Boleto"],
          desconto_perc: p.desconto_perc ?? 0,
        }))
      : Array.from({ length: Math.max(m.max_parcelas, 1) }, (_, i) => ({
          numero: i + 1,
          juros_perc: m.taxa_perc_parcela || 0,
          forma_pagamento: ["Boleto"] as string[],
          desconto_perc: 0,
        }));
    setEditing({ ...m, parcelas_config: parcelas });
    setOpen(true);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload = {
      nome: editing.nome.trim(),
      ativo: editing.ativo,
      agrupado: editing.agrupado,
      juros_modo: editing.juros_modo,
      taxa_perc_parcela: editing.taxa_perc_parcela || 0,
      max_parcelas: editing.parcelas_config.length || 1,
      parcelas_config: editing.parcelas_config as any,
      prazo_recebimento_dias: editing.agrupado ? (Number(editing.prazo_recebimento_dias) || 0) : 0,
    };
    const q = editing.id
      ? supabase.from("metodos_pagamento").update(payload).eq("id", editing.id)
      : supabase.from("metodos_pagamento").insert(payload);
    const { error } = await q;
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    setOpen(false);
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este método de pagamento?")) return;
    const { error } = await supabase.from("metodos_pagamento").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const updateParcela = (idx: number, patch: Partial<ParcelaConfig>) => {
    if (!editing) return;
    const next = [...editing.parcelas_config];
    next[idx] = { ...next[idx], ...patch };
    setEditing({ ...editing, parcelas_config: next });
  };

  const addParcela = () => {
    if (!editing) return;
    const numero = editing.parcelas_config.length + 1;
    setEditing({ ...editing, parcelas_config: [...editing.parcelas_config, blankParcela(numero)] });
  };

  const removeParcela = (idx: number) => {
    if (!editing) return;
    const next = editing.parcelas_config.filter((_, i) => i !== idx).map((p, i) => ({ ...p, numero: i + 1 }));
    setEditing({ ...editing, parcelas_config: next });
  };

  return (
    <div className="surface-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <div>
            <div className="font-semibold uppercase tracking-wider text-[13px]">Métodos de Pagamento</div>
            <div className="text-[11px] text-muted-foreground">Juros, forma e desconto por parcela</div>
          </div>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo</Button>
      </div>

      {loading ? (
        <div className="text-[13px] text-muted-foreground py-6 text-center">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="text-[13px] text-muted-foreground py-6 text-center">Nenhum método cadastrado.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-left text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 px-2">Nome</th>
                <th className="py-2 px-2">Parcelas</th>
                <th className="py-2 px-2">Juros</th>
                <th className="py-2 px-2">Agrupado</th>
                <th className="py-2 px-2">Ativo</th>
                <th className="py-2 px-2 w-24 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">{r.nome}</td>
                  <td className="py-2 px-2">{r.parcelas_config?.length || r.max_parcelas}</td>
                  <td className="py-2 px-2">{r.juros_modo === "absorver" ? "Absorver" : "Repassar"}</td>
                  <td className="py-2 px-2">{r.agrupado ? "Sim" : "Não"}</td>
                  <td className="py-2 px-2">{r.ativo ? "Sim" : "Não"}</td>
                  <td className="py-2 px-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar método" : "Novo método"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label>Nome</Label>
                  <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={editing.ativo} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
                    <span className="text-[13px]">Ativo</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
                  <Switch checked={editing.agrupado} onCheckedChange={(v) => setEditing({ ...editing, agrupado: v })} />
                  <div>
                    <div className="text-[13px] font-medium">Agrupar parcelas no financeiro</div>
                    <div className="text-[11px] text-muted-foreground">
                      {editing.agrupado
                        ? "Cai como uma única parcela agrupada."
                        : "Cai desmembrado, parcela a parcela."}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
                  <Switch
                    checked={editing.juros_modo === "absorver"}
                    onCheckedChange={(v) => setEditing({ ...editing, juros_modo: v ? "absorver" : "repassar" })}
                  />
                  <div>
                    <div className="text-[13px] font-medium">Absorver juros</div>
                    <div className="text-[11px] text-muted-foreground">
                      {editing.juros_modo === "absorver"
                        ? "Loja absorve os juros das parcelas."
                        : "Juros repassados ao cliente."}
                    </div>
                  </div>
                </div>
              </div>

              {editing.agrupado && (
                <div className="p-3 rounded-md border border-border bg-muted/30">
                  <Label className="text-[13px] font-medium">Prazo de recebimento agrupado (dias)</Label>
                  <div className="text-[11px] text-muted-foreground mb-2">
                    Quantidade de dias após a venda/assinatura em que o valor agrupado cairá no financeiro.
                  </div>
                  <Input
                    type="number" min={0} step={1}
                    className="h-9 max-w-[160px]"
                    value={editing.prazo_recebimento_dias ?? 0}
                    onChange={(e) => setEditing({ ...editing, prazo_recebimento_dias: Math.max(0, parseInt(e.target.value || "0", 10) || 0) })}
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Configuração por parcela</Label>
                  <Button size="sm" variant="outline" onClick={addParcela}><Plus className="w-4 h-4 mr-1" /> Adicionar parcela</Button>
                </div>
                <div className="overflow-x-auto border border-border rounded-md">
                  <table className="w-full text-[13px]">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="py-2 px-2 text-left w-16">Parcela</th>
                        <th className="py-2 px-2 text-left">Forma de Pagamento</th>
                        <th className="py-2 px-2 text-left w-28">Juros (%)</th>
                        <th className="py-2 px-2 text-left w-28">Desconto (%)</th>
                        <th className="py-2 px-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editing.parcelas_config.map((p, i) => (
                        <tr key={i} className="border-t border-border/60">
                          <td className="py-1.5 px-2 font-medium">{p.numero}x</td>
                          <td className="py-1.5 px-2">
                            {(() => {
                              const sel = toFormas(p.forma_pagamento);
                              const label = sel.length ? sel.join(", ") : "Selecione...";
                              return (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className="w-full h-8 px-2 rounded-md border border-input bg-background text-[13px] flex items-center justify-between gap-2 text-left"
                                    >
                                      <span className="truncate">{label}</span>
                                      <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-56 p-2" align="start">
                                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-1 pb-1.5">
                                      Formas aceitas
                                    </div>
                                    <div className="space-y-1 max-h-64 overflow-y-auto">
                                      {FORMAS.map((f) => {
                                        const checked = sel.includes(f);
                                        return (
                                          <label key={f} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-[13px]">
                                            <Checkbox
                                              checked={checked}
                                              onCheckedChange={(v) => {
                                                const next = v
                                                  ? Array.from(new Set([...sel, f]))
                                                  : sel.filter((x) => x !== f);
                                                updateParcela(i, { forma_pagamento: next });
                                              }}
                                            />
                                            <span>{f}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            })()}
                          </td>
                          <td className="py-1.5 px-2">
                            <Input
                              type="number" step="0.01" min={0}
                              className="h-8"
                              value={p.juros_perc}
                              onChange={(e) => updateParcela(i, { juros_perc: Number(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <Input
                              type="number" step="0.01" min={0}
                              className="h-8"
                              value={p.desconto_perc}
                              onChange={(e) => updateParcela(i, { desconto_perc: Number(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <Button size="sm" variant="ghost" onClick={() => removeParcela(i)}>
                              <X className="w-4 h-4 text-rose-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
