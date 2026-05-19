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
      let ctx: CanvasRenderingContext2D | null = null;

      const setup = () => {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#0f172a";
      };
      setup();
      const ro = new ResizeObserver(setup);
      ro.observe(canvas);

      const getPos = (clientX: number, clientY: number) => {
        const r = canvas.getBoundingClientRect();
        return { x: clientX - r.left, y: clientY - r.top };
      };

      const start = (clientX: number, clientY: number) => {
        if (!ctx) setup();
        drawingRef.current = true;
        lastRef.current = getPos(clientX, clientY);
      };
      const move = (clientX: number, clientY: number) => {
        if (!drawingRef.current || !ctx) return;
        const p = getPos(clientX, clientY);
        const last = lastRef.current!;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        lastRef.current = p;
        emptyRef.current = false;
      };
      const end = () => {
        drawingRef.current = false;
        lastRef.current = null;
      };

      // Touch handlers with preventDefault to stop scrolling/panning on mobile
      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        start(t.clientX, t.clientY);
      };
      const onTouchMove = (e: TouchEvent) => {
        if (!drawingRef.current || e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        move(t.clientX, t.clientY);
      };
      const onTouchEnd = (e: TouchEvent) => {
        if (!drawingRef.current) return;
        e.preventDefault();
        end();
      };

      // Mouse handlers
      const onMouseDown = (e: MouseEvent) => { start(e.clientX, e.clientY); };
      const onMouseMove = (e: MouseEvent) => { if (drawingRef.current) move(e.clientX, e.clientY); };
      const onMouseUp = () => { end(); };

      canvas.addEventListener("touchstart", onTouchStart, { passive: false });
      canvas.addEventListener("touchmove", onTouchMove, { passive: false });
      canvas.addEventListener("touchend", onTouchEnd, { passive: false });
      canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });
      canvas.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);

      return () => {
        ro.disconnect();
        canvas.removeEventListener("touchstart", onTouchStart);
        canvas.removeEventListener("touchmove", onTouchMove);
        canvas.removeEventListener("touchend", onTouchEnd);
        canvas.removeEventListener("touchcancel", onTouchEnd);
        canvas.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
    }, []);

    useImperativeHandle(ref, () => ({
      clear: () => {
        const c = canvasRef.current!;
        const ctx = c.getContext("2d")!;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.restore();
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
            className="w-full h-full rounded-md block"
            style={{ touchAction: "none", WebkitUserSelect: "none", userSelect: "none" }}
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
              ctx.save();
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.clearRect(0, 0, c.width, c.height);
              ctx.restore();
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
