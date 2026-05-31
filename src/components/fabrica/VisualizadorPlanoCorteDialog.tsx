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
  Play, CheckCircle2, ShieldCheck, RefreshCcw, CloudDownload,
} from "lucide-react";

import {
  getSignedUrlPacoteTecnico,
  processarArquivoSobDemanda,
  extrairNumeroChapaDoNome,
  normalizarNumeroChapa,
  diagnosticarPreviewChapa,
  repararPreviewChapa,
  reprocessarPreviewsPeloZip,
  materializarPreviewCortePdfDoZip,
  type DiagnosticoPreview,
} from "@/lib/fabrica/importacaoTecnica";
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
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewErroRender, setPreviewErroRender] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [filtroEtiq, setFiltroEtiq] = useState("");
  const [filtroArq, setFiltroArq] = useState({ pasta: "", tipo: "", ext: "", nome: "" });
  const [visaoCentral, setVisaoCentral] = useState<"preview" | "vetorial">("preview");
  const [reparando, setReparando] = useState(false);
  const [ultimoReparo, setUltimoReparo] = useState<any>(null);

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

  // Resolve preview arquivo da chapa: prioriza preview_large_id/preview_small_id,
  // mas faz fallback por "Chapa N" no nome do arquivo
  function resolverPreviewArquivo(chapa: any, tipo: "large_preview_cutting_plan" | "small_preview_cutting_plan"): any | null {
    if (!chapa) return null;
    const directId = tipo === "large_preview_cutting_plan" ? chapa.preview_large_id : chapa.preview_small_id;
    if (directId) {
      const arq = arquivos.find((a) => a.id === directId);
      if (arq) return arq;
    }
    const numChapa = normalizarNumeroChapa(chapa.numero_chapa);
    if (!numChapa) return null;
    return arquivos.find((a) =>
      a.tipo_arquivo === tipo && normalizarNumeroChapa(extrairNumeroChapaDoNome(a.nome_arquivo || "") || "") === numChapa
    ) || null;
  }

  // Resolve preview URL ao trocar chapa (com fallback)
  useEffect(() => {
    setPreviewUrl(null);
    setPreviewPdfUrl(null);
    setPreviewErroRender(false);
    setZoom(1);
    setUltimoReparo(null);
    if (!chapaSel) return;
    const arq = resolverPreviewArquivo(chapaSel, "large_preview_cutting_plan")
            || resolverPreviewArquivo(chapaSel, "small_preview_cutting_plan");
    if (!arq?.url_arquivo) return;
    getSignedUrlPacoteTecnico(arq.url_arquivo, 3600).then((u) => setPreviewUrl(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function carregarArquivoSobDemanda(arqId: string) {
    try {
      toast.loading("Extraindo arquivo do ZIP original...", { id: "ondemand" });
      const newPath = await processarArquivoSobDemanda(arqId);
      const { data: ar } = await (supabase as any)
        .from("fabrica_arquivos_tecnicos").select("*").eq("importacao_id", impSelId).limit(2000);
      setArquivos(ar || []);
      toast.success("Arquivo carregado", { id: "ondemand" });
      return newPath;
    } catch (e: any) {
      toast.error("Falha: " + (e?.message || e), { id: "ondemand" });
      return null;
    }
  }

  async function reprocessarPreviewsZip() {
    if (!impSelId) return;
    try {
      toast.loading("Lendo ZIP original e reprocessando previews...", { id: "reprocess-zip" });
      const r = await reprocessarPreviewsPeloZip(impSelId);
      const [{ data: ch }, { data: ar }] = await Promise.all([
        (supabase as any).from("fabrica_chapas_lote").select("*").eq("importacao_id", impSelId).order("ordem_chapa", { ascending: true, nullsFirst: false }),
        (supabase as any).from("fabrica_arquivos_tecnicos").select("*").eq("importacao_id", impSelId).order("origem_pasta").limit(2000),
      ]);
      setChapas(ch || []);
      setArquivos(ar || []);
      toast.success(
        `${r.totalArquivosZip ?? 0} arquivos analisados. ${r.previewsEncontradosZip ?? 0} previews no ZIP. ${r.vinculados} vínculo(s) criado(s). ${r.chapasSemPreview} chapa(s) ainda sem preview${r.previewCortePdfDisponivel ? " com fallback PDF" : ""}.`,
        { id: "reprocess-zip", duration: 8000 }
      );
    } catch (e: any) {
      toast.error("Falha: " + (e?.message || e), { id: "reprocess-zip" });
    }
  }

  async function repararPreviewDaChapa() {
    if (!chapaSel) return;
    setReparando(true);
    try {
      toast.loading("Procurando preview no ZIP...", { id: "reparar" });
      const r = await repararPreviewChapa(chapaSel.id);
      setUltimoReparo(r);
      if (!r.ok) {
        toast.error(r.mensagem, { id: "reparar", duration: 8000 });
      } else {
        // recarrega chapas e arquivos
        const [{ data: ch }, { data: ar }] = await Promise.all([
          (supabase as any).from("fabrica_chapas_lote").select("*").eq("importacao_id", impSelId).order("ordem_chapa", { ascending: true, nullsFirst: false }),
          (supabase as any).from("fabrica_arquivos_tecnicos").select("*").eq("importacao_id", impSelId).limit(2000),
        ]);
        setChapas(ch || []);
        setArquivos(ar || []);
        toast.success(r.mensagem, { id: "reparar", duration: 8000 });
      }
    } catch (e: any) {
      toast.error("Falha: " + (e?.message || e), { id: "reparar" });
    } finally {
      setReparando(false);
    }
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

  const previewCorteArquivo = useMemo(() => arquivos.find((a) => a.tipo_arquivo === "preview_corte_pdf") || null, [arquivos]);

  async function abrirPreviewCortePdfCentro() {
    if (!impSelId) return;
    try {
      toast.loading("Preparando PreviewCorte.pdf...", { id: "preview-corte" });
      let path = previewCorteArquivo?.url_arquivo || null;
      if (!path) {
        const r = await materializarPreviewCortePdfDoZip(impSelId);
        if (!r.ok || !r.path) {
          toast.error(r.mensagem, { id: "preview-corte", duration: 6000 });
          return;
        }
        path = r.path;
        const { data: ar } = await (supabase as any)
          .from("fabrica_arquivos_tecnicos").select("*").eq("importacao_id", impSelId).order("origem_pasta").limit(2000);
        setArquivos(ar || []);
      }
      const u = await getSignedUrlPacoteTecnico(path, 3600);
      if (!u) throw new Error("Não foi possível assinar o PreviewCorte.pdf");
      setPreviewPdfUrl(u);
      setPreviewUrl(null);
      setPreviewErroRender(false);
      toast.success("Preview individual não encontrado. Exibindo PreviewCorte.pdf geral.", { id: "preview-corte", duration: 5000 });
    } catch (e: any) {
      toast.error("Falha: " + (e?.message || e), { id: "preview-corte" });
    }
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
            <Button size="sm" variant="outline" onClick={reprocessarPreviewsZip} title="Reprocessar previews pelo ZIP original e atualizar vínculos">
              <RefreshCcw className="h-3 w-3 mr-1" /> Vínculos
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
                const hasPvPdf = !hasPv && !!previewCorteArquivo;
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
                      {hasPv ? (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">PV individual</Badge>
                      ) : hasPvPdf ? (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">PV PDF</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">Sem preview</Badge>
                      )}
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
                {previewPdfUrl ? (
                  <iframe
                    title="PreviewCorte.pdf"
                    src={previewPdfUrl}
                    className="w-full h-full bg-white rounded shadow-lg"
                  />
                ) : previewUrl && !previewErroRender ? (
                  <img
                    src={previewUrl}
                    alt={`Plano de corte chapa ${chapaSel?.numero_chapa}`}
                    onError={() => setPreviewErroRender(true)}
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                    className="max-w-full max-h-full object-contain bg-white shadow-lg transition-transform"
                  />
                ) : chapaSel ? (
                  <PlaceholderChapa
                    chapa={chapaSel}
                    arquivos={arquivos}
                    previewUrl={previewErroRender ? previewUrl : null}
                    arquivoCatalogado={
                      resolverPreviewArquivo(chapaSel, "large_preview_cutting_plan")
                      || resolverPreviewArquivo(chapaSel, "small_preview_cutting_plan")
                    }
                    previewCorteDisponivel={!!previewCorteArquivo || !!ultimoReparo?.previewCortePdfDisponivel}
                    ultimoReparo={ultimoReparo}
                    reparando={reparando}
                    onReparar={repararPreviewDaChapa}
                    onAbrirPreviewCorte={abrirPreviewCortePdfCentro}
                    onCarregar={async (id) => {
                      const p = await carregarArquivoSobDemanda(id);
                      if (p) {
                        const u = await getSignedUrlPacoteTecnico(p, 3600);
                        if (u) { setPreviewUrl(u); setPreviewErroRender(false); }
                      }
                    }}
                  />
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
                        <ArqBtn label="NC" icon={Cpu} arqId={chapaSel.arquivo_nc_id} arquivos={arquivos} onAbrir={baixarArquivoId} onCarregar={carregarArquivoSobDemanda} fallbackTipo="nc_chapa" chapaId={chapaSel.id} />
                        <ArqBtn label="CYC" icon={FileText} arqId={chapaSel.arquivo_cyc_id} arquivos={arquivos} onAbrir={baixarArquivoId} onCarregar={carregarArquivoSobDemanda} fallbackTipo="cyc_chapa" chapaId={chapaSel.id} />
                        <ArqBtn
                          label="Preview Large" icon={ImageIcon}
                          arqId={chapaSel.preview_large_id || resolverPreviewArquivo(chapaSel, "large_preview_cutting_plan")?.id}
                          arquivos={arquivos} onAbrir={baixarArquivoId} onCarregar={carregarArquivoSobDemanda}
                        />
                        <ArqBtn
                          label="Preview Small" icon={ImageIcon}
                          arqId={chapaSel.preview_small_id || resolverPreviewArquivo(chapaSel, "small_preview_cutting_plan")?.id}
                          arquivos={arquivos} onAbrir={baixarArquivoId} onCarregar={carregarArquivoSobDemanda}
                        />
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
            </>
            )}
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
  label, icon: Icon, arqId, arquivos, onAbrir, onCarregar, fallbackTipo, chapaId,
}: {
  label: string;
  icon: any;
  arqId: string | null | undefined;
  arquivos: any[];
  onAbrir: (id: string) => void;
  onCarregar?: (id: string) => Promise<any>;
  fallbackTipo?: string;
  chapaId?: string;
}) {
  let id = arqId || null;
  if (!id && fallbackTipo && chapaId) {
    id = arquivos.find((a) => a.tipo_arquivo === fallbackTipo && a.chapa_id === chapaId)?.id || null;
  }
  const arq = id ? arquivos.find((a) => a.id === id) : null;
  const enviado = !!arq?.url_arquivo && (arq?.status_arquivo || "enviado") === "enviado";
  const catalogado = !!arq && !enviado && (arq?.status_arquivo === "catalogado_nao_enviado" || arq?.status_arquivo === "erro_upload");

  if (!id) {
    return (
      <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7" disabled>
        <Icon className="h-3 w-3 mr-1" /> {label}
        <span className="ml-auto text-muted-foreground text-[10px]">indisponível</span>
      </Button>
    );
  }
  if (catalogado && onCarregar) {
    return (
      <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7"
        onClick={() => onCarregar(id!)}
        title="Catalogado no ZIP — carregar do ZIP original">
        <CloudDownload className="h-3 w-3 mr-1" /> {label}
        <span className="ml-auto text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 text-[10px]">catalogado</span>
      </Button>
    );
  }
  return (
    <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7" onClick={() => onAbrir(id!)}>
      <Icon className="h-3 w-3 mr-1" /> {label}
      <span className="ml-auto text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 text-[10px]">disponível</span>
    </Button>
  );
}

function PlaceholderChapa({ chapa, arquivos, arquivoCatalogado, onCarregar, onReparar, onAbrirPreviewCorte, reparando, previewUrl, previewCorteDisponivel, ultimoReparo }: {
  chapa: any;
  arquivos: any[];
  arquivoCatalogado?: any | null;
  onCarregar?: (id: string) => void | Promise<any>;
  onReparar?: () => void | Promise<any>;
  onAbrirPreviewCorte?: () => void | Promise<any>;
  reparando?: boolean;
  previewUrl?: string | null;
  previewCorteDisponivel?: boolean;
  ultimoReparo?: any;
}) {
  const w = Number(chapa.largura_chapa) || 2750;
  const h = Number(chapa.altura_chapa) || 1850;
  const ratio = w / h;
  const podeCarregar = arquivoCatalogado && !arquivoCatalogado.url_arquivo;
  const diag: DiagnosticoPreview = diagnosticarPreviewChapa(chapa, arquivos);
  const erroRender = !!previewUrl;
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-white/80">
      <div
        className="border-2 border-dashed border-white/30 bg-white/5 flex flex-col items-center justify-center text-xs gap-2 p-4"
        style={{ width: 600, height: 600 / ratio, maxWidth: "100%" }}
      >
        <span className="font-medium text-center">
          {erroRender ? "Preview não pôde ser renderizado pelo navegador" : "Preview individual não encontrado para esta chapa."}
        </span>
        {!erroRender && (
          <span className="text-white/60 text-center max-w-md">
            Use o PreviewCorte.pdf geral ou tente reparar buscando diretamente dentro do ZIP original.
          </span>
        )}
        <div className="flex flex-wrap gap-1 justify-center">
          {onAbrirPreviewCorte && (
            <Button size="sm" variant="secondary" onClick={() => onAbrirPreviewCorte()}>
              <FileText className="h-3 w-3 mr-1" /> {previewCorteDisponivel ? "Abrir PreviewCorte.pdf" : "Usar PreviewCorte.pdf"}
            </Button>
          )}
          {podeCarregar && onCarregar && (
            <Button size="sm" variant="secondary" onClick={() => onCarregar(arquivoCatalogado.id)}>
              <CloudDownload className="h-3 w-3 mr-1" /> Carregar preview do ZIP
            </Button>
          )}
          {onReparar && (
            <Button size="sm" variant="secondary" onClick={() => onReparar()} disabled={reparando}>
              <RefreshCcw className={`h-3 w-3 mr-1 ${reparando ? "animate-spin" : ""}`} />
              {reparando ? "Procurando..." : "Reparar preview desta chapa"}
            </Button>
          )}
          {erroRender && previewUrl && (
            <a href={previewUrl} download className="inline-flex items-center gap-1 text-xs px-2 h-8 rounded bg-white/10 hover:bg-white/20">
              <Download className="h-3 w-3" /> {arquivoCatalogado?.extensao === "bmp" ? "Baixar BMP" : "Baixar preview"}
            </a>
          )}
        </div>
        {(arquivoCatalogado?.extensao === "bmp" || ultimoReparo?.candidatos?.some?.((c: any) => c.status === "bmp")) && (
          <div className="text-[11px] text-amber-200 text-center max-w-md">
            Arquivo BMP encontrado, mas o navegador pode não exibir este formato. Use baixar BMP se a imagem não abrir.
          </div>
        )}
      </div>
      <div className="text-[11px] text-white/60">{chapa.material} • {chapa.cor_linha} • {chapa.espessura}mm • {w}x{h}mm</div>

      {/* Diagnóstico do preview */}
      <details className="text-[11px] text-white/70 bg-white/5 border border-white/10 rounded px-3 py-2 w-full max-w-[600px]">
        <summary className="cursor-pointer select-none text-white/80">Diagnóstico do preview</summary>
        <div className="mt-2 space-y-1">
          <div>Número da chapa: <span className="font-mono">{diag.numeroChapa ?? "—"}</span> (normalizado: <span className="font-mono">{diag.numeroNormalizado ?? "—"}</span>)</div>
          <div>LargePreview na importação: <span className="font-mono">{diag.totalLarge}</span> • SmallPreview: <span className="font-mono">{diag.totalSmall}</span></div>
          <div>Banco: PreviewCorte.pdf <span className="font-mono">{diag.previewCortePdfCatalogado ? "sim" : "não"}</span> • Labels PDF <span className="font-mono">{diag.labelsPdfCatalogado ? "sim" : "não"}</span> • List <span className="font-mono">{diag.listCatalogado ? "sim" : "não"}</span></div>
          {ultimoReparo && (
            <div>ZIP: <span className="font-mono">{ultimoReparo.totalArquivosZip ?? "—"}</span> arquivos • <span className="font-mono">{ultimoReparo.previewsEncontradosZip ?? "—"}</span> previews • <span className="font-mono">{ultimoReparo.candidatosChapa ?? "—"}</span> para esta chapa • PreviewCorte <span className="font-mono">{ultimoReparo.previewCortePdfDisponivel ? "sim" : "não"}</span></div>
          )}
          <div>Candidatos para esta chapa: <span className="font-mono">{diag.candidatos.length}</span></div>
          {diag.candidatos.slice(0, 5).map((c) => (
            <div key={c.id} className="font-mono text-[10px] text-white/60 truncate">
              • {c.nome} <span className="text-white/40">[{c.tipo}]</span>{" "}
              <span className={
                c.status === "enviado" ? "text-emerald-300"
                : c.status === "catalogado_nao_enviado" ? "text-amber-300"
                : "text-red-300"
              }>{c.status}</span>
            </div>
          ))}
          {ultimoReparo?.candidatos?.slice?.(0, 5).map((c: any) => (
            <div key={c.caminho} className="font-mono text-[10px] text-white/60 truncate">
              • ZIP: {c.caminho} <span className="text-white/40">[{c.tipo}]</span>
            </div>
          ))}
          <div className="text-white/80 pt-1">Motivo provável: <span className="text-amber-200">{diag.motivoProvavel}</span></div>
          {ultimoReparo?.mensagem && <div className="text-white/80 pt-1">Última busca no ZIP: <span className="text-amber-200">{ultimoReparo.mensagem}</span></div>}
        </div>
      </details>
    </div>
  );
}

