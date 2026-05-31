import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Download, Trash2, ExternalLink } from "lucide-react";
import {
  STATUS_FABRICA_ORDEM,
  statusFabricaBadgeClass,
  statusFabricaLabel,
  STATUS_PECA_LABEL,
  STATUS_MODULO_LABEL,
  STATUS_ALMOX_LABEL,
  TIPO_ARQUIVO_LABEL,
} from "@/lib/fabrica/statusFabrica";
import { getSignedUrlFabrica, removerArquivoFabrica } from "@/lib/fabrica/arquivos";
import { ConferenciaPedidoSheet } from "@/components/fabrica/ConferenciaPedidoSheet";
import { EtiquetaPreviewDialog } from "@/components/fabrica/EtiquetaPreviewDialog";
import { AlmoxarifadoPedidoSheet } from "@/components/fabrica/AlmoxarifadoPedidoSheet";
import { EtiquetaCaixaPreviewDialog } from "@/components/fabrica/EtiquetaCaixaPreviewDialog";
import { ExpedicaoPedidoSheet } from "@/components/fabrica/ExpedicaoPedidoSheet";
import { ScanBarcode, Printer, PackageOpen, Truck } from "lucide-react";
import { resumirVolumes, listarHistoricoExp, RESULTADO_EXP_LABEL } from "@/lib/fabrica/expedicao";
import { OcorrenciasPedidoTab } from "@/components/fabrica/OcorrenciasPedidoTab";
import { PacoteTecnicoPanel } from "@/components/fabrica/PacoteTecnicoPanel";
import { VisualizadorPlanoCorteDialog } from "@/components/fabrica/VisualizadorPlanoCorteDialog";
import { Eye } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedidoId: string | null;
  onChanged?: () => void;
}

