import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, FileText, Pen, Eraser } from "lucide-react";
import { toast } from "sonner";
import { renderContratoHtml, type ContratoTemplate, type ContratoCtx } from "@/lib/contratoTemplate";

export default function ContratoAssinar() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [contrato, setContrato] = useState<any>(null);
  const [tpl, setTpl] = useState<ContratoTemplate | null>(null);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [aceito, setAceito] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data: c, error } = await supabase
        .from("contratos")
        .select("*")
        .eq("signing_token", token)
        .maybeSingle();
      if (error || !c) { setLoading(false); return; }
      setContrato(c);
      const snap = (c.conteudo_snapshot as any) || {};
      setNome(c.assinatura_nome || snap?.cliente?.nome || "");
      setCpf(c.assinatura_cpf || snap?.cliente?.cpf_cnpj || "");
      const { data: t } = await supabase
        .from("contratos_template")
        .select("*")
        .eq("id", c.template_id)
        .maybeSingle();
      setTpl(t as ContratoTemplate);
      setLoading(false);
    })();
  }, [token]);

  // Setup canvas drawing
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1A1A1A";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    const pos = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * cv.width) / r.width, y: ((e.clientY - r.top) * cv.height) / r.height };
    };
    const down = (e: PointerEvent) => { drawing.current = true; hasDrawn.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (e: PointerEvent) => { if (!drawing.current) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const up = () => { drawing.current = false; };
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { cv.removeEventListener("pointerdown", down); cv.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [contrato]);

  const limparAssinatura = () => {
    const cv = canvasRef.current; if (!cv) return;
    cv.getContext("2d")?.clearRect(0, 0, cv.width, cv.height);
    hasDrawn.current = false;
  };

  const assinar = async () => {
    if (!nome.trim()) return toast.error("Informe seu nome completo");
    if (!aceito) return toast.error("Aceite os termos do contrato");
    if (!hasDrawn.current) return toast.error("Faça sua assinatura no quadro");
    setSubmitting(true);
    const dataUrl = canvasRef.current?.toDataURL("image/png") || "";
    const { error } = await supabase
      .from("contratos")
      .update({
        status: "assinado",
        assinado_em: new Date().toISOString(),
        assinatura_nome: nome,
        assinatura_cpf: cpf,
        assinatura_data_url: dataUrl,
      })
      .eq("signing_token", token!);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Contrato assinado com sucesso!");
    const { data: refreshed } = await supabase.from("contratos").select("*").eq("signing_token", token!).maybeSingle();
    setContrato(refreshed);
  };

  const baixarPdf = () => {
    if (!contrato || !tpl) return;
    const ctx: ContratoCtx = contrato.conteudo_snapshot;
    const html = renderContratoHtml(tpl, ctx, contrato.assinado_em ? {
      assinado: { nome: contrato.assinatura_nome, cpf: contrato.assinatura_cpf, data: contrato.assinado_em },
    } : undefined);
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) return toast.error("Bloqueador de pop-up impediu a impressão");
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 350);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando contrato…</div>;
  if (!contrato) return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="bg-background rounded-xl p-10 text-center max-w-md">
        <div className="text-[18px] font-semibold mb-2">Contrato não encontrado</div>
        <p className="text-[13px] text-muted-foreground">O link de assinatura é inválido ou expirou.</p>
      </div>
    </div>
  );

  const assinado = contrato.status === "assinado";

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-[20px] font-semibold">Contrato {contrato.numero}</div>
              <div className="text-[12px] text-muted-foreground">{contrato.conteudo_snapshot?.empresa?.nome}</div>
            </div>
          </div>
          <Button variant="outline" onClick={baixarPdf}><FileText className="w-4 h-4 mr-1.5" />Visualizar/Imprimir</Button>
        </div>

        {assinado ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <div className="text-[20px] font-semibold text-emerald-900 mb-1">Contrato assinado!</div>
            <div className="text-[13px] text-emerald-800">
              Assinado por <b>{contrato.assinatura_nome}</b> em{" "}
              {new Date(contrato.assinado_em).toLocaleString("pt-BR")}.
            </div>
          </div>
        ) : (
          <>
            <div className="bg-background rounded-xl border p-6 space-y-4">
              <div className="text-[14px] font-semibold">Resumo do Contrato</div>
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div><span className="text-muted-foreground">Cliente:</span> <b>{contrato.conteudo_snapshot?.cliente?.nome}</b></div>
                <div><span className="text-muted-foreground">Valor:</span> <b>R$ {Number(contrato.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></div>
              </div>
              <Button variant="outline" onClick={baixarPdf} className="w-full">
                <FileText className="w-4 h-4 mr-1.5" /> Ler contrato completo
              </Button>
            </div>

            <div className="bg-background rounded-xl border p-6 space-y-4">
              <div className="text-[14px] font-semibold">Assine digitalmente</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome completo *</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>CPF/CNPJ</Label>
                  <Input value={cpf} onChange={(e) => setCpf(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Pen className="w-3.5 h-3.5" /> Assinatura</Label>
                <div className="border-2 border-dashed border-border rounded-lg bg-muted/20">
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={200}
                    className="w-full h-[200px] touch-none cursor-crosshair"
                  />
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={limparAssinatura}>
                    <Eraser className="w-3.5 h-3.5 mr-1.5" /> Limpar
                  </Button>
                </div>
              </div>

              <label className="flex items-start gap-2 text-[13px] cursor-pointer">
                <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} className="mt-1" />
                <span>Li e concordo com todas as cláusulas do contrato. Confirmo que minha assinatura digital tem o mesmo valor jurídico de uma assinatura manual.</span>
              </label>

              <Button onClick={assinar} disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> {submitting ? "Enviando…" : "Assinar Contrato"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
