import { useEffect, useRef, useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ScanBarcode, Truck, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import {
  listarVolumesPedido,
  listarHistoricoExp,
  processarBipExpedicao,
  marcarVolumeProblema,
  resolverProblemaVolume,
  finalizarExpedicao,
  resumirVolumes,
  RESULTADO_EXP_LABEL,
  MOTIVOS_PROBLEMA,
} from "@/lib/fabrica/expedicao";
import { STATUS_VOLUME_LABEL, TIPO_VOLUME_LABEL, statusFabricaBadgeClass, statusFabricaLabel } from "@/lib/fabrica/statusFabrica";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedido: any | null;
  onChanged?: () => void;
}

function volumeBadge(v: any) {
  if (v.problema_expedicao) return "bg-red-100 text-red-800 border-red-200";
  if (v.status === "carregado") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (v.status === "fechado" || v.status === "etiquetado") return "bg-blue-100 text-blue-800 border-blue-200";
  if (v.status === "aberto") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-muted text-foreground border-border";
}

export function ExpedicaoPedidoSheet({ open, onOpenChange, pedido, onChanged }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [codigo, setCodigo] = useState("");
  const [volumes, setVolumes] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  const [problemaVol, setProblemaVol] = useState<any | null>(null);
  const [problemaMotivo, setProblemaMotivo] = useState(MOTIVOS_PROBLEMA[0]);
  const [problemaObs, setProblemaObs] = useState("");

  async function carregar() {
    if (!pedido?.id) return;
    setLoading(true);
    const [v, h] = await Promise.all([
      listarVolumesPedido(pedido.id),
      listarHistoricoExp(pedido.id, 80),
    ]);
    setVolumes(v);
    setHistorico(h);
    setLoading(false);
  }

  useEffect(() => {
    if (open && pedido?.id) {
      carregar();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pedido?.id]);

  const resumo = useMemo(() => resumirVolumes(volumes), [volumes]);

  async function handleBip(e?: React.FormEvent) {
    e?.preventDefault();
    if (!codigo.trim() || !pedido?.id) return;
    setProcessando(true);
    const r = await processarBipExpedicao(pedido.id, codigo);
    setProcessando(false);
    setCodigo("");
    if (r.ok) toast.success(r.mensagem);
    else toast.error(r.mensagem);
    await carregar();
    onChanged?.();
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function confirmarProblema() {
    if (!problemaVol || !pedido?.id) return;
    const motivo = problemaMotivo === "Outro" ? (problemaObs || "Outro") : (problemaObs ? `${problemaMotivo} — ${problemaObs}` : problemaMotivo);
    await marcarVolumeProblema(problemaVol.id, pedido.id, motivo);
    toast.success("Volume marcado com problema");
    setProblemaVol(null);
    setProblemaObs("");
    setProblemaMotivo(MOTIVOS_PROBLEMA[0]);
    await carregar();
    onChanged?.();
  }

  async function resolverProblema(v: any) {
    await resolverProblemaVolume(v.id);
    toast.success("Problema resolvido");
    await carregar();
    onChanged?.();
  }

  async function handleFinalizar() {
    if (!pedido?.id) return;
    setFinalizando(true);
    const r = await finalizarExpedicao(pedido.id);
    setFinalizando(false);
    if (r.ok) {
      toast.success("Expedição finalizada");
      onChanged?.();
      onOpenChange(false);
    } else {
      toast.error(r.erro || "Não foi possível finalizar");
    }
  }

  if (!pedido) return null;

  const podeFinalizar = resumo.total > 0 && resumo.pendentes === 0 && resumo.problemas === 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Expedição — {pedido.codigo || pedido.id?.slice(0, 8)}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <Card className="p-3 text-sm grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div><span className="text-muted-foreground">Cliente:</span> {pedido.cliente?.nome || "—"}</div>
              <div><span className="text-muted-foreground">Loja:</span> {pedido.loja?.nome || "—"}</div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className={statusFabricaBadgeClass(pedido.status_fabrica)}>
                  {statusFabricaLabel(pedido.status_fabrica)}
                </Badge>
              </div>
            </Card>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <Card className="p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-xl font-bold">{resumo.total}</div></Card>
              <Card className="p-3"><div className="text-xs text-muted-foreground">Carregados</div><div className="text-xl font-bold text-emerald-700">{resumo.carregados}</div></Card>
              <Card className="p-3"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-xl font-bold text-amber-700">{resumo.pendentes}</div></Card>
              <Card className="p-3"><div className="text-xs text-muted-foreground">Caixas</div><div className="text-xl font-bold">{resumo.caixas}</div></Card>
              <Card className="p-3"><div className="text-xs text-muted-foreground">Problemas</div><div className="text-xl font-bold text-red-700">{resumo.problemas}</div></Card>
            </div>

            <form onSubmit={handleBip} className="flex gap-2">
              <Input
                ref={inputRef}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Leia o código de barras do volume…"
                className="font-mono"
                autoFocus
                disabled={processando}
              />
              <Button type="submit" disabled={processando || !codigo.trim()}>
                {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanBarcode className="h-4 w-4" />}
                <span className="ml-1 hidden sm:inline">Processar</span>
              </Button>
            </form>

            <Tabs defaultValue="pendentes">
              <TabsList>
                <TabsTrigger value="pendentes">Pendentes ({resumo.pendentes})</TabsTrigger>
                <TabsTrigger value="carregados">Carregados ({resumo.carregados})</TabsTrigger>
                <TabsTrigger value="todos">Todos ({resumo.total})</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
              </TabsList>

              <TabsContent value="pendentes" className="mt-3">
                <ListaVolumes
                  volumes={volumes.filter((v) => v.status !== "carregado")}
                  onProblema={(v) => setProblemaVol(v)}
                  onResolver={resolverProblema}
                  loading={loading}
                />
              </TabsContent>
              <TabsContent value="carregados" className="mt-3">
                <ListaVolumes
                  volumes={volumes.filter((v) => v.status === "carregado")}
                  onProblema={(v) => setProblemaVol(v)}
                  onResolver={resolverProblema}
                  loading={loading}
                />
              </TabsContent>
              <TabsContent value="todos" className="mt-3">
                <ListaVolumes
                  volumes={volumes}
                  onProblema={(v) => setProblemaVol(v)}
                  onResolver={resolverProblema}
                  loading={loading}
                />
              </TabsContent>
              <TabsContent value="historico" className="mt-3">
                <Card className="p-3 max-h-96 overflow-y-auto">
                  {historico.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">Nenhum evento registrado.</div>
                  ) : (
                    <div className="space-y-1 text-xs font-mono">
                      {historico.map((h) => (
                        <div key={h.id} className="flex gap-2 border-b border-border/40 pb-1">
                          <span className="text-muted-foreground shrink-0">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                          <Badge variant="outline" className="text-[10px]">{RESULTADO_EXP_LABEL[h.resultado] || h.resultado}</Badge>
                          <span className="truncate">{h.codigo_bipado || ""} {h.mensagem ? `— ${h.mensagem}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap gap-2 pt-2 sticky bottom-0 bg-background pb-2 border-t">
              <Button onClick={handleFinalizar} disabled={!podeFinalizar || finalizando} className="bg-emerald-600 hover:bg-emerald-700">
                {finalizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span className="ml-1">Finalizar expedição</span>
              </Button>
              {!podeFinalizar && resumo.total > 0 && (
                <span className="text-xs text-muted-foreground self-center">
                  {resumo.pendentes > 0 && `${resumo.pendentes} pendente(s). `}
                  {resumo.problemas > 0 && `${resumo.problemas} com problema.`}
                </span>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} className="ml-auto">Voltar</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!problemaVol} onOpenChange={(o) => !o && setProblemaVol(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar volume com problema</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              Volume <b>{problemaVol?.numero_volume}</b> — {TIPO_VOLUME_LABEL[problemaVol?.tipo_volume] || problemaVol?.tipo_volume}
            </div>
            <div>
              <Label>Motivo</Label>
              <Select value={problemaMotivo} onValueChange={setProblemaMotivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS_PROBLEMA.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observação {problemaMotivo === "Outro" ? "(obrigatória)" : "(opcional)"}</Label>
              <Textarea value={problemaObs} onChange={(e) => setProblemaObs(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProblemaVol(null)}>Cancelar</Button>
            <Button onClick={confirmarProblema} disabled={problemaMotivo === "Outro" && !problemaObs.trim()}>
              <AlertTriangle className="h-4 w-4 mr-1" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ListaVolumes({
  volumes,
  onProblema,
  onResolver,
  loading,
}: {
  volumes: any[];
  onProblema: (v: any) => void;
  onResolver: (v: any) => void;
  loading: boolean;
}) {
  if (loading) {
    return <div className="py-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }
  if (volumes.length === 0) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum volume nesta lista.</Card>;
  }
  return (
    <Card className="divide-y divide-border/50">
      {volumes.map((v) => (
        <div key={v.id} className="p-3 flex items-center gap-3 text-sm">
          <div className="font-bold w-12 text-center">#{v.numero_volume}</div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-xs truncate">{v.codigo_barras}</div>
            <div className="text-xs text-muted-foreground">{TIPO_VOLUME_LABEL[v.tipo_volume] || v.tipo_volume}</div>
            {v.observacao_expedicao && (
              <div className="text-xs text-red-700 mt-1">⚠ {v.observacao_expedicao}</div>
            )}
          </div>
          <Badge variant="outline" className={volumeBadge(v)}>
            {v.problema_expedicao ? "Problema" : STATUS_VOLUME_LABEL[v.status] || v.status}
          </Badge>
          {v.problema_expedicao ? (
            <Button size="sm" variant="outline" onClick={() => onResolver(v)}>
              <X className="h-3 w-3 mr-1" /> Resolver
            </Button>
          ) : v.status !== "carregado" ? (
            <Button size="sm" variant="outline" onClick={() => onProblema(v)}>
              <AlertTriangle className="h-3 w-3 mr-1" /> Problema
            </Button>
          ) : null}
        </div>
      ))}
    </Card>
  );
}