export function ProducaoPedidoSheet({ open, onOpenChange, pedidoId, onChanged }: Props) {
  const [loading, setLoading] = useState(false);
  const [pedido, setPedido] = useState<any>(null);
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [modulos, setModulos] = useState<any[]>([]);
  const [pecas, setPecas] = useState<any[]>([]);
  const [almox, setAlmox] = useState<any[]>([]);
  const [volumes, setVolumes] = useState<any[]>([]);
  const [volumePecas, setVolumePecas] = useState<any[]>([]);
  const [historicoConf, setHistoricoConf] = useState<any[]>([]);
  const [confOpen, setConfOpen] = useState(false);
  const [etiquetaOpen, setEtiquetaOpen] = useState(false);
  const [etiquetaVolume, setEtiquetaVolume] = useState<any>(null);
  const [etiquetaPecas, setEtiquetaPecas] = useState<any[]>([]);
  const [almoxOpen, setAlmoxOpen] = useState(false);
  const [caixaPreview, setCaixaPreview] = useState<any | null>(null);
  const [caixaPreviewItens, setCaixaPreviewItens] = useState<any[]>([]);
  const [expOpen, setExpOpen] = useState(false);
  const [histExp, setHistExp] = useState<any[]>([]);

  async function carregar() {
    if (!pedidoId) return;
    setLoading(true);
    try {
      const [{ data: p }, { data: ar }, { data: mo }, { data: pc }, { data: al }, { data: vs }, { data: vp }, { data: hi }] = await Promise.all([
        (supabase as any).from("pedidos").select("id, codigo, status_fabrica, valor_total, data_assinatura_pdf_final, cliente:clientes(nome), loja:lojas(nome)").eq("id", pedidoId).maybeSingle(),
        (supabase as any).from("fabrica_arquivos_producao").select("*").eq("pedido_id", pedidoId).order("created_at", { ascending: false }),
        (supabase as any).from("fabrica_modulos").select("*").eq("pedido_id", pedidoId).order("ordem", { ascending: true, nullsFirst: false }),
        (supabase as any).from("fabrica_pecas").select("*, modulo:fabrica_modulos(codigo_modulo, nome_modulo, ambiente)").eq("pedido_id", pedidoId).order("created_at", { ascending: false }),
        (supabase as any).from("fabrica_almoxarifado_itens").select("*").eq("pedido_id", pedidoId).order("referencia", { ascending: true }),
        (supabase as any).from("fabrica_volumes").select("*").eq("pedido_id", pedidoId).order("numero_volume"),
        (supabase as any).from("fabrica_volume_pecas").select("*").eq("pedido_id", pedidoId),
        (supabase as any).from("fabrica_conferencia_historico").select("*").eq("pedido_id", pedidoId).order("created_at", { ascending: false }).limit(30),
      ]);
      setPedido(p);
      setArquivos(ar || []);
      setModulos(mo || []);
      setPecas(pc || []);
      setAlmox(al || []);
      setVolumes(vs || []);
      setVolumePecas(vp || []);
      setHistoricoConf(hi || []);
      try { setHistExp(await listarHistoricoExp(pedidoId, 30)); } catch {}
    } finally {
      setLoading(false);
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

  useEffect(() => {
    if (open && pedidoId) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pedidoId]);

  async function alterarStatusFabrica(novo: string) {
    if (!pedidoId) return;
    const { error } = await (supabase as any).from("pedidos").update({ status_fabrica: novo }).eq("id", pedidoId);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    carregar();
    onChanged?.();
  }

  async function alterarStatusPeca(id: string, novo: string) {
    const { error } = await (supabase as any).from("fabrica_pecas").update({ status: novo }).eq("id", id);
    if (error) return toast.error(error.message);
    setPecas((arr) => arr.map((p) => (p.id === id ? { ...p, status: novo } : p)));
  }

  async function alterarStatusModulo(id: string, novo: string) {
    const { error } = await (supabase as any).from("fabrica_modulos").update({ status: novo }).eq("id", id);
    if (error) return toast.error(error.message);
    setModulos((arr) => arr.map((m) => (m.id === id ? { ...m, status: novo } : m)));
  }

  async function alterarQtdSeparada(id: string, novo: number) {
    const { error } = await (supabase as any).from("fabrica_almoxarifado_itens").update({ quantidade_separada: novo }).eq("id", id);
    if (error) return toast.error(error.message);
    setAlmox((arr) => arr.map((a) => (a.id === id ? { ...a, quantidade_separada: novo } : a)));
  }

  async function alterarStatusItem(id: string, novo: string) {
    const { error } = await (supabase as any).from("fabrica_almoxarifado_itens").update({ status: novo }).eq("id", id);
    if (error) return toast.error(error.message);
    setAlmox((arr) => arr.map((a) => (a.id === id ? { ...a, status: novo } : a)));
  }

  async function abrirArquivo(path: string) {
    const url = await getSignedUrlFabrica(path);
    if (url) window.open(url, "_blank");
  }

  async function removerArquivo(id: string, path: string) {
    if (!confirm("Remover arquivo?")) return;
    await removerArquivoFabrica(id, path);
    toast.success("Removido");
    carregar();
  }

  async function marcarProcessado(id: string, v: boolean) {
    const { error } = await (supabase as any).from("fabrica_arquivos_producao").update({ processado: v }).eq("id", id);
    if (error) return toast.error(error.message);
    setArquivos((arr) => arr.map((a) => (a.id === id ? { ...a, processado: v } : a)));
  }

  const obrigatoriosOk = arquivos.some((a) => a.tipo_arquivo === "relatorio_fabricacao_modulo") && arquivos.some((a) => a.tipo_arquivo === "relatorio_almoxarifado");

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            Produção · {pedido?.codigo || "—"}
            <Badge variant="outline" className={statusFabricaBadgeClass(pedido?.status_fabrica)}>
              {statusFabricaLabel(pedido?.status_fabrica)}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="resumo" className="mt-4">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="modulos">Módulos ({modulos.length})</TabsTrigger>
              <TabsTrigger value="pecas">Peças ({pecas.length})</TabsTrigger>
              <TabsTrigger value="conferencia">Conferência ({volumes.length})</TabsTrigger>
              <TabsTrigger value="almox">Almoxarifado ({almox.length})</TabsTrigger>
              <TabsTrigger value="expedicao">Expedição</TabsTrigger>
              <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
              <TabsTrigger value="arquivos">Arquivos ({arquivos.length})</TabsTrigger>
              <TabsTrigger value="tecnico">Técnico</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="space-y-3">
              <Card className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground">Cliente</div><div>{pedido?.cliente?.nome || "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Loja</div><div>{pedido?.loja?.nome || "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Liberação</div><div>{pedido?.data_assinatura_pdf_final ? new Date(pedido.data_assinatura_pdf_final).toLocaleDateString("pt-BR") : "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Módulos</div><div>{modulos.length}</div></div>
                <div><div className="text-xs text-muted-foreground">Peças</div><div>{pecas.length}</div></div>
                <div><div className="text-xs text-muted-foreground">Itens almox.</div><div>{almox.length}</div></div>
                <div><div className="text-xs text-muted-foreground">Arquivos obrigatórios</div><div>{obrigatoriosOk ? "✓ OK" : "⚠ pendentes"}</div></div>
              </Card>
              <Card className="p-4 space-y-2">
                <div className="text-sm font-medium">Alterar status da fábrica</div>
                <Select value={pedido?.status_fabrica || ""} onValueChange={alterarStatusFabrica}>
                  <SelectTrigger className="max-w-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_FABRICA_ORDEM.map((s) => (
                      <SelectItem key={s} value={s}>{statusFabricaLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Card>
            </TabsContent>

            <TabsContent value="modulos">
              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr><th className="p-2">Código</th><th className="p-2">Nome</th><th className="p-2">Ambiente</th><th className="p-2">Peças</th><th className="p-2">Status</th></tr>
                  </thead>
                  <tbody>
                    {modulos.map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="p-2 font-mono text-xs">{m.codigo_modulo}</td>
                        <td className="p-2">{m.nome_modulo || "—"}</td>
                        <td className="p-2">{m.ambiente || "—"}</td>
                        <td className="p-2">{pecas.filter((p) => p.modulo_id === m.id).length}</td>
                        <td className="p-2">
                          <Select value={m.status} onValueChange={(v) => alterarStatusModulo(m.id, v)}>
                            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_MODULO_LABEL).map(([k, l]) => (<SelectItem key={k} value={k}>{l}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                    {modulos.length === 0 && <tr><td className="p-4 text-center text-muted-foreground" colSpan={5}>Sem módulos importados.</td></tr>}
                  </tbody>
                </table>
              </Card>
            </TabsContent>

            <TabsContent value="pecas">
              <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="p-2">Código</th><th className="p-2">Referência</th><th className="p-2">Descrição</th>
                        <th className="p-2">Medida</th><th className="p-2">Qtd</th><th className="p-2">Módulo</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pecas.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="p-2 font-mono text-xs">{p.codigo_peca}</td>
                          <td className="p-2">{p.referencia || "—"}</td>
                          <td className="p-2">{p.descricao || "—"}</td>
                          <td className="p-2 text-xs">{p.medida_texto || [p.medida_largura, p.medida_altura, p.medida_profundidade].filter(Boolean).join(" × ") || "—"}</td>
                          <td className="p-2">{p.quantidade}</td>
                          <td className="p-2 text-xs">{p.modulo?.codigo_modulo || "—"}</td>
                          <td className="p-2">
                            <Select value={p.status} onValueChange={(v) => alterarStatusPeca(p.id, v)}>
                              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(STATUS_PECA_LABEL).map(([k, l]) => (<SelectItem key={k} value={k}>{l}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                      {pecas.length === 0 && <tr><td className="p-4 text-center text-muted-foreground" colSpan={7}>Sem peças.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="conferencia" className="space-y-3">
              <Card className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground">Total peças</div><div className="font-bold">{pecas.length}</div></div>
                <div><div className="text-xs text-muted-foreground">Conferidas</div><div className="font-bold">{pecas.filter((p) => ["conferida","aguardando_par_embalagem","embalada"].includes(p.status)).length}</div></div>
                <div><div className="text-xs text-muted-foreground">Embaladas</div><div className="font-bold text-emerald-700">{pecas.filter((p) => p.status === "embalada").length}</div></div>
                <div><div className="text-xs text-muted-foreground">Volumes</div><div className="font-bold">{volumes.length}</div></div>
                <div><div className="text-xs text-muted-foreground">Ocorrências</div><div className="font-bold text-red-700">{pecas.filter((p) => ["faltante","avariada","divergente"].includes(p.status)).length}</div></div>
              </Card>
              <div className="flex justify-end">
                <Button onClick={() => setConfOpen(true)}><ScanBarcode className="h-4 w-4 mr-2" />Abrir conferência</Button>
              </div>
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-2 border-b text-sm font-medium">Volumes</div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr><th className="p-2">#</th><th className="p-2">Tipo</th><th className="p-2">Status</th><th className="p-2">Peças</th><th className="p-2">Código</th><th className="p-2 w-28"></th></tr>
                  </thead>
                  <tbody>
                    {volumes.map((v) => {
                      const pids = volumePecas.filter((vp) => vp.volume_id === v.id).map((vp) => vp.peca_id);
                      const ps = pecas.filter((p) => pids.includes(p.id));
                      return (
                        <tr key={v.id} className="border-t">
                          <td className="p-2 font-bold">#{v.numero_volume}</td>
                          <td className="p-2">{v.tipo_volume}</td>
                          <td className="p-2"><Badge variant="outline">{v.status}</Badge></td>
                          <td className="p-2 text-xs">{ps.map((x) => x.codigo_peca).join(" + ")}</td>
                          <td className="p-2 font-mono text-xs">{v.codigo_barras}</td>
                          <td className="p-2 text-right">
                            <Button size="sm" variant="outline" onClick={() => abrirEtiquetaVolume(v.id)}>
                              <Printer className="h-3.5 w-3.5 mr-1" /> Etiqueta
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {volumes.length === 0 && <tr><td className="p-4 text-center text-muted-foreground" colSpan={6}>Nenhum volume criado.</td></tr>}
                  </tbody>
                </table>
              </Card>
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-2 border-b text-sm font-medium">Últimas leituras</div>
                <div className="divide-y max-h-72 overflow-y-auto">
                  {historicoConf.slice(0, 20).map((h) => (
                    <div key={h.id} className="px-3 py-1.5 text-xs">
                      <div className="flex justify-between"><span className="font-mono">{h.codigo_bipado || "—"}</span><span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span></div>
                      <div className="text-muted-foreground">{h.mensagem}</div>
                    </div>
                  ))}
                  {historicoConf.length === 0 && <div className="p-3 text-xs text-muted-foreground">Sem histórico.</div>}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="almox" className="space-y-3">
              {(() => {
                const caixas = volumes.filter((v) => v.tipo_volume === "caixa_almoxarifado" && v.status !== "cancelado");
                const completos = almox.filter((a) => a.status === "separado_completo").length;
                const parciais = almox.filter((a) => a.status === "separado_parcial").length;
                const faltantes = almox.filter((a) => a.status === "faltante").length;
                return (
                  <Card className="p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex flex-wrap gap-3 text-sm">
                        <span>Total: <b>{almox.length}</b></span>
                        <span className="text-emerald-700">Completos: <b>{completos}</b></span>
                        <span className="text-amber-700">Parciais: <b>{parciais}</b></span>
                        <span className="text-red-700">Faltantes: <b>{faltantes}</b></span>
                        <span>Caixas: <b>{caixas.length}</b></span>
                      </div>
                      <Button size="sm" onClick={() => setAlmoxOpen(true)}>
                        <PackageOpen className="h-4 w-4 mr-1" />Iniciar separação
                      </Button>
                    </div>
                    {caixas.length > 0 && (
                      <div className="mt-3 grid sm:grid-cols-2 gap-2">
                        {caixas.map((cx) => (
                          <div key={cx.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                            <div>
                              <div className="font-medium">Caixa #{cx.numero_volume}</div>
                              <div className="text-[11px] text-muted-foreground">{cx.codigo_barras} · {cx.status}</div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const { data } = await (supabase as any)
                                  .from("fabrica_volume_almoxarifado_itens")
                                  .select("*, item:fabrica_almoxarifado_itens(*)")
                                  .eq("volume_id", cx.id);
                                setCaixaPreview(cx);
                                setCaixaPreviewItens(
                                  (data || []).map((r: any) => ({
                                    referencia: r.item?.referencia || "—",
                                    descricao: r.item?.descricao,
                                    quantidade: r.quantidade,
                                    unidade: r.item?.unidade,
                                  })),
                                );
                              }}
                            >
                              <Printer className="h-4 w-4 mr-1" />Etiqueta
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })()}
              <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="p-2">Referência</th><th className="p-2">Descrição</th>
                        <th className="p-2">Qtd. necessária</th><th className="p-2">Qtd. separada</th>
                        <th className="p-2">Unid.</th><th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {almox.map((a) => (
                        <tr key={a.id} className="border-t">
                          <td className="p-2 font-mono text-xs">{a.referencia}</td>
                          <td className="p-2">{a.descricao || "—"}</td>
                          <td className="p-2">{a.quantidade_necessaria}</td>
                          <td className="p-2">
                            <Input type="number" className="h-8 w-20" defaultValue={a.quantidade_separada}
                              onBlur={(e) => alterarQtdSeparada(a.id, Number(e.target.value) || 0)} />
                          </td>
                          <td className="p-2">{a.unidade || "—"}</td>
                          <td className="p-2">
                            <Select value={a.status} onValueChange={(v) => alterarStatusItem(a.id, v)}>
                              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(STATUS_ALMOX_LABEL).map(([k, l]) => (<SelectItem key={k} value={k}>{l}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                      {almox.length === 0 && <tr><td className="p-4 text-center text-muted-foreground" colSpan={6}>Sem itens.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="expedicao" className="space-y-3">
              {(() => {
                const ativos = volumes.filter((v: any) => v.status !== "cancelado");
                const r = resumirVolumes(ativos);
                const podeIniciar = ["pronto_para_expedicao", "em_expedicao", "expedido"].includes(pedido?.status_fabrica);
                return (
                  <>
                    <Card className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Truck className="h-5 w-5 text-amber-700" />
                        <div className="font-medium">Expedição por volumes</div>
                        <Badge variant="outline" className={statusFabricaBadgeClass(pedido?.status_fabrica)}>
                          {statusFabricaLabel(pedido?.status_fabrica)}
                        </Badge>
                        <Button size="sm" className="ml-auto" disabled={!podeIniciar} onClick={() => setExpOpen(true)}>
                          <ScanBarcode className="h-4 w-4 mr-1" />
                          {pedido?.status_fabrica === "expedido" ? "Consultar" : "Iniciar expedição"}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                        <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Total</div><div className="text-lg font-bold">{r.total}</div></div>
                        <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Carregados</div><div className="text-lg font-bold text-emerald-700">{r.carregados}</div></div>
                        <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-lg font-bold text-amber-700">{r.pendentes}</div></div>
                        <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Caixas</div><div className="text-lg font-bold">{r.caixas}</div></div>
                        <div className="rounded border p-2"><div className="text-xs text-muted-foreground">Problemas</div><div className="text-lg font-bold text-red-700">{r.problemas}</div></div>
                      </div>
                      {pedido?.fabrica_expedido_em && (
                        <div className="text-xs text-muted-foreground mt-3">
                          Expedido em {new Date(pedido.fabrica_expedido_em).toLocaleString("pt-BR")}
                        </div>
                      )}
                      {!podeIniciar && (
                        <div className="text-xs text-muted-foreground mt-3">
                          Pedido precisa estar pronto para expedição (peças e almoxarifado concluídos).
                        </div>
                      )}
                    </Card>

                    <Card className="p-3">
                      <div className="text-sm font-medium mb-2">Histórico de bipagem</div>
                      {histExp.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-2">Sem eventos.</div>
                      ) : (
                        <div className="space-y-1 text-xs font-mono max-h-72 overflow-y-auto">
                          {histExp.map((h: any) => (
                            <div key={h.id} className="flex gap-2 border-b border-border/40 pb-1">
                              <span className="text-muted-foreground shrink-0">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                              <Badge variant="outline" className="text-[10px]">{RESULTADO_EXP_LABEL[h.resultado] || h.resultado}</Badge>
                              <span className="truncate">{h.codigo_bipado || ""} {h.mensagem ? `— ${h.mensagem}` : ""}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="ocorrencias">
              <OcorrenciasPedidoTab pedidoId={pedidoId} />
            </TabsContent>

            <TabsContent value="arquivos">
              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr><th className="p-2">Tipo</th><th className="p-2">Nome</th><th className="p-2">Obrig.</th><th className="p-2">Processado</th><th className="p-2">Data</th><th className="p-2 w-32"></th></tr>
                  </thead>
                  <tbody>
                    {arquivos.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="p-2">{TIPO_ARQUIVO_LABEL[a.tipo_arquivo] || a.tipo_arquivo}</td>
                        <td className="p-2">{a.nome_arquivo}</td>
                        <td className="p-2">{a.obrigatorio ? "Sim" : "—"}</td>
                        <td className="p-2">
                          <Button size="sm" variant={a.processado ? "default" : "outline"} className="h-7"
                            onClick={() => marcarProcessado(a.id, !a.processado)}>
                            {a.processado ? "✓ Processado" : "Marcar"}
                          </Button>
                        </td>
                        <td className="p-2 text-xs">{new Date(a.created_at).toLocaleString("pt-BR")}</td>
                        <td className="p-2 text-right space-x-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => abrirArquivo(a.url_arquivo)}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removerArquivo(a.id, a.url_arquivo)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {arquivos.length === 0 && <tr><td className="p-4 text-center text-muted-foreground" colSpan={6}>Sem arquivos.</td></tr>}
                  </tbody>
                </table>
              </Card>
            </TabsContent>

            <TabsContent value="tecnico">
              <PacoteTecnicoPanel pedidoId={pedidoId} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
    <ConferenciaPedidoSheet
      open={confOpen}
      onOpenChange={(v) => { setConfOpen(v); if (!v) carregar(); }}
      pedidoId={pedidoId}
      onChanged={() => { carregar(); onChanged?.(); }}
    />
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
    <AlmoxarifadoPedidoSheet
      open={almoxOpen}
      onOpenChange={(v) => { setAlmoxOpen(v); if (!v) carregar(); }}
      pedido={pedido}
      onChanged={() => { carregar(); onChanged?.(); }}
    />
    {caixaPreview && (
      <EtiquetaCaixaPreviewDialog
        open={!!caixaPreview}
        onOpenChange={(v) => !v && setCaixaPreview(null)}
        pedidoId={pedidoId || ""}
        pedidoCodigo={pedido?.codigo}
        cliente={pedido?.cliente?.nome}
        caixa={caixaPreview}
        itens={caixaPreviewItens}
      />
    )}
    <ExpedicaoPedidoSheet
      open={expOpen}
      onOpenChange={(v) => { setExpOpen(v); if (!v) carregar(); }}
      pedido={pedido}
      onChanged={() => { carregar(); onChanged?.(); }}
    />
    </>
  );
}
