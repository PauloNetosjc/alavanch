import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PackagePlus, PackageCheck, Printer, AlertTriangle, ScanBarcode, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  caixaAbertaDoPedido,
  criarCaixa,
  fecharCaixa,
  cancelarCaixa,
  processarBipAlmox,
  adicionarItemNaCaixa,
  informarFalta,
  finalizarSeparacaoAlmox,
} from "@/lib/fabrica/almoxarifado";
import { EtiquetaCaixaPreviewDialog } from "./EtiquetaCaixaPreviewDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedido: any | null;
  onChanged?: () => void;
}

const STATUS_ITEM_LABEL: Record<string, string> = {
  pendente: "Pendente",
  separado_parcial: "Parcial",
  separado_completo: "Completo",
  faltante: "Faltante",
  substituido: "Substituído",
};

function statusItemBadge(s: string) {
  switch (s) {
    case "separado_completo": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "separado_parcial": return "bg-amber-100 text-amber-800 border-amber-200";
    case "faltante": return "bg-red-100 text-red-800 border-red-200";
    case "substituido": return "bg-violet-100 text-violet-800 border-violet-200";
    default: return "bg-muted text-foreground border-border";
  }
}

export function AlmoxarifadoPedidoSheet({ open, onOpenChange, pedido, onChanged }: Props) {
  const [itens, setItens] = useState<any[]>([]);
  const [caixas, setCaixas] = useState<any[]>([]);
  const [caixaItens, setCaixaItens] = useState<Record<string, any[]>>({});
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [codigo, setCodigo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [qtdDialog, setQtdDialog] = useState<{ item: any; pendente: number } | null>(null);
  const [qtdValor, setQtdValor] = useState<string>("1");
  const [faltaDialog, setFaltaDialog] = useState<{ item: any } | null>(null);
  const [faltaQtd, setFaltaQtd] = useState("");
  const [faltaObs, setFaltaObs] = useState("");
  const [previewCaixa, setPreviewCaixa] = useState<any | null>(null);

  async function recarregar() {
    if (!pedido?.id) return;
    setLoading(true);
    const [itensRes, caixasRes, histRes] = await Promise.all([
      (supabase as any).from("fabrica_almoxarifado_itens").select("*").eq("pedido_id", pedido.id).order("referencia"),
      (supabase as any).from("fabrica_volumes").select("*").eq("pedido_id", pedido.id).eq("tipo_volume", "caixa_almoxarifado").order("numero_volume"),
      (supabase as any).from("fabrica_almoxarifado_historico").select("*").eq("pedido_id", pedido.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setItens(itensRes.data || []);
    setCaixas(caixasRes.data || []);
    setHistorico(histRes.data || []);

    const caixaIds = (caixasRes.data || []).map((c: any) => c.id);
    if (caixaIds.length) {
      const { data } = await (supabase as any)
        .from("fabrica_volume_almoxarifado_itens")
        .select("*, item:fabrica_almoxarifado_itens(*)")
        .in("volume_id", caixaIds);
      const grouped: Record<string, any[]> = {};
      (data || []).forEach((r: any) => {
        grouped[r.volume_id] = grouped[r.volume_id] || [];
        grouped[r.volume_id].push(r);
      });
      setCaixaItens(grouped);
    } else {
      setCaixaItens({});
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  useEffect(() => {
    if (open && pedido?.id) recarregar();
  }, [open, pedido?.id]);

  const caixaAberta = caixas.find((c) => c.status === "aberto") || null;
  const totalItens = itens.length;
  const completos = itens.filter((i) => i.status === "separado_completo").length;
  const parciais = itens.filter((i) => i.status === "separado_parcial").length;
  const faltantes = itens.filter((i) => i.status === "faltante").length;
  const pendentes = itens.filter((i) => i.status === "pendente").length;

  async function handleBip() {
    const cod = codigo.trim();
    setCodigo("");
    if (!cod) return;
    if (!pedido?.id) return;

    let caixa = caixaAberta || (await caixaAbertaDoPedido(pedido.id));
    if (!caixa) {
      try {
        caixa = await criarCaixa(pedido.id, pedido.codigo);
        toast.success(`Caixa #${caixa.numero_volume} criada.`);
      } catch (e: any) {
        toast.error(e.message || "Erro ao criar caixa");
        return;
      }
    }

    const r = await processarBipAlmox(pedido.id, cod);
    if (!r.ok) {
      toast.error(r.mensagem);
      await recarregar();
      return;
    }
    setQtdValor(String(Math.max(1, r.pendente || 1)));
    setQtdDialog({ item: r.item, pendente: r.pendente || 0 });
  }

  async function confirmarQuantidade() {
    if (!qtdDialog || !pedido?.id) return;
    const qtd = Number(qtdValor);
    if (!qtd || qtd <= 0) { toast.error("Informe uma quantidade válida."); return; }
    if (qtd > qtdDialog.pendente) {
      const ok = window.confirm(`Quantidade (${qtd}) maior que pendente (${qtdDialog.pendente}). Confirmar mesmo assim?`);
      if (!ok) return;
    }
    let caixa = await caixaAbertaDoPedido(pedido.id);
    if (!caixa) caixa = await criarCaixa(pedido.id, pedido.codigo);

    try {
      await adicionarItemNaCaixa({
        pedidoId: pedido.id,
        itemId: qtdDialog.item.id,
        volumeId: caixa.id,
        quantidade: qtd,
      });
      toast.success("Item adicionado à caixa.");
      setQtdDialog(null);
      await recarregar();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    }
  }

  async function handleCriarCaixa() {
    if (!pedido?.id) return;
    if (caixaAberta) {
      const ok = window.confirm(`Fechar a caixa #${caixaAberta.numero_volume} atual antes de criar uma nova?`);
      if (!ok) return;
      const r = await fecharCaixa(caixaAberta.id, pedido.id);
      if (!r.ok) { toast.error(r.mensagem || "Erro"); return; }
    }
    const nova = await criarCaixa(pedido.id, pedido.codigo);
    toast.success(`Caixa #${nova.numero_volume} criada.`);
    await recarregar();
  }

  async function handleFecharCaixa() {
    if (!caixaAberta || !pedido?.id) return;
    const r = await fecharCaixa(caixaAberta.id, pedido.id);
    if (!r.ok) { toast.error(r.mensagem); return; }
    toast.success("Caixa fechada.");
    setPreviewCaixa(caixaAberta);
    await recarregar();
  }

  async function handleCancelarCaixa() {
    if (!caixaAberta || !pedido?.id) return;
    if (!window.confirm("Cancelar caixa atual?")) return;
    await cancelarCaixa(caixaAberta.id, pedido.id);
    toast.success("Caixa cancelada.");
    await recarregar();
  }

  async function handleFinalizar() {
    if (!pedido?.id) return;
    const r = await finalizarSeparacaoAlmox(pedido.id);
    if (!r.ok) { toast.error(r.mensagem); return; }
    toast.success(`Separação finalizada. Status: ${r.status}`);
    await recarregar();
    onChanged?.();
    onOpenChange(false);
  }

  async function confirmarFalta() {
    if (!faltaDialog || !pedido?.id) return;
    await informarFalta({
      pedidoId: pedido.id,
      itemId: faltaDialog.item.id,
      quantidade: faltaQtd ? Number(faltaQtd) : undefined,
      observacao: faltaObs || undefined,
    });
    toast.success("Falta registrada.");
    setFaltaDialog(null);
    setFaltaQtd("");
    setFaltaObs("");
    await recarregar();
    onChanged?.();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ScanBarcode className="h-5 w-5" />
              Almoxarifado · Pedido {pedido?.codigo || pedido?.id?.slice(0, 8)}
            </SheetTitle>
          </SheetHeader>

          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="mt-4 space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Card className="p-3">
                  <div className="text-[11px] text-muted-foreground">Total</div>
                  <div className="text-xl font-semibold">{totalItens}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-[11px] text-muted-foreground">Completos</div>
                  <div className="text-xl font-semibold text-emerald-700">{completos}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-[11px] text-muted-foreground">Parciais</div>
                  <div className="text-xl font-semibold text-amber-700">{parciais}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-[11px] text-muted-foreground">Pendentes</div>
                  <div className="text-xl font-semibold">{pendentes}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-[11px] text-muted-foreground">Faltantes</div>
                  <div className="text-xl font-semibold text-red-700">{faltantes}</div>
                </Card>
              </div>

              {/* Bipagem */}
              <Card className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm font-semibold">
                    Caixa atual: {caixaAberta ? `#${caixaAberta.numero_volume} (${caixaAberta.codigo_barras})` : "—"}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handleCriarCaixa}>
                      <PackagePlus className="h-4 w-4 mr-1" />Nova caixa
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleFecharCaixa} disabled={!caixaAberta}>
                      <PackageCheck className="h-4 w-4 mr-1" />Fechar caixa
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCancelarCaixa} disabled={!caixaAberta}>
                      <X className="h-4 w-4 mr-1" />Cancelar caixa
                    </Button>
                  </div>
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => { e.preventDefault(); handleBip(); }}
                >
                  <Input
                    ref={inputRef}
                    placeholder="Leia o código de barras do item…"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    autoFocus
                  />
                  <Button type="submit">Processar</Button>
                </form>
              </Card>

              <Tabs defaultValue="itens">
                <TabsList>
                  <TabsTrigger value="itens">Itens</TabsTrigger>
                  <TabsTrigger value="caixas">Caixas ({caixas.length})</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>

                <TabsContent value="itens" className="mt-3 space-y-1">
                  {itens.length === 0 && <div className="text-sm text-muted-foreground p-4">Nenhum item de almoxarifado.</div>}
                  {itens.map((it) => {
                    const pend = Math.max(0, Number(it.quantidade_necessaria || 0) - Number(it.quantidade_separada || 0));
                    return (
                      <div key={it.id} className="flex items-center justify-between gap-2 p-2 border rounded-md text-sm">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{it.referencia} <span className="text-muted-foreground font-normal">· {it.descricao || "—"}</span></div>
                          <div className="text-[11px] text-muted-foreground">
                            {it.quantidade_separada || 0} / {it.quantidade_necessaria || 0} {it.unidade || ""} · pendente {pend}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className={statusItemBadge(it.status)}>{STATUS_ITEM_LABEL[it.status] || it.status}</Badge>
                          {it.status !== "separado_completo" && it.status !== "faltante" && (
                            <Button variant="ghost" size="sm" onClick={() => setFaltaDialog({ item: it })}>
                              <AlertTriangle className="h-4 w-4 mr-1" />Falta
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>

                <TabsContent value="caixas" className="mt-3 space-y-2">
                  {caixas.length === 0 && <div className="text-sm text-muted-foreground p-4">Nenhuma caixa criada.</div>}
                  {caixas.map((cx) => (
                    <Card key={cx.id} className="p-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <div className="font-semibold text-sm">Caixa #{cx.numero_volume}</div>
                          <div className="text-[11px] text-muted-foreground">{cx.codigo_barras}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{cx.status}</Badge>
                          <Button variant="outline" size="sm" onClick={() => setPreviewCaixa(cx)}>
                            <Printer className="h-4 w-4 mr-1" />Etiqueta
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1 text-[12px]">
                        {(caixaItens[cx.id] || []).length === 0 && <div className="text-muted-foreground">Sem itens.</div>}
                        {(caixaItens[cx.id] || []).map((r) => (
                          <div key={r.id} className="flex justify-between border-t pt-1">
                            <span>{r.item?.referencia} · {r.item?.descricao || ""}</span>
                            <span className="font-medium">{r.quantidade} {r.item?.unidade || ""}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="historico" className="mt-3 space-y-1">
                  {historico.length === 0 && <div className="text-sm text-muted-foreground p-4">Sem registros.</div>}
                  {historico.map((h) => (
                    <div key={h.id} className="text-[12px] border-l-2 border-muted pl-2 py-1">
                      <div className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")} · {h.resultado}</div>
                      <div>{h.mensagem}</div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button>
                <Button onClick={handleFinalizar}><CheckCircle2 className="h-4 w-4 mr-1" />Finalizar separação</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal qtd */}
      <Dialog open={!!qtdDialog} onOpenChange={(v) => !v && setQtdDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Quantidade colocada na caixa</DialogTitle>
          </DialogHeader>
          {qtdDialog && (
            <div className="space-y-2">
              <div className="text-sm">
                <div className="font-medium">{qtdDialog.item.referencia}</div>
                <div className="text-muted-foreground">{qtdDialog.item.descricao || "—"}</div>
                <div className="text-[12px] text-muted-foreground">Pendente: {qtdDialog.pendente} {qtdDialog.item.unidade || ""}</div>
              </div>
              <Label>Quantidade</Label>
              <Input
                type="number"
                step="any"
                value={qtdValor}
                onChange={(e) => setQtdValor(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") confirmarQuantidade(); }}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQtdDialog(null)}>Cancelar</Button>
            <Button onClick={confirmarQuantidade}>Adicionar à caixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal falta */}
      <Dialog open={!!faltaDialog} onOpenChange={(v) => !v && setFaltaDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Informar falta de item</DialogTitle>
          </DialogHeader>
          {faltaDialog && (
            <div className="space-y-2">
              <div className="text-sm font-medium">{faltaDialog.item.referencia}</div>
              <Label>Quantidade faltante (opcional)</Label>
              <Input type="number" value={faltaQtd} onChange={(e) => setFaltaQtd(e.target.value)} />
              <Label>Observação</Label>
              <Textarea value={faltaObs} onChange={(e) => setFaltaObs(e.target.value)} rows={3} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaltaDialog(null)}>Cancelar</Button>
            <Button onClick={confirmarFalta}>Confirmar falta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview etiqueta caixa */}
      {previewCaixa && (
        <EtiquetaCaixaPreviewDialog
          open={!!previewCaixa}
          onOpenChange={(v) => !v && setPreviewCaixa(null)}
          pedidoId={pedido?.id}
          pedidoCodigo={pedido?.codigo}
          cliente={pedido?.cliente?.nome || pedido?.cliente_nome}
          caixa={previewCaixa}
          itens={(caixaItens[previewCaixa.id] || []).map((r: any) => ({
            referencia: r.item?.referencia || "—",
            descricao: r.item?.descricao,
            quantidade: r.quantidade,
            unidade: r.item?.unidade,
          }))}
        />
      )}
    </>
  );
}
