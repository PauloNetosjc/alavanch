import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Download, Printer, X, ZoomIn, ZoomOut, Maximize, ExternalLink,
  FileText, FileArchive, Tag as TagIcon, Layers, Image as ImageIcon, Cpu,
  Play, CheckCircle2, ShieldCheck,
} from "lucide-react";
import { getSignedUrlPacoteTecnico } from "@/lib/fabrica/importacaoTecnica";
import { DadosVetoriaisPanel, DadosVetoriaisTabela } from "@/components/fabrica/DadosVetoriaisPanel";
import { VisualizadorVetorialChapa } from "@/components/fabrica/VisualizadorVetorialChapa";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedidoId?: string | null;
  loteId?: string | null;
  importacaoIdInicial?: string | null;
}

type StatusChapa = "aguardando_corte" | "em_corte" | "cortada" | "conferida" | "cancelada";

const STATUS_LABELS: Record<StatusChapa, string> = {
  aguardando_corte: "Aguardando corte",
  em_corte: "Em corte",
  cortada: "Cortada",
  conferida: "Conferida",
  cancelada: "Cancelada",
};
const STATUS_CLASS: Record<StatusChapa, string> = {
  aguardando_corte: "bg-slate-50 text-slate-700 border-slate-200",
  em_corte: "bg-amber-50 text-amber-700 border-amber-200",
  cortada: "bg-blue-50 text-blue-700 border-blue-200",
  conferida: "bg-green-50 text-green-700 border-green-200",
  cancelada: "bg-red-50 text-red-700 border-red-200",
};

