import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Paperclip, Trash2, Download, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  alterarStatus,
  listarHistoricoOcorrencia,
  listarAnexosOcorrencia,
  uploadAnexo,
  urlAssinadaAnexo,
  removerAnexo,
  retomarFluxo,
  TIPO_OCORRENCIA_LABEL,
  SETOR_LABEL,
  PRIORIDADE_LABEL,
  STATUS_OCORRENCIA_LABEL,
  prioridadeBadge,
  statusOcorrenciaBadge,
  StatusOcorrencia,
} from "@/lib/fabrica/ocorrencias";
import { statusFabricaBadgeClass, statusFabricaLabel } from "@/lib/fabrica/statusFabrica";

interface Props {
  ocorrenciaId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const STATUS_RETOMAR = [
  "aguardando_conferencia",
  "em_separacao_pecas",
  "aguardando_almoxarifado",
  "em_separacao_almoxarifado",
  "pronto_para_expedicao",
];

export function OcorrenciaDetalheSheet({ ocorrenciaId, onOpenChange, onChanged }: Props) {
  const [loading, setLoading] = useState(false);
  const [oc, setOc] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [anexos, setAnexos] = useState<any[]>([]);
  const [pecaInfo, setPecaInfo] = useState<any>(null);
  const [almoxInfo, setAlmoxInfo] = useState<any>(null);
  const [volumeInfo, setVolumeInfo] = useState<any>(null);
  const inputFile = useRef<HTMLInputElement>(null);

  const [statusDialog, setStatusDialog] = useState<StatusOcorrencia | null>(null);
  const [statusObs, setStatusObs] = useState("");
  const [statusSolucao, setStatusSolucao] = useState("");

  const [retomarOpen, setRetomarOpen] = useState(false);
  const [novoStatus, setNovoStatus] = useState<string>(STATUS_RETOMAR[0]);

  async function carregar() {
    if (!ocorrenciaId) return;
    setLoading(true);
    try {
      const { data: o } = await (supabase as any)
        .from("fabrica_ocorrencias")
        .select("*, pedido:pedidos(id, codigo, status_fabrica, status_fabrica_anterior, cliente:clientes(nome), loja:lojas(nome))")
        .eq("id", ocorrenciaId).maybeSingle();
      setOc(o);
      setHistorico(await listarHistoricoOcorrencia(ocorrenciaId));
      setAnexos(await listarAnexosOcorrencia(ocorrenciaId));

      if (o?.peca_id) {
        const { data } = await (supabase as any).from("fabrica_pecas").select("*").eq("id", o.peca_id).maybeSingle();
        setPecaInfo(data);
      } else setPecaInfo(null);
      if (o?.almoxarifado_item_id) {
        const { data } = await (supabase as any).from("fabrica_almoxarifado_itens").select("*").eq("id", o.almoxarifado_item_id).maybeSingle();
        setAlmoxInfo(data);
      } else setAlmoxInfo(null);
      if (o?.volume_id) {
        const { data } = await (supabase as any).from("fabrica_volumes").select("*").eq("id", o.volume_id).maybeSingle();
        setVolumeInfo(data);
      } else setVolumeInfo(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ocorrenciaId) carregar();
    // eslint-disable-next-line
  }, [ocorrenciaId]);

  async function confirmarStatus() {
    if (!ocorrenciaId || !statusDialog) return;
    if ((statusDialog === "resolvida" || statusDialog === "cancelada") && !statusObs.trim()) {
      toast.error("Informe a observação obrigatória");
      return;
    }
    await alterarStatus(ocorrenciaId, statusDialog, statusObs.trim() || undefined, statusSolucao.trim() || undefined);
    toast.success("Status atualizado");
    setStatusDialog(null);
    setStatusObs("");
    setStatusSolucao("");
    await carregar();
    onChanged?.();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !ocorrenciaId) return;
    try {
      await uploadAnexo(ocorrenciaId, file);
      toast.success("Anexo enviado");
      await carregar();
    } catch (err: any) {
      toast.error(err.message || "Erro no upload");
    } finally {
      if (inputFile.current) inputFile.current.value = "";
    }
  }

  async function baixarAnexo(a: any) {
    const url = await urlAssinadaAnexo(a.url_arquivo);
    if (url) window.open(url, "_blank");
  }

  async function excluirAnexo(a: any) {
    if (!confirm("Remover este anexo?")) return;
    await removerAnexo(a.id, a.url_arquivo);
    await carregar();
  }

  async function confirmarRetomar() {
    if (!oc?.pedido_id) return;
    await retomarFluxo(oc.pedido_id, novoStatus);
    toast.success("Fluxo retomado");
    setRetomarOpen(false);
    await carregar();
    onChanged?.();
  }

