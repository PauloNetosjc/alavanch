import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, ZoomIn, ZoomOut, Maximize, Printer, ExternalLink, Tag as TagIcon,
  AlertTriangle, Image as ImageIcon, FileText, Cpu, Play,
} from "lucide-react";
import { getSignedUrlPacoteTecnico } from "@/lib/fabrica/importacaoTecnica";
import { DadosVetoriaisPanel } from "@/components/fabrica/DadosVetoriaisPanel";
import { toast } from "sonner";

interface Props {
  importacaoId: string | null;
  chapa: any | null;
  arquivos: any[];
  etiquetas: any[];
  pedido?: any;
  previewUrl?: string | null;
}

type Filtro = "todas" | "peca_real" | "sobras" | "sem_coord" | "divergentes";

const TIPO_LABEL: Record<string, string> = {
  peca_real: "Peça",
  sobra: "Sobra",
  retalho: "Retalho",
  desconhecido: "?",
};

const TIPO_FILL: Record<string, string> = {
  peca_real: "hsl(var(--primary) / 0.15)",
  sobra: "hsl(var(--muted-foreground) / 0.10)",
  retalho: "hsl(var(--muted-foreground) / 0.05)",
  desconhecido: "hsl(var(--muted) / 0.30)",
};
const TIPO_STROKE: Record<string, string> = {
  peca_real: "hsl(var(--primary))",
  sobra: "hsl(var(--muted-foreground))",
  retalho: "hsl(var(--muted-foreground))",
  desconhecido: "hsl(var(--border))",
};

