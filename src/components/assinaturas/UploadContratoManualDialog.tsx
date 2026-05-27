import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, IdCard, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "assinaturas-evidencias";
const MAX_BYTES = 25 * 1024 * 1024;

type Stage =
  | "validar"
  | "upload_contrato"
  | "upload_doc_cliente"
  | "rpc_registrar"
  | "finalizar";

function logErr(stage: Stage, extra: Record<string, unknown>, err: any) {
  // eslint-disable-next-line no-console
  console.error(`[manual] ${stage} FAIL`, {
    stage,
    ...extra,
    name: err?.name,
    message: err?.message,
    status: err?.status ?? err?.statusCode,
    statusCode: err?.statusCode,
    details: err?.details,
    hint: err?.hint,
    code: err?.code,
    error: err,
  });
}

function isFetchBlocked(err: any) {
  const msg = String(err?.message || "");
  return err?.name === "TypeError" && /failed to fetch|network|load failed/i.test(msg);
}

function mimeFromExt(name: string, fallback: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  return fallback || "application/octet-stream";
}

function sanitizeExt(name: string) {
  const ext = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || "bin";
}

export function UploadContratoManualDialog({
  open, onOpenChange, solicitacaoId, pedidoId, onDone,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  solicitacaoId: string | null;
  pedidoId?: string | null;
  onDone?: () => void;
}) {
  const [contrato, setContrato] = useState<File | null>(null);
  const [docCliente, setDocCliente] = useState<File | null>(null);
  const [observacao, setObservacao] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setContrato(null); setDocCliente(null); setObservacao(""); setConfirmado(false);
  };

  const uploadFile = async (file: File, kind: "contrato" | "doc") => {
    const ext = sanitizeExt(file.name);
    const path = `${solicitacaoId}/${kind}-${Date.now()}.${ext}`;
    const contentType = mimeFromExt(file.name, file.type);
    // eslint-disable-next-line no-console
    console.log(`[manual] upload ${kind}`, { bucket: BUCKET, path, size: file.size, contentType });
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType,
    });
    if (error) {
      (error as any).__bucket = BUCKET;
      (error as any).__path = path;
      throw error;
    }
    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return { url: publicUrl, path };
  };

  const submit = async () => {
    // ===== Validações =====
    try {
      // eslint-disable-next-line no-console
      console.log("[manual] iniciando", {
        solicitacaoId, pedidoId,
        contrato: contrato ? { name: contrato.name, size: contrato.size, type: contrato.type } : null,
        docCliente: docCliente ? { name: docCliente.name, size: docCliente.size, type: docCliente.type } : null,
      });
      if (!solicitacaoId) throw new Error("Solicitação não identificada.");
      if (!contrato) throw new Error("Anexe o contrato assinado.");
      if (!confirmado) throw new Error("Confirme que o contrato foi assinado manualmente.");
      if (contrato.size > MAX_BYTES) throw new Error("Contrato acima de 25 MB. Compacte o arquivo e tente novamente.");
      if (docCliente && docCliente.size > MAX_BYTES) throw new Error("Documento do cliente acima de 25 MB.");
    } catch (e: any) {
      logErr("validar", {}, e);
      toast.error(e.message || "Dados inválidos para registrar assinatura manual.");
      return;
    }

    setBusy(true);
    let ct: { url: string; path: string } | null = null;
    let dc: { url: string; path: string } | null = null;

    // ===== Upload contrato =====
    try {
      ct = await uploadFile(contrato!, "contrato");
    } catch (e: any) {
      logErr("upload_contrato", { bucket: BUCKET, path: e?.__path }, e);
      toast.error(
        isFetchBlocked(e)
          ? "Navegador bloqueou a requisição ou conexão falhou. Desative extensões/adblock e tente de novo."
          : "Falha ao enviar contrato assinado."
      );
      setBusy(false);
      return;
    }

    // ===== Upload doc cliente (opcional) =====
    if (docCliente) {
      try {
        dc = await uploadFile(docCliente, "doc");
      } catch (e: any) {
        logErr("upload_doc_cliente", { bucket: BUCKET, path: e?.__path }, e);
        toast.error(
          isFetchBlocked(e)
            ? "Navegador bloqueou o envio do documento do cliente."
            : "Falha ao enviar documento do cliente."
        );
        setBusy(false);
        return;
      }
    }

    // ===== RPC =====
    try {
      // eslint-disable-next-line no-console
      console.log("[manual] rpc registrar_assinatura_manual", {
        solicitacaoId, hasDoc: !!dc, hasObservacao: !!observacao,
      });
      const { error } = await supabase.rpc("registrar_assinatura_manual" as any, {
        p_solic: solicitacaoId,
        p_contrato_url: ct!.url,
        p_contrato_path: ct!.path,
        p_doc_cliente_url: dc?.url || null,
        p_doc_cliente_path: dc?.path || null,
        p_observacao: observacao || null,
      });
      if (error) throw error;
    } catch (e: any) {
      logErr("rpc_registrar", { solicitacaoId }, e);
      const code = String(e?.code || "");
      const msg = String(e?.message || "");
      let friendly = "Falha ao atualizar status da assinatura.";
      if (isFetchBlocked(e)) {
        friendly = "Navegador bloqueou a requisição ou conexão falhou.";
      } else if (code === "42501" || /permission|rls|policy/i.test(msg)) {
        friendly = "Falha de permissão ao salvar a assinatura manual.";
      } else if (/null value in column|violates not-null/i.test(msg)) {
        friendly = "Erro de integridade ao registrar assinatura manual. Avise o suporte.";
      } else if (msg) {
        friendly = `Falha ao atualizar status da assinatura: ${msg}`;
      }
      toast.error(friendly);
      setBusy(false);
      return;
    }

    // ===== Finalizar =====
    try {
      // eslint-disable-next-line no-console
      console.log("[manual] finalizar OK");
      toast.success("Assinatura manual registrada");
      reset();
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      logErr("finalizar", {}, e);
      toast.error("Assinatura registrada, mas houve erro ao atualizar a tela. Recarregue a página.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" /> Registrar assinatura manual
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-900">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              Use quando o contrato foi assinado <b>fisicamente</b>. O documento e o doc de identificação do cliente
              ficam arquivados como evidências e a solicitação muda para <b>Assinado manualmente</b>, liberando o workflow operacional.
            </div>
          </div>

          <div>
            <Label className="text-[11px] uppercase flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> Contrato assinado (PDF ou imagem) *
            </Label>
            <Input
              type="file"
              accept=".pdf,image/*"
              className="mt-1"
              onChange={(e) => setContrato(e.target.files?.[0] || null)}
            />
            {contrato && <div className="text-[11px] text-muted-foreground mt-1">{contrato.name} · {(contrato.size / 1024 / 1024).toFixed(2)} MB</div>}
          </div>

          <div>
            <Label className="text-[11px] uppercase flex items-center gap-1">
              <IdCard className="w-3.5 h-3.5" /> Documento do cliente (opcional)
            </Label>
            <Input
              type="file"
              accept=".pdf,image/*"
              className="mt-1"
              onChange={(e) => setDocCliente(e.target.files?.[0] || null)}
            />
            {docCliente && <div className="text-[11px] text-muted-foreground mt-1">{docCliente.name} · {(docCliente.size / 1024 / 1024).toFixed(2)} MB</div>}
          </div>

          <div>
            <Label className="text-[11px] uppercase">Observação</Label>
            <Textarea
              rows={3}
              placeholder="Ex.: contrato assinado em reunião presencial em 27/05."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="mt-1 text-[13px]"
            />
          </div>

          <label className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border cursor-pointer">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-[12px] leading-snug">
              Confirmo que este contrato foi assinado manualmente pelo cliente e pela loja e que esta assinatura
              <b> substituirá o fluxo de assinatura digital pendente</b>, encerrando os links de assinatura online.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !contrato || !confirmado} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Salvando...</> : <><Upload className="w-4 h-4 mr-1" /> Registrar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