  return (
    <Sheet open={!!ocorrenciaId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span>{oc?.codigo || "Ocorrência"}</span>
            {oc && (
              <>
                <Badge variant="outline" className={statusOcorrenciaBadge(oc.status)}>{STATUS_OCORRENCIA_LABEL[oc.status] || oc.status}</Badge>
                <Badge variant="outline" className={prioridadeBadge(oc.prioridade)}>{PRIORIDADE_LABEL[oc.prioridade] || oc.prioridade}</Badge>
                {oc.bloqueante && <Badge variant="destructive">Bloqueante</Badge>}
              </>
            )}
          </SheetTitle>
        </SheetHeader>

        {loading || !oc ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["em_analise","em_reproducao","aguardando_compra","aguardando_resolucao"] as StatusOcorrencia[]).map((s) => (
                <Button key={s} size="sm" variant="outline" disabled={oc.status === s || oc.status === "resolvida" || oc.status === "cancelada"} onClick={() => { setStatusDialog(s); setStatusObs(""); }}>
                  {STATUS_OCORRENCIA_LABEL[s]}
                </Button>
              ))}
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={oc.status === "resolvida"} onClick={() => { setStatusDialog("resolvida"); setStatusObs(""); setStatusSolucao(""); }}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Resolver
              </Button>
              <Button size="sm" variant="outline" disabled={oc.status === "cancelada"} onClick={() => { setStatusDialog("cancelada"); setStatusObs(""); }}>
                Cancelar
              </Button>
              {oc.pedido?.status_fabrica_anterior && oc.status === "resolvida" && (
                <Button size="sm" variant="outline" onClick={() => { setNovoStatus(oc.pedido.status_fabrica_anterior); setRetomarOpen(true); }}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Retomar fluxo
                </Button>
              )}
            </div>

            <Tabs defaultValue="dados">
              <TabsList>
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="pedido">Pedido</TabsTrigger>
                <TabsTrigger value="vinculo">Peça/Item/Volume</TabsTrigger>
                <TabsTrigger value="anexos">Anexos ({anexos.length})</TabsTrigger>
                <TabsTrigger value="historico">Histórico ({historico.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-3">
                <Card className="p-4 grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-muted-foreground">Tipo</div><div>{TIPO_OCORRENCIA_LABEL[oc.tipo_ocorrencia] || oc.tipo_ocorrencia}</div></div>
                  <div><div className="text-xs text-muted-foreground">Setor responsável</div><div>{SETOR_LABEL[oc.setor_responsavel] || oc.setor_responsavel}</div></div>
                  <div><div className="text-xs text-muted-foreground">Prioridade</div><div>{PRIORIDADE_LABEL[oc.prioridade] || oc.prioridade}</div></div>
                  <div><div className="text-xs text-muted-foreground">Status</div><div>{STATUS_OCORRENCIA_LABEL[oc.status] || oc.status}</div></div>
                  <div><div className="text-xs text-muted-foreground">Quantidade afetada</div><div>{oc.quantidade_afetada ?? "—"}</div></div>
                  <div><div className="text-xs text-muted-foreground">Aberta em</div><div>{new Date(oc.data_abertura).toLocaleString("pt-BR")}</div></div>
                  <div><div className="text-xs text-muted-foreground">Previsão</div><div>{oc.data_previsao_resolucao ? new Date(oc.data_previsao_resolucao).toLocaleDateString("pt-BR") : "—"}</div></div>
                  <div><div className="text-xs text-muted-foreground">Resolvida em</div><div>{oc.data_resolucao ? new Date(oc.data_resolucao).toLocaleString("pt-BR") : "—"}</div></div>
                </Card>
                <Card className="p-4 space-y-2">
                  <div className="text-sm font-medium">{oc.titulo}</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{oc.descricao || "Sem descrição."}</div>
                  {oc.solucao_descricao && (
                    <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded text-sm">
                      <div className="text-xs text-emerald-700 mb-1 font-medium">Solução</div>
                      <div className="whitespace-pre-wrap">{oc.solucao_descricao}</div>
                    </div>
                  )}
                  {oc.observacoes && (
                    <div className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">Obs.: {oc.observacoes}</div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="pedido">
                <Card className="p-4 text-sm space-y-2">
                  <div><span className="text-muted-foreground">Pedido:</span> <b>{oc.pedido?.codigo || oc.pedido_id.slice(0,8)}</b></div>
                  <div><span className="text-muted-foreground">Cliente:</span> {oc.pedido?.cliente?.nome || "—"}</div>
                  <div><span className="text-muted-foreground">Loja:</span> {oc.pedido?.loja?.nome || "—"}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Status fábrica:</span>
                    <Badge variant="outline" className={statusFabricaBadgeClass(oc.pedido?.status_fabrica)}>{statusFabricaLabel(oc.pedido?.status_fabrica)}</Badge>
                  </div>
                  {oc.pedido?.status_fabrica_anterior && (
                    <div className="text-xs text-muted-foreground">Status anterior: {statusFabricaLabel(oc.pedido.status_fabrica_anterior)}</div>
                  )}
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/fabrica?aba=producao-pedido&pedido=${oc.pedido_id}`} target="_blank" rel="noreferrer">Abrir Produção por Pedido</a>
                  </Button>
                </Card>
              </TabsContent>

              <TabsContent value="vinculo">
                <Card className="p-4 text-sm space-y-3">
                  {pecaInfo && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Peça vinculada</div>
                      <div className="font-mono">{pecaInfo.codigo_peca || pecaInfo.id.slice(0,8)}</div>
                      <div className="text-xs">{pecaInfo.descricao || "—"} — {pecaInfo.status}</div>
                    </div>
                  )}
                  {almoxInfo && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Item de almoxarifado</div>
                      <div className="font-mono">{almoxInfo.referencia || almoxInfo.id.slice(0,8)}</div>
                      <div className="text-xs">{almoxInfo.descricao || "—"} — necessário {almoxInfo.quantidade_necessaria}, separado {almoxInfo.quantidade_separada}</div>
                    </div>
                  )}
                  {volumeInfo && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Volume</div>
                      <div className="font-mono">#{volumeInfo.numero_volume} — {volumeInfo.codigo_barras}</div>
                      <div className="text-xs">{volumeInfo.tipo_volume} — {volumeInfo.status}</div>
                    </div>
                  )}
                  {!pecaInfo && !almoxInfo && !volumeInfo && (
                    <div className="text-muted-foreground text-sm">Não vinculado a peça/item/volume.</div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="anexos">
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input ref={inputFile} type="file" className="hidden" onChange={handleUpload} accept="image/*,application/pdf,.doc,.docx" />
                    <Button size="sm" onClick={() => inputFile.current?.click()}>
                      <Paperclip className="h-4 w-4 mr-1" /> Anexar arquivo
                    </Button>
                  </div>
                  {anexos.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sem anexos.</div>
                  ) : (
                    <div className="space-y-1">
                      {anexos.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 text-sm border rounded p-2">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 truncate">{a.nome_arquivo}</div>
                          <span className="text-xs text-muted-foreground">{(a.tamanho_bytes/1024).toFixed(0)} KB</span>
                          <Button size="sm" variant="ghost" onClick={() => baixarAnexo(a)}><Download className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => excluirAnexo(a)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="historico">
                <Card className="p-3 max-h-96 overflow-y-auto">
                  {historico.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">Sem eventos.</div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {historico.map((h) => (
                        <div key={h.id} className="border-b border-border/40 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                            <Badge variant="outline" className="text-[10px]">{h.tipo_evento}</Badge>
                            {h.status_novo && <span className="text-[10px] text-muted-foreground">→ {STATUS_OCORRENCIA_LABEL[h.status_novo] || h.status_novo}</span>}
                          </div>
                          {h.descricao && <div className="mt-1">{h.descricao}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <Dialog open={!!statusDialog} onOpenChange={(o) => !o && setStatusDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Alterar para "{statusDialog ? STATUS_OCORRENCIA_LABEL[statusDialog] : ""}"</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {statusDialog === "resolvida" && (
                <div>
                  <Label>Descrição da solução</Label>
                  <Textarea value={statusSolucao} onChange={(e) => setStatusSolucao(e.target.value)} rows={3} />
                </div>
              )}
              <div>
                <Label>Observação {(statusDialog === "resolvida" || statusDialog === "cancelada") ? "*" : "(opcional)"}</Label>
                <Textarea value={statusObs} onChange={(e) => setStatusObs(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusDialog(null)}>Cancelar</Button>
              <Button onClick={confirmarStatus}>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={retomarOpen} onOpenChange={setRetomarOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Retomar fluxo do pedido</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Status anterior: <b>{statusFabricaLabel(oc?.pedido?.status_fabrica_anterior)}</b></div>
              <div>
                <Label>Próximo status</Label>
                <Select value={novoStatus} onValueChange={setNovoStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_RETOMAR.map((s) => <SelectItem key={s} value={s}>{statusFabricaLabel(s)}</SelectItem>)}
                    {oc?.pedido?.status_fabrica_anterior && !STATUS_RETOMAR.includes(oc.pedido.status_fabrica_anterior) && (
                      <SelectItem value={oc.pedido.status_fabrica_anterior}>{statusFabricaLabel(oc.pedido.status_fabrica_anterior)}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRetomarOpen(false)}>Cancelar</Button>
              <Button onClick={confirmarRetomar}>Retomar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
