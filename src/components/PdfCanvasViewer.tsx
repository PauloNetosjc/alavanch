import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker import
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

// Configure worker once
if (typeof window !== "undefined" && !(pdfjsLib as any).GlobalWorkerOptions.workerPort) {
  try {
    (pdfjsLib as any).GlobalWorkerOptions.workerPort = new (PdfWorker as any)();
  } catch {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${(pdfjsLib as any).version}/build/pdf.worker.min.mjs`;
  }
}

type Props = { blobUrl: string };

export function PdfCanvasViewer({ blobUrl }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "rendering" | "ready" | "error">("loading");
  const [errMsg, setErrMsg] = useState<string>("");
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let pdfDoc: any = null;

    (async () => {
      try {
        setStatus("loading");
        const resp = await fetch(blobUrl);
        const buf = await resp.arrayBuffer();
        if (cancelled) return;
        const task = (pdfjsLib as any).getDocument({ data: buf });
        pdfDoc = await task.promise;
        if (cancelled) return;
        setNumPages(pdfDoc.numPages);
        setStatus("rendering");

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        const width = container.clientWidth || 800;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(i);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(2, Math.max(0.8, (width - 16) / baseViewport.width));
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 12px";
          canvas.style.boxShadow = "0 1px 3px rgba(0,0,0,0.15)";
          canvas.style.maxWidth = "100%";
          const ctx = canvas.getContext("2d")!;
          const dpr = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
        if (!cancelled) setStatus("ready");
      } catch (e: any) {
        console.error("[PdfCanvasViewer]", e);
        if (!cancelled) {
          setErrMsg(e?.message || "Falha ao renderizar PDF");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      try { pdfDoc?.destroy?.(); } catch {}
    };
  }, [blobUrl]);

  return (
    <div className="w-full h-full overflow-auto bg-muted/30 p-3">
      {status === "loading" && (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando arquivo…</p>
      )}
      {status === "rendering" && numPages > 0 && (
        <p className="text-xs text-muted-foreground text-center mb-2">Renderizando PDF ({numPages} página{numPages > 1 ? "s" : ""})…</p>
      )}
      {status === "error" && (
        <p className="text-sm text-destructive text-center py-8">Erro ao carregar PDF: {errMsg}</p>
      )}
      <div ref={containerRef} />
    </div>
  );
}
