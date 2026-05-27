import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SignaturePad, type SignaturePadHandle } from "@/components/assinaturas/SignaturePad";
import { arquivarDocumentoAssinado } from "@/lib/arquivarDocAssinado";

export function AssinarPelaLojaDialog({
  open, onOpenChange, solicitacaoId, onDone,
}: {
  open: boolean; onOpenChange: (b: boolean) => void;
  solicitacaoId: string | null; onDone?: () => void;
}) {
  const { user, profile, role } = useAuth();
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);
  const [solic, setSolic] = useState<any>(null);

  useEffect(() => {
    if (!open || !solicitacaoId) return;
    setObs("");
    supabase.from("solicitacoes_assinatura").select("*").eq("id", solicitacaoId).maybeSingle()
      .then(({ data }) => setSolic(data));
  }, [open, solicitacaoId]);

  async function assinar() {
    if (!solic) return;
    if (padRef.current?.isEmpty()) return toast.error("Desenhe sua assinatura.");
    setBusy(true);
    try {
      const ua = navigator.userAgent;
      const { data: part } = await supabase.from("assinatura_participantes").insert({
        solicitacao_id: solic.id, tipo: "loja",
        nome: (profile as any)?.nome_completo || user?.email,
        user_id: user?.id, cargo: role,
        status: "assinado", assinado_em: new Date().toISOString(), user_agent: ua,
      }).select().single();

      await supabase.from("assinatura_evidencias").insert({
        solicitacao_id: solic.id, participante_id: part?.id,
        assinatura_url: padRef.current!.toDataURL(),
        aceite: true, aceite_texto: obs || "Assinado pela loja",
        user_agent: ua,
      });
      await supabase.from("solicitacoes_assinatura").update({
        status: "concluido", loja_assinado_em: new Date().toISOString(), concluido_em: new Date().toISOString(),
      }).eq("id", solic.id);
      await supabase.from("assinatura_eventos").insert({
        solicitacao_id: solic.id, tipo_evento: "loja_assinou",
        status_anterior: solic.status, status_novo: "concluido",
        descricao: `Loja assinou (${(profile as any)?.nome_completo || user?.email})`,
        user_id: user?.id,
      });
      await arquivarDocumentoAssinado(solic.id);
      toast.success("Documento concluído!");
      onOpenChange(false); onDone?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assinar pela loja</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Você assinará como representante da loja. Esta ação é registrada e imutável.</p>
          <SignaturePad ref={padRef} />
          <Textarea placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
        </div>
        <DialogFooter>
          <Button onClick={assinar} disabled={busy}>Confirmar assinatura</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