export function VisualizadorPlanoCorteDialog({ open, onOpenChange, pedidoId, loteId, importacaoIdInicial }: Props) {
  const [loading, setLoading] = useState(true);
  const [importacoes, setImportacoes] = useState<any[]>([]);
  const [impSelId, setImpSelId] = useState<string | null>(null);
  const [chapas, setChapas] = useState<any[]>([]);
  const [chapaSelId, setChapaSelId] = useState<string | null>(null);
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [etiquetas, setEtiquetas] = useState<any[]>([]);
  const [pedido, setPedido] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [filtroEtiq, setFiltroEtiq] = useState("");
  const [filtroArq, setFiltroArq] = useState({ pasta: "", tipo: "", ext: "", nome: "" });
  const [visaoCentral, setVisaoCentral] = useState<"preview" | "vetorial">("preview");

  // Carrega importações e cabeçalho
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const filtro = pedidoId ? { col: "pedido_id", val: pedidoId } : loteId ? { col: "lote_id", val: loteId } : null;
      if (!filtro) { setLoading(false); return; }
      const { data: imps } = await (supabase as any)
        .from("fabrica_importacoes_tecnicas")
        .select("*")
        .eq(filtro.col, filtro.val)
        .order("created_at", { ascending: false });
      setImportacoes(imps || []);
      const inicial = importacaoIdInicial || (imps && imps[0]?.id) || null;
      setImpSelId(inicial);

      if (pedidoId) {
        const { data: ped } = await (supabase as any)
          .from("pedidos")
          .select("id, codigo, cliente:clientes(nome), loja:lojas(nome), ambiente_descricao, observacoes")
          .eq("id", pedidoId)
          .maybeSingle();
        setPedido(ped);
      }
      setLoading(false);
    })();
  }, [open, pedidoId, loteId, importacaoIdInicial]);

  // Carrega dados da importação selecionada
  useEffect(() => {
    if (!impSelId) { setChapas([]); setArquivos([]); setEtiquetas([]); return; }
    (async () => {
      const [ch, ar, et] = await Promise.all([
        (supabase as any).from("fabrica_chapas_lote").select("*").eq("importacao_id", impSelId).order("ordem_chapa", { ascending: true, nullsFirst: false }),
        (supabase as any).from("fabrica_arquivos_tecnicos").select("*").eq("importacao_id", impSelId).order("origem_pasta").limit(2000),
        (supabase as any).from("fabrica_etiquetas").select("*").eq("importacao_id", impSelId).order("codigo_etiqueta_completo").limit(2000),
      ]);
      const chapasData = ch.data || [];
      setChapas(chapasData);
      setArquivos(ar.data || []);
      setEtiquetas(et.data || []);
      setChapaSelId(chapasData[0]?.id || null);
    })();
  }, [impSelId]);

  const chapaSel = useMemo(() => chapas.find((c) => c.id === chapaSelId) || null, [chapas, chapaSelId]);
  const impSel = useMemo(() => importacoes.find((i) => i.id === impSelId) || null, [importacoes, impSelId]);

  // Resolve preview URL ao trocar chapa
  useEffect(() => {
    setPreviewUrl(null);
    setZoom(1);
    if (!chapaSel) return;
    const previewId = chapaSel.preview_large_id || chapaSel.preview_small_id;
    if (!previewId) return;
    const arq = arquivos.find((a) => a.id === previewId);
    if (!arq?.url_arquivo) return;
    getSignedUrlPacoteTecnico(arq.url_arquivo, 3600).then((u) => setPreviewUrl(u));
  }, [chapaSel, arquivos]);

  function arquivosDaChapa(chapaId: string) {
    return arquivos.filter((a) => a.chapa_id === chapaId);
  }
  function etiquetasDaChapa(chapaId: string) {
    return etiquetas.filter((e) => e.chapa_id === chapaId);
  }

  async function baixarArquivoId(id: string | null | undefined) {
    if (!id) return toast.error("Arquivo não disponível");
    const arq = arquivos.find((a) => a.id === id);
    if (!arq?.url_arquivo) return toast.error("Arquivo não disponível");
    const u = await getSignedUrlPacoteTecnico(arq.url_arquivo, 3600);
    if (u) window.open(u, "_blank");
  }
  async function abrirCaminho(path: string | null | undefined) {
    if (!path) return;
    const u = await getSignedUrlPacoteTecnico(path, 3600);
    if (u) window.open(u, "_blank");
  }

  async function alterarStatusChapa(novo: StatusChapa) {
    if (!chapaSel) return;
    const { error } = await (supabase as any)
      .from("fabrica_chapas_lote")
      .update({ status_chapa: novo, updated_at: new Date().toISOString() })
      .eq("id", chapaSel.id);
    if (error) return toast.error("Erro ao atualizar status: " + error.message);
    toast.success(`Chapa marcada como ${STATUS_LABELS[novo]}`);
    setChapas((cs) => cs.map((c) => (c.id === chapaSel.id ? { ...c, status_chapa: novo } : c)));
  }

  const pdfsImp = arquivos.filter((a) =>
    ["lista_corte_pdf", "preview_corte_pdf", "labels_pdf", "relatorio_almoxarifado_pdf"].includes(a.tipo_arquivo)
  );

  function findPdfPath(tipo: string): string | null {
    return arquivos.find((a) => a.tipo_arquivo === tipo)?.url_arquivo || null;
  }

  // Filtros arquivos
  const arquivosFiltrados = useMemo(() => {
    return arquivos.filter((a) => {
      if (filtroArq.pasta && a.origem_pasta !== filtroArq.pasta) return false;
      if (filtroArq.tipo && a.tipo_arquivo !== filtroArq.tipo) return false;
      if (filtroArq.ext && (a.extensao || "").toLowerCase() !== filtroArq.ext.toLowerCase()) return false;
      if (filtroArq.nome && !(a.nome_arquivo || "").toLowerCase().includes(filtroArq.nome.toLowerCase())) return false;
      return true;
    });
  }, [arquivos, filtroArq]);

  const etiqsFiltradas = useMemo(() => {
    const f = filtroEtiq.toLowerCase().trim();
    if (!f) return etiquetas;
    return etiquetas.filter(
      (e) =>
        (e.codigo_etiqueta_completo || "").toLowerCase().includes(f) ||
        (e.referencia_peca || "").toLowerCase().includes(f) ||
        (e.codigo_peca || "").toLowerCase().includes(f)
    );
  }, [etiquetas, filtroEtiq]);

  function imprimir() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1400px] w-[98vw] h-[95vh] p-0 flex flex-col print:max-w-full print:w-full print:h-auto">
        {/* Cabeçalho */}
        <div className="border-b px-4 py-3 flex items-center justify-between gap-3 flex-wrap print:border-b-2">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Visualizador técnico de plano de corte</div>
              <div className="font-bold text-base truncate">
                {pedido?.codigo ? `Pedido ${pedido.codigo}` : loteId ? `Lote ${String(loteId).slice(0, 8)}` : "—"}
                {pedido?.cliente?.nome ? ` • ${pedido.cliente.nome}` : ""}
                {pedido?.loja?.nome ? ` • ${pedido.loja.nome}` : ""}
              </div>
              {pedido?.ambiente_descricao && (
                <div className="text-xs text-muted-foreground truncate">Ambiente: {pedido.ambiente_descricao}</div>
              )}
            </div>
            {importacoes.length > 1 && (
              <Select value={impSelId || ""} onValueChange={setImpSelId}>
                <SelectTrigger className="h-8 w-[280px]"><SelectValue placeholder="Importação" /></SelectTrigger>
                <SelectContent>
                  {importacoes.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {new Date(i.data_importacao).toLocaleString("pt-BR")} — {i.arquivo_original_nome || "Pacote"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {impSel && (
              <Badge variant="outline" className={
                impSel.status_importacao === "processado" ? "bg-green-50 text-green-700 border-green-200" :
                impSel.status_importacao === "processado_com_alertas" ? "bg-amber-50 text-amber-700 border-amber-200" :
                impSel.status_importacao === "erro" ? "bg-red-50 text-red-700 border-red-200" : ""
              }>{impSel.status_importacao}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1 print:hidden">
            <div className="inline-flex border rounded overflow-hidden mr-1">
              <Button size="sm" variant={visaoCentral === "preview" ? "default" : "ghost"}
                className="h-8 rounded-none text-xs px-2" onClick={() => setVisaoCentral("preview")}>
                Preview
              </Button>
              <Button size="sm" variant={visaoCentral === "vetorial" ? "default" : "ghost"}
                className="h-8 rounded-none text-xs px-2" onClick={() => setVisaoCentral("vetorial")}>
                Vetorial
              </Button>
            </div>
            {impSel?.arquivo_original_url && (
              <Button size="sm" variant="outline" onClick={() => abrirCaminho(impSel.arquivo_original_url)}>
                <FileArchive className="h-3 w-3 mr-1" /> ZIP
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => abrirCaminho(findPdfPath("labels_pdf"))} disabled={!findPdfPath("labels_pdf")}>
              <TagIcon className="h-3 w-3 mr-1" /> Labels PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => abrirCaminho(findPdfPath("lista_corte_pdf"))} disabled={!findPdfPath("lista_corte_pdf")}>
              <FileText className="h-3 w-3 mr-1" /> ListaCorte
            </Button>
            <Button size="sm" variant="outline" onClick={() => abrirCaminho(findPdfPath("preview_corte_pdf"))} disabled={!findPdfPath("preview_corte_pdf")}>
              <FileText className="h-3 w-3 mr-1" /> PreviewCorte
            </Button>
            <Button size="sm" variant="outline" onClick={imprimir}><Printer className="h-3 w-3 mr-1" /> Imprimir</Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !impSel ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Nenhuma importação técnica encontrada.
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-12 overflow-hidden">
            {/* Lateral esquerda: lista de chapas */}
            <aside className="col-span-3 border-r overflow-y-auto p-2 space-y-1 bg-muted/20 print:hidden">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center justify-between">
                <span>Chapas ({chapas.length})</span>
              </div>
              {chapas.length === 0 && (
                <div className="text-xs text-muted-foreground p-3 text-center">Nenhuma chapa identificada nesta importação.</div>
              )}
              {chapas.map((c, idx) => {
                const arqs = arquivosDaChapa(c.id);
                const hasNc = !!c.arquivo_nc_id || arqs.some((a) => a.tipo_arquivo === "nc_chapa");
                const hasCyc = !!c.arquivo_cyc_id || arqs.some((a) => a.tipo_arquivo === "cyc_chapa");
                const hasPv = !!c.preview_large_id || !!c.preview_small_id;
                const etiqs = etiquetasDaChapa(c.id).length;
                const sel = c.id === chapaSelId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setChapaSelId(c.id)}
                    className={`w-full text-left rounded-md border px-2 py-2 text-xs transition ${
                      sel ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">Chapa {c.numero_chapa || idx + 1}</span>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_CLASS[c.status_chapa as StatusChapa] || ""}`}>
                        {STATUS_LABELS[c.status_chapa as StatusChapa] || c.status_chapa}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground truncate">{c.material || "—"}{c.cor_linha ? ` • ${c.cor_linha}` : ""}</div>
                    <div className="text-muted-foreground">{c.espessura ? `${c.espessura}mm` : "—"} • {c.largura_chapa}x{c.altura_chapa}</div>
                    {c.aproveitamento != null && (
                      <div className="text-muted-foreground">Aprov.: {Number(c.aproveitamento).toFixed(1)}%</div>
                    )}
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {hasNc && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">NC</Badge>}
                      {hasCyc && <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">CYC</Badge>}
                      {hasPv && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">PV</Badge>}
                      {etiqs > 0 && <Badge variant="outline" className="text-[10px]">{etiqs} etiq</Badge>}
                    </div>
                  </button>
                );
              })}
            </aside>

            {visaoCentral === "vetorial" ? (
              <section className="col-span-9 border-l overflow-hidden flex flex-col min-h-0 print:col-span-12">
                <VisualizadorVetorialChapa
                  importacaoId={impSelId}
                  chapa={chapaSel}
                  arquivos={arquivos}
                  etiquetas={etiquetas}
                  pedido={pedido}
                  previewUrl={previewUrl}
                />
              </section>
            ) : (
            <>
            {/* Centro: preview */}
            <main className="col-span-6 flex flex-col overflow-hidden bg-neutral-900/95 print:bg-white print:col-span-12">
              <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2 bg-neutral-900 text-white text-xs print:hidden">
                <div className="truncate">
                  {chapaSel ? `Chapa ${chapaSel.numero_chapa} • ${chapaSel.material || "—"} ${chapaSel.cor_linha || ""} ${chapaSel.espessura ? chapaSel.espessura + "mm" : ""}` : "Selecione uma chapa"}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}><ZoomOut className="h-3 w-3" /></Button>
                  <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}><ZoomIn className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:text-white hover:bg-white/10" onClick={() => setZoom(1)}><Maximize className="h-3 w-3" /></Button>
                  {previewUrl && (
                    <>
                      <Button size="sm" variant="ghost" className="text-white hover:text-white hover:bg-white/10" onClick={() => window.open(previewUrl, "_blank")}>
                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                      </Button>
                      <a href={previewUrl} download className="inline-flex items-center gap-1 text-xs px-2 h-7 rounded hover:bg-white/10">
                        <Download className="h-3 w-3" /> Baixar
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto flex items-center justify-center p-4 print:p-2">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`Plano de corte chapa ${chapaSel?.numero_chapa}`}
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                    className="max-w-full max-h-full object-contain bg-white shadow-lg transition-transform"
                  />
                ) : chapaSel ? (
                  <PlaceholderChapa chapa={chapaSel} />
                ) : (
                  <div className="text-white/60 text-sm">Selecione uma chapa à esquerda.</div>
                )}
              </div>
            </main>

            {/* Lateral direita: detalhes / tabs */}
            <aside className="col-span-3 border-l overflow-y-auto print:hidden">
              <Tabs defaultValue="detalhes" className="w-full">
                <TabsList className="w-full justify-start rounded-none border-b h-9">
                  <TabsTrigger value="detalhes" className="text-xs">Detalhes</TabsTrigger>
                  <TabsTrigger value="etiquetas" className="text-xs">Etiquetas</TabsTrigger>
                  <TabsTrigger value="pecas" className="text-xs">Peças</TabsTrigger>
                  <TabsTrigger value="vetorial" className="text-xs">Vetorial</TabsTrigger>
                  <TabsTrigger value="arquivos" className="text-xs">Arquivos</TabsTrigger>
                </TabsList>

                <TabsContent value="detalhes" className="p-3 space-y-3">
                  {!chapaSel ? (
                    <div className="text-xs text-muted-foreground">Selecione uma chapa.</div>
                  ) : (
                    <>
                      <Card className="p-3 space-y-1.5 text-xs">
                        <Row k="Número" v={chapaSel.numero_chapa} />
                        <Row k="Ordem" v={chapaSel.ordem_chapa ?? "—"} />
                        <Row k="Material" v={chapaSel.material || "—"} />
                        <Row k="Cor/linha" v={chapaSel.cor_linha || "—"} />
                        <Row k="Espessura" v={chapaSel.espessura ? `${chapaSel.espessura} mm` : "—"} />
                        <Row k="Dimensão" v={`${chapaSel.largura_chapa} x ${chapaSel.altura_chapa} mm`} />
                        <Row k="Aproveitamento" v={chapaSel.aproveitamento != null ? `${Number(chapaSel.aproveitamento).toFixed(1)}%` : "—"} />
                        <Row k="Status" v={
                          <Badge variant="outline" className={STATUS_CLASS[chapaSel.status_chapa as StatusChapa]}>
                            {STATUS_LABELS[chapaSel.status_chapa as StatusChapa] || chapaSel.status_chapa}
                          </Badge>
                        } />
                      </Card>

                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Arquivos da chapa</div>
                        <ArqBtn label="NC" icon={Cpu} arqId={chapaSel.arquivo_nc_id} arquivos={arquivos} onAbrir={baixarArquivoId} fallbackTipo="nc_chapa" chapaId={chapaSel.id} />
                        <ArqBtn label="CYC" icon={FileText} arqId={chapaSel.arquivo_cyc_id} arquivos={arquivos} onAbrir={baixarArquivoId} fallbackTipo="cyc_chapa" chapaId={chapaSel.id} />
                        <ArqBtn label="Preview Large" icon={ImageIcon} arqId={chapaSel.preview_large_id} arquivos={arquivos} onAbrir={baixarArquivoId} />
                        <ArqBtn label="Preview Small" icon={ImageIcon} arqId={chapaSel.preview_small_id} arquivos={arquivos} onAbrir={baixarArquivoId} />
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Status da chapa</div>
                        <div className="grid grid-cols-1 gap-1">
                          <Button size="sm" variant="outline" onClick={() => alterarStatusChapa("em_corte")} disabled={chapaSel.status_chapa === "em_corte"}>
                            <Play className="h-3 w-3 mr-1" /> Marcar em corte
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => alterarStatusChapa("cortada")} disabled={chapaSel.status_chapa === "cortada"}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Marcar cortada
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => alterarStatusChapa("conferida")} disabled={chapaSel.status_chapa === "conferida"}>
                            <ShieldCheck className="h-3 w-3 mr-1" /> Marcar conferida
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="etiquetas" className="p-3 space-y-2">
                  <Input
                    placeholder="Filtrar etiquetas..."
                    value={filtroEtiq}
                    onChange={(e) => setFiltroEtiq(e.target.value)}
                    className="h-8 text-xs"
                  />
                  {chapaSel && etiquetasDaChapa(chapaSel.id).length > 0 ? (
                    <div className="text-[10px] text-muted-foreground uppercase">Etiquetas vinculadas à chapa</div>
                  ) : (
                    <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      Vínculo etiqueta → chapa ainda não disponível. Exibindo etiquetas da importação.
                    </div>
                  )}
                  <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                    {(chapaSel && etiquetasDaChapa(chapaSel.id).length > 0
                      ? etiquetasDaChapa(chapaSel.id)
                      : etiqsFiltradas
                    ).slice(0, 300).map((e) => (
                      <Card key={e.id} className="p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-mono font-medium truncate">{e.codigo_etiqueta_completo}</div>
                            <div className="text-muted-foreground text-[10px]">
                              ref: {e.referencia_peca || "—"} • pç: {e.codigo_peca || "—"} • suf: {e.sufixo || "—"} • dup: {e.indice_duplicidade ?? "—"}
                            </div>
                            {e.codigo_barras && <div className="font-mono text-[10px] text-muted-foreground">cb: {e.codigo_barras}</div>}
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            {e.arquivo_etiqueta_id && (
                              <Button size="icon" variant="ghost" className="h-6 w-6" title="Visualizar" onClick={() => baixarArquivoId(e.arquivo_etiqueta_id)}><ExternalLink className="h-3 w-3" /></Button>
                            )}
                            {e.arquivo_bmp_id && (
                              <Button size="icon" variant="ghost" className="h-6 w-6" title="BMP" onClick={() => baixarArquivoId(e.arquivo_bmp_id)}><ImageIcon className="h-3 w-3" /></Button>
                            )}
                            {e.arquivo_pdf_id && (
                              <Button size="icon" variant="ghost" className="h-6 w-6" title="PDF" onClick={() => baixarArquivoId(e.arquivo_pdf_id)}><FileText className="h-3 w-3" /></Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                    {etiquetas.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4">Nenhuma etiqueta catalogada.</div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="pecas" className="p-3">
                  <Card className="p-4 text-xs text-muted-foreground text-center">
                    Peças da chapa ainda não interpretadas.<br />
                    Serão preenchidas na próxima fase com leitura estruturada da ListaCorte/Preview.
                  </Card>
                </TabsContent>

                <TabsContent value="vetorial" className="p-3 space-y-2">
                  <DadosVetoriaisPanel importacaoId={impSelId} compact />
                  <DadosVetoriaisTabela importacaoId={impSelId} chapaId={chapaSelId} />
                </TabsContent>

                <TabsContent value="arquivos" className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-1">
                    <Select value={filtroArq.pasta || "all"} onValueChange={(v) => setFiltroArq((s) => ({ ...s, pasta: v === "all" ? "" : v }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Pasta" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas pastas</SelectItem>
                        {Array.from(new Set(arquivos.map((a) => a.origem_pasta))).map((p) => (
                          <SelectItem key={p as string} value={p as string}>{p as string}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filtroArq.tipo || "all"} onValueChange={(v) => setFiltroArq((s) => ({ ...s, tipo: v === "all" ? "" : v }))}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos tipos</SelectItem>
                        {Array.from(new Set(arquivos.map((a) => a.tipo_arquivo))).map((t) => (
                          <SelectItem key={t as string} value={t as string}>{t as string}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    placeholder="Filtrar por nome..."
                    value={filtroArq.nome}
                    onChange={(e) => setFiltroArq((s) => ({ ...s, nome: e.target.value }))}
                    className="h-7 text-xs"
                  />
                  <div className="text-[10px] text-muted-foreground">{arquivosFiltrados.length} arquivo(s)</div>
                  <div className="space-y-1 max-h-[55vh] overflow-y-auto">
                    {arquivosFiltrados.slice(0, 300).map((a) => (
                      <Card key={a.id} className="p-2 text-xs flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono truncate">{a.nome_arquivo}</div>
                          <div className="text-[10px] text-muted-foreground">{a.origem_pasta} • {a.tipo_arquivo}{a.extensao ? ` • .${a.extensao}` : ""}</div>
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <Button size="icon" variant="ghost" className="h-6 w-6" title="Abrir" onClick={() => abrirCaminho(a.url_arquivo)}>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" title="Copiar caminho" onClick={() => {
                            navigator.clipboard.writeText(a.caminho_relativo || a.nome_arquivo);
                            toast.success("Caminho copiado");
                          }}>
                            <FileText className="h-3 w-3" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {pdfsImp.length > 0 && (
                    <>
                      <div className="text-xs font-medium text-muted-foreground pt-2">PDFs técnicos</div>
                      <div className="space-y-1">
                        {pdfsImp.map((p) => (
                          <Button key={p.id} variant="outline" size="sm" className="w-full justify-start text-xs h-7" onClick={() => abrirCaminho(p.url_arquivo)}>
                            <FileText className="h-3 w-3 mr-1" /> {p.tipo_arquivo}
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </aside>
          </div>
        )}

        {/* Área de impressão - somente print */}
        <div className="hidden print:block p-4 space-y-3 text-xs">
          <h2 className="font-bold text-lg">{pedido?.codigo ? `Pedido ${pedido.codigo}` : "Plano de corte"}</h2>
          <div>{pedido?.cliente?.nome} • {pedido?.loja?.nome}</div>
          {chapaSel && (
            <>
              <div className="font-semibold">Chapa {chapaSel.numero_chapa} — {chapaSel.material} {chapaSel.cor_linha} {chapaSel.espessura}mm</div>
              {previewUrl && <img src={previewUrl} alt="" className="max-w-full" />}
              <div>Dimensão: {chapaSel.largura_chapa} x {chapaSel.altura_chapa} mm</div>
              <div>Status: {STATUS_LABELS[chapaSel.status_chapa as StatusChapa]}</div>
              <div className="font-semibold mt-2">Etiquetas ({etiquetasDaChapa(chapaSel.id).length || etiquetas.length}):</div>
              <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                {(etiquetasDaChapa(chapaSel.id).length ? etiquetasDaChapa(chapaSel.id) : etiquetas).slice(0, 200).map((e) => (
                  <div key={e.id}>{e.codigo_etiqueta_completo}</div>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function ArqBtn({
  label, icon: Icon, arqId, arquivos, onAbrir, fallbackTipo, chapaId,
}: {
  label: string;
  icon: any;
  arqId: string | null | undefined;
  arquivos: any[];
  onAbrir: (id: string) => void;
  fallbackTipo?: string;
  chapaId?: string;
}) {
  let id = arqId || null;
  if (!id && fallbackTipo && chapaId) {
    id = arquivos.find((a) => a.tipo_arquivo === fallbackTipo && a.chapa_id === chapaId)?.id || null;
  }
  return (
    <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7" disabled={!id} onClick={() => id && onAbrir(id)}>
      <Icon className="h-3 w-3 mr-1" /> {label} {!id && <span className="ml-auto text-muted-foreground text-[10px]">indisponível</span>}
    </Button>
  );
}

function PlaceholderChapa({ chapa }: { chapa: any }) {
  const w = Number(chapa.largura_chapa) || 2750;
  const h = Number(chapa.altura_chapa) || 1850;
  const ratio = w / h;
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-white/80">
      <div
        className="border-2 border-dashed border-white/30 bg-white/5 flex items-center justify-center text-xs"
        style={{ width: 600, height: 600 / ratio }}
      >
        Preview não disponível
      </div>
      <div className="text-[11px] text-white/60">{chapa.material} • {chapa.cor_linha} • {chapa.espessura}mm • {w}x{h}mm</div>
    </div>
  );
}