export function VisualizadorVetorialChapa({
  importacaoId, chapa, arquivos, etiquetas, pedido, previewUrl,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [pecas, setPecas] = useState<any[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [modo, setModo] = useState<"vetorial" | "preview">("vetorial");
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 540 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setContainerSize({ w: r.width, h: r.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  async function carregar() {
    if (!importacaoId || !chapa?.id) {
      setPecas([]); setLoading(false); return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("fabrica_plano_corte_pecas")
      .select("*")
      .eq("importacao_id", importacaoId)
      .eq("chapa_id", chapa.id)
      .order("indice_peca", { nullsFirst: false });
    setPecas((data as any[]) || []);
    setSelId(null);
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [importacaoId, chapa?.id]);

  // Normaliza dimensão da chapa: força 2750x1850 quando vier invertido
  const dimChapa = useMemo(() => {
    let w = Number(chapa?.largura_chapa) || 2750;
    let h = Number(chapa?.altura_chapa) || 1850;
    if (w < h) { const t = w; w = h; h = t; }
    return { w, h };
  }, [chapa]);

  const pecasComCoord = useMemo(
    () => pecas.filter((p) => p.posicao_x != null && p.posicao_y != null && p.largura && p.altura),
    [pecas]
  );
  const pecasSemCoord = useMemo(
    () => pecas.filter((p) => p.posicao_x == null || p.posicao_y == null || !p.largura || !p.altura),
    [pecas]
  );
  const divergentes = useMemo(() => pecas.filter((p) => p.status_item === "divergente"), [pecas]);

  const pecasFiltradas = useMemo(() => {
    switch (filtro) {
      case "peca_real": return pecas.filter((p) => p.tipo_item === "peca_real");
      case "sobras": return pecas.filter((p) => p.tipo_item === "sobra" || p.tipo_item === "retalho");
      case "sem_coord": return pecasSemCoord;
      case "divergentes": return divergentes;
      default: return pecas;
    }
  }, [pecas, filtro, pecasSemCoord, divergentes]);

  const sel = useMemo(() => pecas.find((p) => p.id === selId) || null, [pecas, selId]);

  // Escala SVG
  const padding = 24;
  const availW = Math.max(200, containerSize.w - padding * 2);
  const availH = Math.max(200, containerSize.h - padding * 2);
  const baseScale = Math.min(availW / dimChapa.w, availH / dimChapa.h);
  const scale = baseScale * zoom;
  const svgW = dimChapa.w * scale;
  const svgH = dimChapa.h * scale;

  const etiqMap = useMemo(() => {
    const m: Record<string, any> = {};
    etiquetas.forEach((e) => { m[e.id] = e; });
    return m;
  }, [etiquetas]);

  async function alterarStatusPeca(novo: string) {
    if (!sel) return;
    const { error } = await (supabase as any)
      .from("fabrica_plano_corte_pecas")
      .update({ status_item: novo, updated_at: new Date().toISOString() })
      .eq("id", sel.id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Status atualizado");
    setPecas((arr) => arr.map((p) => (p.id === sel.id ? { ...p, status_item: novo } : p)));
  }

  async function abrirArquivoId(id: string | null | undefined) {
    if (!id) return toast.error("Arquivo indisponível");
    const arq = arquivos.find((a) => a.id === id);
    if (!arq?.url_arquivo) return toast.error("Arquivo indisponível");
    const u = await getSignedUrlPacoteTecnico(arq.url_arquivo, 3600);
    if (u) window.open(u, "_blank");
  }

  function imprimirVetorial() {
    const svg = document.getElementById("svg-vetorial-chapa");
    if (!svg) return window.print();
    window.print();
  }

  if (!chapa) {
    return <div className="text-xs text-muted-foreground p-4">Selecione uma chapa para visualizar o plano vetorial.</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Topo */}
      <div className="border-b px-3 py-2 flex items-center justify-between gap-2 flex-wrap text-xs bg-muted/30 print:hidden">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Badge variant="outline" className="font-mono">Chapa {chapa.numero_chapa}</Badge>
          <span className="text-muted-foreground truncate">
            {chapa.material || "—"}{chapa.cor_linha ? ` • ${chapa.cor_linha}` : ""}
            {chapa.espessura ? ` • ${chapa.espessura}mm` : ""} • {dimChapa.w}x{dimChapa.h}mm
          </span>
          {chapa.aproveitamento != null && (
            <Badge variant="outline" className="text-[10px]">Aprov. {Number(chapa.aproveitamento).toFixed(1)}%</Badge>
          )}
          <Badge variant="outline" className="bg-primary/5 text-[10px]">
            {pecasComCoord.length} c/ coord
          </Badge>
          {pecasSemCoord.length > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
              {pecasSemCoord.length} sem coord
            </Badge>
          )}
          {divergentes.length > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
              {divergentes.length} divergentes
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="inline-flex border rounded overflow-hidden">
            <Button
              size="sm" variant={modo === "vetorial" ? "default" : "ghost"}
              className="h-7 rounded-none text-xs px-2" onClick={() => setModo("vetorial")}
            >Vetorial</Button>
            <Button
              size="sm" variant={modo === "preview" ? "default" : "ghost"}
              className="h-7 rounded-none text-xs px-2" onClick={() => setModo("preview")}
            >Preview</Button>
          </div>
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
            <ZoomOut className="h-3 w-3" />
          </Button>
          <span className="w-10 text-center font-mono">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="outline" className="h-7 w-7" title="Ajustar à tela" onClick={() => setZoom(1)}>
            <Maximize className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-7" onClick={imprimirVetorial}>
            <Printer className="h-3 w-3 mr-1" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Corpo */}
      <div className="flex-1 grid grid-cols-12 min-h-0 overflow-hidden">
        {/* Esquerda: filtros + lista */}
        <aside className="col-span-3 border-r flex flex-col min-h-0 print:hidden">
          <div className="p-2 border-b space-y-2">
            <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas ({pecas.length})</SelectItem>
                <SelectItem value="peca_real">Peças reais</SelectItem>
                <SelectItem value="sobras">Sobras/retalhos</SelectItem>
                <SelectItem value="sem_coord">Sem coordenada ({pecasSemCoord.length})</SelectItem>
                <SelectItem value="divergentes">Divergentes ({divergentes.length})</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-[10px] text-muted-foreground">{pecasFiltradas.length} item(ns)</div>
          </div>
          <div className="flex-1 overflow-y-auto p-1 space-y-1">
            {loading && <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>}
            {!loading && pecasFiltradas.length === 0 && (
              <div className="text-xs text-muted-foreground text-center p-3">Nenhum item.</div>
            )}
            {!loading && pecasFiltradas.map((p) => {
              const ativo = p.id === selId;
              const semPos = p.posicao_x == null || p.posicao_y == null;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelId(p.id)}
                  className={`w-full text-left rounded border px-2 py-1.5 text-xs transition ${
                    ativo ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-medium truncate">
                      #{p.indice_peca ?? "—"} {p.codigo_peca || "—"}
                    </span>
                    <Badge variant="outline" className="text-[9px]">{TIPO_LABEL[p.tipo_item] || p.tipo_item}</Badge>
                  </div>
                  <div className="text-muted-foreground text-[10px] truncate">
                    {p.descricao || "—"} {p.largura && p.altura ? `• ${p.largura}×${p.altura}` : ""}
                  </div>
                  {semPos && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] mt-0.5">
                      Sem coordenada
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Centro: SVG / preview */}
        <main className="col-span-6 bg-neutral-100 dark:bg-neutral-900/60 overflow-auto min-h-0 print:bg-white">
          <div ref={containerRef} className="w-full h-full flex items-center justify-center p-4">
            {pecas.length === 0 && !loading ? (
              <div className="text-center space-y-3">
                <Cpu className="h-8 w-8 mx-auto text-muted-foreground" />
                <div className="text-sm text-muted-foreground">Nenhum dado vetorial processado para esta chapa.</div>
                <DadosVetoriaisPanel importacaoId={importacaoId} compact />
              </div>
            ) : modo === "preview" ? (
              previewUrl ? (
                <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain shadow-lg bg-white" />
              ) : (
                <div className="text-xs text-muted-foreground">Preview indisponível para esta chapa.</div>
              )
            ) : loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <ChapaSVG
                dim={dimChapa}
                pecas={pecasComCoord}
                svgW={svgW}
                svgH={svgH}
                selId={selId}
                onSelect={setSelId}
              />
            )}
          </div>
        </main>

        {/* Direita: detalhe */}
        <aside className="col-span-3 border-l overflow-y-auto p-2 space-y-2 print:hidden">
          {!sel ? (
            <Card className="p-3 text-xs text-muted-foreground">
              Clique em uma peça para ver detalhes.
            </Card>
          ) : (
            <>
              <Card className="p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold font-mono">#{sel.indice_peca ?? "—"} {sel.codigo_peca || "—"}</div>
                  <Badge variant="outline" className="text-[10px]">{TIPO_LABEL[sel.tipo_item] || sel.tipo_item}</Badge>
                </div>
                <Row k="Referência" v={sel.referencia_peca || "—"} />
                <Row k="Descrição" v={sel.descricao || "—"} />
                <Row k="Medida" v={sel.largura && sel.altura ? `${sel.largura} × ${sel.altura} mm` : "—"} />
                <Row k="Espessura" v={sel.espessura ? `${sel.espessura} mm` : "—"} />
                <Row k="Material" v={sel.material || "—"} />
                <Row k="Cor/linha" v={sel.cor_linha || "—"} />
                <Row k="Módulo" v={sel.modulo_pai || "—"} />
                <Row k="Ambiente" v={sel.ambiente || "—"} />
                <Row k="Chapa" v={chapa.numero_chapa || "—"} />
                <Row k="Posição" v={
                  sel.posicao_x != null && sel.posicao_y != null
                    ? `X ${Number(sel.posicao_x).toFixed(0)} • Y ${Number(sel.posicao_y).toFixed(0)}`
                    : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Sem coordenada</Badge>
                } />
                <Row k="Rotação" v={`${Number(sel.rotacao || 0)}°`} />
                <Row k="Status" v={
                  <Badge variant="outline" className={`text-[10px] ${
                    sel.status_item === "vinculado" ? "bg-green-50 text-green-700 border-green-200" :
                    sel.status_item === "divergente" ? "bg-red-50 text-red-700 border-red-200" :
                    sel.status_item === "ignorado" ? "bg-slate-50 text-slate-600 border-slate-200" : ""
                  }`}>{sel.status_item}</Badge>
                } />
              </Card>

              {/* Etiqueta vinculada */}
              <Card className="p-2 text-xs space-y-1">
                <div className="text-[10px] uppercase text-muted-foreground">Etiqueta vinculada</div>
                {sel.etiqueta_id && etiqMap[sel.etiqueta_id] ? (
                  <>
                    <div className="font-mono truncate">{etiqMap[sel.etiqueta_id].codigo_etiqueta_completo}</div>
                    <div className="flex gap-1 flex-wrap">
                      {etiqMap[sel.etiqueta_id].arquivo_etiqueta_id && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => abrirArquivoId(etiqMap[sel.etiqueta_id].arquivo_etiqueta_id)}>
                          <ExternalLink className="h-3 w-3 mr-1" /> Ver
                        </Button>
                      )}
                      {etiqMap[sel.etiqueta_id].arquivo_bmp_id && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => abrirArquivoId(etiqMap[sel.etiqueta_id].arquivo_bmp_id)}>
                          <ImageIcon className="h-3 w-3 mr-1" /> BMP
                        </Button>
                      )}
                      {etiqMap[sel.etiqueta_id].arquivo_pdf_id && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => abrirArquivoId(etiqMap[sel.etiqueta_id].arquivo_pdf_id)}>
                          <FileText className="h-3 w-3 mr-1" /> PDF
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => window.print()}>
                        <Printer className="h-3 w-3 mr-1" /> Imprimir
                      </Button>
                    </div>
                  </>
                ) : (
                  <Badge variant="outline" className="text-[10px]">Sem etiqueta vinculada</Badge>
                )}
              </Card>

              {/* Ações */}
              <Card className="p-2 space-y-1">
                <div className="text-[10px] uppercase text-muted-foreground">Ações</div>
                <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7"
                  onClick={() => alterarStatusPeca("divergente")} disabled={sel.status_item === "divergente"}>
                  <AlertTriangle className="h-3 w-3 mr-1" /> Marcar divergente
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7"
                  onClick={() => alterarStatusPeca("ignorado")} disabled={sel.status_item === "ignorado"}>
                  Marcar ignorada
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start text-xs h-7"
                  onClick={() => alterarStatusPeca("importado")} disabled={sel.status_item === "importado"}>
                  Voltar para importado
                </Button>
              </Card>
            </>
          )}

          {/* Peças sem coordenada (resumo) */}
          {pecasSemCoord.length > 0 && (
            <Card className="p-2 space-y-1">
              <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                Sem coordenada ({pecasSemCoord.length})
              </div>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {pecasSemCoord.slice(0, 50).map((p) => (
                  <button key={p.id} className="w-full text-left text-[10px] hover:bg-muted rounded px-1 py-0.5 font-mono truncate"
                    onClick={() => setSelId(p.id)}>
                    #{p.indice_peca ?? "—"} {p.codigo_peca || "—"}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </aside>
      </div>

      {/* Print */}
      <div className="hidden print:block p-4 text-xs">
        <h2 className="font-bold text-lg">Plano de corte vetorial — Chapa {chapa.numero_chapa}</h2>
        <div>{pedido?.codigo ? `Pedido ${pedido.codigo}` : ""} {pedido?.cliente?.nome ? `• ${pedido.cliente.nome}` : ""}</div>
        <div>{chapa.material} {chapa.cor_linha} {chapa.espessura ? `${chapa.espessura}mm` : ""} • {dimChapa.w}×{dimChapa.h}mm</div>
        <div className="mt-2 border p-2 inline-block">
          <ChapaSVG dim={dimChapa} pecas={pecasComCoord} svgW={700} svgH={700 * (dimChapa.h / dimChapa.w)} selId={null} onSelect={() => {}} />
        </div>
        <div className="mt-3 font-semibold">Peças ({pecasComCoord.length} c/ coord, {pecasSemCoord.length} s/ coord)</div>
        <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
          {pecas.slice(0, 200).map((p) => (
            <div key={p.id}>#{p.indice_peca ?? "—"} {p.codigo_peca || "—"} {p.largura && p.altura ? `${p.largura}×${p.altura}` : ""}</div>
          ))}
        </div>
      </div>
    </div>
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

interface ChapaSVGProps {
  dim: { w: number; h: number };
  pecas: any[];
  svgW: number;
  svgH: number;
  selId: string | null;
  onSelect: (id: string) => void;
}

function ChapaSVG({ dim, pecas, svgW, svgH, selId, onSelect }: ChapaSVGProps) {
  const sx = svgW / dim.w;
  const sy = svgH / dim.h;
  return (
    <TooltipProvider delayDuration={150}>
      <svg
        id="svg-vetorial-chapa"
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${dim.w} ${dim.h}`}
        className="bg-white shadow-lg border"
        style={{ maxWidth: "100%", maxHeight: "100%" }}
      >
        {/* Borda da chapa */}
        <rect x={0} y={0} width={dim.w} height={dim.h} fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth={Math.max(2, 4 / Math.min(sx, sy))} />
        {/* Grid de referência (a cada 250mm) */}
        {Array.from({ length: Math.floor(dim.w / 250) }).map((_, i) => (
          <line key={`vx${i}`} x1={(i + 1) * 250} y1={0} x2={(i + 1) * 250} y2={dim.h}
            stroke="hsl(var(--border))" strokeWidth={0.5 / Math.min(sx, sy)} opacity={0.4} />
        ))}
        {Array.from({ length: Math.floor(dim.h / 250) }).map((_, i) => (
          <line key={`hy${i}`} x1={0} y1={(i + 1) * 250} x2={dim.w} y2={(i + 1) * 250}
            stroke="hsl(var(--border))" strokeWidth={0.5 / Math.min(sx, sy)} opacity={0.4} />
        ))}

        {pecas.map((p) => {
          const rot = Number(p.rotacao || 0);
          const flip = rot === 90 || rot === 270;
          const w = Number(flip ? p.altura : p.largura);
          const h = Number(flip ? p.largura : p.altura);
          const x = Number(p.posicao_x);
          const y = Number(p.posicao_y);
          const ativo = p.id === selId;
          const divergente = p.status_item === "divergente";
          const fill = divergente ? "hsl(var(--destructive) / 0.2)" : TIPO_FILL[p.tipo_item] || TIPO_FILL.desconhecido;
          const stroke = ativo ? "hsl(var(--primary))" : divergente ? "hsl(var(--destructive))" : TIPO_STROKE[p.tipo_item] || TIPO_STROKE.desconhecido;
          const strokeW = (ativo ? 3 : 1) / Math.min(sx, sy);
          const fontSize = Math.min(w, h) * 0.18;

          return (
            <Tooltip key={p.id}>
              <TooltipTrigger asChild>
                <g
                  className="cursor-pointer"
                  onClick={() => onSelect(p.id)}
                  style={{ transition: "opacity 0.15s" }}
                >
                  <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={strokeW} />
                  {fontSize > 6 && (
                    <text
                      x={x + w / 2} y={y + h / 2}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.min(fontSize, 60)}
                      fill="hsl(var(--foreground))"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {p.indice_peca ? `#${p.indice_peca}` : ""}
                      {p.codigo_peca ? ` ${p.codigo_peca}` : ""}
                    </text>
                  )}
                  {fontSize > 10 && p.largura && p.altura && (
                    <text
                      x={x + w / 2} y={y + h / 2 + fontSize}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.min(fontSize * 0.7, 40)}
                      fill="hsl(var(--muted-foreground))"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {p.largura}×{p.altura}
                    </text>
                  )}
                </g>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="space-y-0.5">
                  <div className="font-mono font-semibold">#{p.indice_peca ?? "—"} {p.codigo_peca || "—"}</div>
                  {p.descricao && <div>{p.descricao}</div>}
                  {p.largura && p.altura && <div>{p.largura} × {p.altura} mm</div>}
                  <div className="text-muted-foreground">
                    {TIPO_LABEL[p.tipo_item] || p.tipo_item} • {p.status_item}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </svg>
    </TooltipProvider>
  );
}
