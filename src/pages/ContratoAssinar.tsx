import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, FileText, Pen, Eraser, Camera, IdCard } from "lucide-react";
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
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Inicializa/redimensiona o canvas preservando o desenho
  const setupCanvas = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cv.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (cv.width !== w || cv.height !== h) {
      // Preserva conteúdo
      const prev = cv.width && cv.height ? cv.toDataURL() : null;
      cv.width = w; cv.height = h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = "#1A1A1A";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (prev) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = prev;
      }
    }
  };

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
      if (c.template_id) {
        const { data: t } = await supabase
          .from("contratos_template")
          .select("*")
          .eq("id", c.template_id)
          .maybeSingle();
        setTpl(t as ContratoTemplate);
      }
      setLoading(false);
    })();
  }, [token]);

  // Setup canvas + redimensionamento
  useEffect(() => {
    if (!contrato || contrato.status === "assinado") return;
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [contrato]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    drawing.current = true; hasDrawn.current = true;
    const p = getPos(e);
    lastPos.current = p;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01); // garante um ponto visível em toques rápidos
    ctx.stroke();
    try { cv.setPointerCapture(e.pointerId); } catch {}
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPos.current = p;
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch {}
  };

  const limparAssinatura = () => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.restore();
    hasDrawn.current = false;
  };

  const onSelfie = (f: File | null) => {
    setSelfieFile(f);
    setSelfiePreview(f ? URL.createObjectURL(f) : null);
  };
  const onDoc = (f: File | null) => {
    setDocFile(f);
    setDocPreview(f ? URL.createObjectURL(f) : null);
  };

  const uploadAnexo = async (file: File, suffix: string): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${contrato.id}/${suffix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("contratos-assinatura").upload(path, file, { upsert: true });
    if (error) { toast.error("Falha ao enviar " + suffix + ": " + error.message); return null; }
    const { data } = supabase.storage.from("contratos-assinatura").getPublicUrl(path);
    return data.publicUrl;
  };

  const assinar = async () => {
    if (!nome.trim()) return toast.error("Informe seu nome completo");
    if (!aceito) return toast.error("Aceite os termos do contrato");
    if (!hasDrawn.current) return toast.error("Faça sua assinatura no quadro");
    if (!selfieFile) return toast.error("Anexe a selfie segurando o documento");
    if (!docFile) return toast.error("Anexe a foto do documento (RG/CNH)");
    setSubmitting(true);
    try {
      const dataUrl = canvasRef.current?.toDataURL("image/png") || "";
      const selfieUrl = await uploadAnexo(selfieFile, "selfie");
      const documentoUrl = await uploadAnexo(docFile, "documento");
      if (!selfieUrl || !documentoUrl) { setSubmitting(false); return; }

      const { error } = await supabase
        .from("contratos")
        .update({
          status: "assinado",
          assinado_em: new Date().toISOString(),
          assinatura_nome: nome,
          assinatura_cpf: cpf,
          assinatura_data_url: dataUrl,
          metodo_assinatura: "digital",
          selfie_url: selfieUrl,
          documento_url: documentoUrl,
        })
        .eq("signing_token", token!);
      if (error) throw error;
      toast.success("Contrato assinado com sucesso!");
      const { data: refreshed } = await supabase.from("contratos").select("*").eq("signing_token", token!).maybeSingle();
      setContrato(refreshed);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao assinar");
    } finally {
      setSubmitting(false);
    }
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
          {tpl && <Button variant="outline" onClick={baixarPdf}><FileText className="w-4 h-4 mr-1.5" />Visualizar/Imprimir</Button>}
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
              {tpl && (
                <Button variant="outline" onClick={baixarPdf} className="w-full">
                  <FileText className="w-4 h-4 mr-1.5" /> Ler contrato completo
                </Button>
              )}
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
                <Label className="flex items-center gap-1.5"><Pen className="w-3.5 h-3.5" /> Assinatura *</Label>
                <div className="border-2 border-dashed border-border rounded-lg bg-muted/20">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-[200px] touch-none cursor-crosshair block"
                  />
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={limparAssinatura}>
                    <Eraser className="w-3.5 h-3.5 mr-1.5" /> Limpar
                  </Button>
                </div>
              </div>

              {/* Selfie + documento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" /> Selfie segurando o documento *</Label>
                  <Input type="file" accept="image/*" capture="user" onChange={(e) => onSelfie(e.target.files?.[0] || null)} />
                  {selfiePreview && <img src={selfiePreview} alt="selfie" className="rounded-lg border max-h-40 object-cover" />}
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5" /> Foto do documento (RG/CNH) *</Label>
                  <Input type="file" accept="image/*" capture="environment" onChange={(e) => onDoc(e.target.files?.[0] || null)} />
                  {docPreview && <img src={docPreview} alt="documento" className="rounded-lg border max-h-40 object-cover" />}
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
