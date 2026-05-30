import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ScanBarcode, Printer, AlertTriangle, PackageX, Eraser } from "lucide-react";
import {
  STATUS_PECA_LABEL,
  statusPecaBadgeClass,
  TIPO_VOLUME_LABEL,
  STATUS_VOLUME_LABEL,
  statusFabricaBadgeClass,
  statusFabricaLabel,
} from "@/lib/fabrica/statusFabrica";
import {
  processarBip,
  marcarPecaFaltante,
  marcarPecaAvariada,
  atualizarStatusFabricaSeNecessario,
} from "@/lib/fabrica/conferencia";
import { EtiquetaPreviewDialog } from "./EtiquetaPreviewDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedidoId: string | null;
  onChanged?: () => void;
}

export function ConferenciaPedidoSheet({ open, onOpenChange, pedidoId, onChanged }: Props) {
  const [loading, setLoading] = useState(false);
  const [pedido, setPedido] = useState<any>(null);
  const [pecas, setPecas] = useState<any[]>([]);
  const [volumes, setVolumes] = useState<any[]>([]);
  const [volumePecas, setVolumePecas] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [codigo, setCodigo] = useState("");
  const [processing, setProcessing] = useState(false);
  const [ultimoToast, setUltimoToast] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Modal etiqueta
  const [etiquetaOpen, setEtiquetaOpen] = useState(false);
  const [etiquetaVolume, setEtiquetaVolume] = useState<any>(null);
  const [etiquetaPecas, setEtiquetaPecas] = useState<any[]>([]);

  // Dialog ocorrência
  const [ocOpen, setOcOpen] = useState(false);
  const [ocTipo, setOcTipo] = useState<"faltante" | "avariada">("faltante");
  const [ocPecaId, setOcPecaId] = useState<string>("");
  const [ocObs, setOcObs] = useState("");

  async function carregar() {
    if (!pedidoId) return;
    setLoading(true);
    try {
      const [{ data: p }, { data: pc }, { data: vols }, { data: vp }, { data: hi }] = await Promise.all([
        (supabase as any).from("pedidos").select("id, codigo, status_fabrica, cliente:clientes(nome), loja:lojas(nome)").eq("id", pedidoId).maybeSingle(),
        (supabase as any).from("fabrica_pecas").select("*, modulo:fabrica_modulos(codigo_modulo, nome_modulo, ambiente)").eq("pedido_id", pedidoId).order("created_at"),
        (supabase as any).from("fabrica_volumes").select("*").eq("pedido_id", pedidoId).order("numero_volume"),
        (supabase as any).from("fabrica_volume_pecas").select("*").eq("pedido_id", pedidoId),
        (supabase as any).from("fabrica_conferencia_historico").select("*").eq("pedido_id", pedidoId).order("created_at", { ascending: false }).limit(50),
      ]);
      setPedido(p); setPecas(pc || []); setVolumes(vols || []); setVolumePecas(vp || []); setHistorico(hi || []);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  useEffect(() => {
    if (open && pedidoId) {
      carregar();
      // se status era aguardando_conferencia, atualiza para em_separacao_pecas
      (async () => {
        const { data: p } = await (supabase as any).from("pedidos").select("status_fabrica").eq("id", pedidoId).maybeSingle();
        if (p?.status_fabrica === "aguardando_conferencia") {
          await (supabase as any).from("pedidos").update({ status_fabrica: "em_separacao_pecas" }).eq("id", pedidoId);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pedidoId]);

  const totalPecas = pecas.length;
  const pecasConferidas = pecas.filter((p) => ["conferida", "aguardando_par_embalagem", "embalada"].includes(p.status)).length;
  const pecasEmbaladas = pecas.filter((p) => p.status === "embalada").length;
  const pecasPendentes = pecas.filter((p) => ["aguardando_producao", "produzida"].includes(p.status));
  const ocorrencias = pecas.filter((p) => ["faltante", "avariada", "divergente"].includes(p.status));

  async function processar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!pedidoId || !codigo.trim()) return;
    setProcessing(true);
    try {
      const r = await processarBip(pedidoId, codigo.trim());
      if (r.ok) {
        toast.success(r.mensagem);
        setUltimoToast(r.mensagem);
      } else {
        toast.error(r.mensagem);
        setUltimoToast(r.mensagem);
      }
      if (r.volume) {
        // recarrega para pegar peças do volume e abrir etiqueta
        await carregar();
        const pecasDoVol = (r.volume.pecas || []) as any[];
        setEtiquetaVolume(r.volume);
        setEtiquetaPecas(pecasDoVol);
        setEtiquetaOpen(true);
      } else {
        await carregar();
      }
      await atualizarStatusFabricaSeNecessario(pedidoId);
      onChanged?.();
    } finally {
      setProcessing(false);
      setCodigo("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function abrirEtiquetaVolume(volumeId: string) {
    const vol = volumes.find((v) => v.id === volumeId);
    if (!vol) return;
    const pids = volumePecas.filter((vp) => vp.volume_id === volumeId).map((vp) => vp.peca_id);
    const ps = pecas.filter((p) => pids.includes(p.id));
    setEtiquetaVolume(vol);
    setEtiquetaPecas(ps);
    setEtiquetaOpen(true);
  }

  async function confirmarOcorrencia() {
    if (!pedidoId || !ocPecaId) return;
    if (ocTipo === "faltante") await marcarPecaFaltante(pedidoId, ocPecaId, ocObs);
    else await marcarPecaAvariada(pedidoId, ocPecaId, ocObs);
    setOcOpen(false); setOcObs(""); setOcPecaId("");
    toast.success("Ocorrência registrada");
    carregar();
    onChanged?.();
  }

  const ultimasConferidas = useMemo(
    () => historico.filter((h) => ["volume_criado", "aguardando_par", "peca_conferida"].includes(h.resultado)).slice(0, 10),
    [historico],
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-5xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 flex-wrap">
              <ScanBarcode className="h-5 w-5" /> Conferência · {pedido?.codigo || "—"}
              <Badge variant="outline" className={statusFabricaBadgeClass(pedido?.status_fabrica)}>
                {statusFabricaLabel(pedido?.status_fabrica)}
              </Badge>
            </SheetTitle>
          </SheetHeader>

          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Coluna esquerda — bipping */}
              <div className="lg:col-span-2 space-y-4">
                <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><div className="text-xs text-muted-foreground">Cliente</div><div className="font-medium">{pedido?.cliente?.nome || "—"}</div></div>
                  <div><div className="text-xs text-muted-foreground">Loja</div><div>{pedido?.loja?.nome || "—"}</div></div>
                  <div><div className="text-xs text-muted-foreground">Progresso</div><div className="font-bold">{pecasConferidas} / {totalPecas}</div></div>
                  <div><div className="text-xs text-muted-foreground">Volumes</div><div className="font-bold">{volumes.length}</div></div>
                </Card>

                <Card className="p-4 space-y-2">
                  <form onSubmit={processar} className="space-y-2">
                    <label className="text-sm font-medium">Leia o código de barras da peça</label>
                    <div className="flex gap-2">
                      <Input
                        ref={inputRef}
                        autoFocus
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value)}
                        placeholder="Bipe ou digite o código…"
                        className="font-mono"
                        disabled={processing}
                      />
                      <Button type="submit" disabled={processing || !codigo.trim()}>
                        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Processar"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setCodigo("")}>
                        <Eraser className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                  {ultimoToast && (
                    <div className="text-xs text-muted-foreground border-l-2 border-primary pl-2">{ultimoToast}</div>
                  )}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" variant="outline" onClick={() => { setOcTipo("faltante"); setOcOpen(true); }}>
                      <PackageX className="h-4 w-4 mr-1" /> Peça faltante
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setOcTipo("avariada"); setOcOpen(true); }}>
                      <AlertTriangle className="h-4 w-4 mr-1" /> Peça avariada
                    </Button>
                  </div>
                </Card>

                <Card className="p-0 overflow-hidden">
                  <div className="px-4 py-2 border-b text-sm font-medium">Volumes criados ({volumes.length})</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-left">
                        <tr><th className="p-2">#</th><th className="p-2">Tipo</th><th className="p-2">Status</th><th className="p-2">Peças</th><th className="p-2">Código</th><th className="p-2 w-32"></th></tr>
                      </thead>
                      <tbody>
                        {volumes.map((v) => {
                          const pids = volumePecas.filter((vp) => vp.volume_id === v.id).map((vp) => vp.peca_id);
                          const ps = pecas.filter((p) => pids.includes(p.id));
                          return (
                            <tr key={v.id} className="border-t">
                              <td className="p-2 font-bold">#{v.numero_volume}</td>
                              <td className="p-2">{TIPO_VOLUME_LABEL[v.tipo_volume] || v.tipo_volume}</td>
                              <td className="p-2"><Badge variant="outline">{STATUS_VOLUME_LABEL[v.status] || v.status}</Badge></td>
                              <td className="p-2 text-xs">{ps.map((x) => x.codigo_peca).join(" + ") || v.quantidade_pecas}</td>
                              <td className="p-2 font-mono text-xs">{v.codigo_barras}</td>
                              <td className="p-2 text-right">
                                <Button size="sm" variant="outline" onClick={() => abrirEtiquetaVolume(v.id)}>
                                  <Printer className="h-3.5 w-3.5 mr-1" /> Etiqueta
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                        {volumes.length === 0 && (
                          <tr><td className="p-4 text-center text-muted-foreground" colSpan={6}>Nenhum volume criado ainda.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* Coluna direita — peças e histórico */}
              <div className="space-y-4">
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground mb-1">Resumo</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><div className="text-[10px] text-muted-foreground">Total</div><div className="font-bold">{totalPecas}</div></div>
                    <div><div className="text-[10px] text-muted-foreground">Embaladas</div><div className="font-bold text-emerald-700">{pecasEmbaladas}</div></div>
                    <div><div className="text-[10px] text-muted-foreground">Pendentes</div><div className="font-bold">{pecasPendentes.length}</div></div>
                    <div><div className="text-[10px] text-muted-foreground">Ocorrências</div><div className="font-bold text-red-700">{ocorrencias.length}</div></div>
                  </div>
                </Card>

                <Card className="p-0 overflow-hidden">
                  <div className="px-3 py-2 border-b text-xs font-medium">Últimas leituras</div>
                  <div className="divide-y max-h-[280px] overflow-y-auto">
                    {ultimasConferidas.length === 0 && <div className="p-3 text-xs text-muted-foreground">Nenhuma leitura.</div>}
                    {ultimasConferidas.map((h) => (
                      <div key={h.id} className="px-3 py-1.5 text-xs">
                        <div className="font-mono">{h.codigo_bipado || "—"}</div>
                        <div className="text-muted-foreground">{h.mensagem}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-0 overflow-hidden">
                  <div className="px-3 py-2 border-b text-xs font-medium">Peças pendentes ({pecasPendentes.length})</div>
                  <div className="divide-y max-h-[260px] overflow-y-auto">
                    {pecasPendentes.slice(0, 30).map((p) => (
                      <div key={p.id} className="px-3 py-1.5 text-xs flex items-center justify-between">
                        <div>
                          <div className="font-mono">{p.codigo_peca}</div>
                          <div className="text-muted-foreground">{p.descricao || "—"}</div>
                        </div>
                        <Badge variant="outline" className={statusPecaBadgeClass(p.status)}>
                          {STATUS_PECA_LABEL[p.status] || p.status}
                        </Badge>
                      </div>
                    ))}
                    {pecasPendentes.length === 0 && <div className="p-3 text-xs text-muted-foreground">Sem peças pendentes.</div>}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <EtiquetaPreviewDialog
        open={etiquetaOpen}
        onOpenChange={setEtiquetaOpen}
        pedidoId={pedidoId || ""}
        pedidoCodigo={pedido?.codigo}
        cliente={pedido?.cliente?.nome}
        projeto={etiquetaPecas[0]?.modulo?.ambiente || undefined}
        volume={etiquetaVolume}
        pecas={etiquetaPecas}
      />

      <Dialog open={ocOpen} onOpenChange={setOcOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informar peça {ocTipo === "faltante" ? "FALTANTE" : "AVARIADA"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Peça</label>
              <Select value={ocPecaId} onValueChange={setOcPecaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a peça" /></SelectTrigger>
                <SelectContent>
                  {pecas.filter((p) => p.status !== "embalada").map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.codigo_peca} · {p.descricao || ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Observação</label>
              <Textarea value={ocObs} onChange={(e) => setOcObs(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOcOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarOcorrencia} disabled={!ocPecaId}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
