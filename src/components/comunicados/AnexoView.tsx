import { FileText, Image as ImageIcon, Video, Link as LinkIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Comunicado } from "@/hooks/useComunicadosSaaS";

export function anexoIcon(tipo?: string | null) {
  switch (tipo) {
    case "imagem": return <ImageIcon className="w-3.5 h-3.5" />;
    case "pdf": return <FileText className="w-3.5 h-3.5" />;
    case "video": return <Video className="w-3.5 h-3.5" />;
    case "link": return <LinkIcon className="w-3.5 h-3.5" />;
    default: return null;
  }
}

export function anexoLabel(tipo?: string | null) {
  switch (tipo) {
    case "imagem": return "Imagem";
    case "pdf": return "PDF";
    case "video": return "Vídeo";
    case "link": return "Link";
    default: return "Sem anexo";
  }
}

/** Renderiza o anexo do comunicado (preview/botões). */
export function AnexoView({ c, compact = false }: { c: Comunicado; compact?: boolean }) {
  if (!c.anexo_tipo || c.anexo_tipo === "nenhum") return null;
  const url = c.anexo_url;

  if (c.anexo_tipo === "imagem" && url) {
    return (
      <div className="mt-3 rounded-md overflow-hidden border bg-secondary/30">
        <img
          src={url}
          alt={c.anexo_nome || c.titulo}
          className={compact ? "max-h-40 w-full object-contain" : "max-h-72 w-full object-contain"}
          loading="lazy"
        />
      </div>
    );
  }

  if (c.anexo_tipo === "pdf" && url) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-md border p-2.5 bg-secondary/30">
        <FileText className="w-4 h-4 text-red-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium truncate">{c.anexo_nome || "Documento PDF"}</div>
          {c.anexo_tamanho_bytes && (
            <div className="text-[10px] text-muted-foreground">
              {(Number(c.anexo_tamanho_bytes) / 1024 / 1024).toFixed(2)} MB
            </div>
          )}
        </div>
        <Button size="sm" variant="outline" asChild className="h-7 text-[11px]">
          <a href={url} target="_blank" rel="noreferrer"><Download className="w-3 h-3 mr-1" /> Ver PDF</a>
        </Button>
      </div>
    );
  }

  if (c.anexo_tipo === "video" && url) {
    const isFile = url.includes("/storage/v1/") || /\.(mp4|webm|mov)(\?|$)/i.test(url);
    if (isFile && !compact) {
      return (
        <div className="mt-3 rounded-md overflow-hidden border bg-black">
          <video src={url} controls preload="metadata" className="w-full max-h-72" />
        </div>
      );
    }
    return (
      <div className="mt-3">
        <Button size="sm" variant="outline" asChild className="h-8 text-[12px] gap-1.5">
          <a href={url} target="_blank" rel="noreferrer"><Video className="w-3.5 h-3.5" /> Assistir vídeo</a>
        </Button>
      </div>
    );
  }

  if (c.anexo_tipo === "link" && url) {
    return (
      <div className="mt-3">
        <Button size="sm" asChild className="h-8 text-[12px] gap-1.5">
          <a href={url} target="_blank" rel="noreferrer">
            <LinkIcon className="w-3.5 h-3.5" /> {c.anexo_texto_botao || "Abrir link"}
          </a>
        </Button>
      </div>
    );
  }

  return null;
}
