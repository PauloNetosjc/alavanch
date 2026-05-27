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

  const upload = async (file: File, kind: "contrato" | "doc") => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${pedidoId || "manual"}/${solicitacaoId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });
    if (error) throw error;
    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return { url: publicUrl, path };
  };

  const submit = async () => {
    if (!solicitacaoId) return;
    if (!contrato) return toast.error("Anexe o contrato assinado.");
    if (!confirmado) return toast.error("Confirme que o contrato foi assinado manualmente.");
    setBusy(true);
    try {
      const ct = await upload(contrato, "contrato");
      const dc = docCliente ? await upload(docCliente, "doc") : null;

      const { error } = await supabase.rpc("registrar_assinatura_manual" as any, {
        p_solic: solicitacaoId,
        p_contrato_url: ct.url,
        p_contrato_path: ct.path,
        p_doc_cliente_url: dc?.url || null,
        p_doc_cliente_path: dc?.path || null,
        p_observacao: observacao || null,
      });
      if (error) throw error;

      toast.success("Assinatura manual registrada");
      reset();
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e.message || "Falha ao registrar assinatura manual");
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
            {contrato && <div className="text-[11px] text-muted-foreground mt-1">{contrato.name}</div>}
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
            {docCliente && <div className="text-[11px] text-muted-foreground mt-1">{docCliente.name}</div>}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !contrato} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Salvando...</> : <><Upload className="w-4 h-4 mr-1" /> Registrar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
