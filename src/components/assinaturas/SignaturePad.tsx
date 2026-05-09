import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
};

export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string; height?: number }>(
  function SignaturePad({ className, height = 180 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const emptyRef = useRef(true);
    const lastRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current!;
      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#0f172a";
      };
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }, []);

    const getPos = (e: React.PointerEvent) => {
      const r = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onDown = (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastRef.current = getPos(e);
    };
    const onMove = (e: React.PointerEvent) => {
      if (!drawingRef.current) return;
      const ctx = canvasRef.current!.getContext("2d")!;
      const p = getPos(e);
      const last = lastRef.current!;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastRef.current = p;
      emptyRef.current = false;
    };
    const onUp = () => {
      drawingRef.current = false;
      lastRef.current = null;
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        const c = canvasRef.current!;
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, c.width, c.height);
        emptyRef.current = true;
      },
      isEmpty: () => emptyRef.current,
      toDataURL: () => canvasRef.current!.toDataURL("image/png"),
    }));

    return (
      <div className={className}>
        <div className="rounded-md border bg-white" style={{ height }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full touch-none rounded-md"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>
        <div className="flex justify-end mt-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              const c = canvasRef.current!;
              const ctx = c.getContext("2d")!;
              ctx.clearRect(0, 0, c.width, c.height);
              emptyRef.current = true;
            }}
          >
            <Eraser className="w-3.5 h-3.5 mr-1" /> Limpar
          </Button>
        </div>
      </div>
    );
  }
);
