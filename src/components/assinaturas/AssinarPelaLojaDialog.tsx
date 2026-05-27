import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SignaturePad, type SignaturePadHandle } from "@/components/assinaturas/SignaturePad";
import { arquivarDocumentoAssinado } from "@/lib/arquivarDocAssinado";
import { prepararContratoParaAssinatura } from "@/lib/contratoAssinaturaDoc";

export function AssinarPelaLojaDialog({
  open, onOpenChange, solicitacaoId, onDone,
}: {
  open: boolean; onOpenChange: (b: boolean) => void;
  solicitacaoId: string | null; onDone?: () => void;
}) {
  const { user, profile, role } = useAuth();
  const nomeLogado = (profile as any)?.nome_completo || user?.email || "";
  const emailLogado = user?.email || "";
  const obsPadrao = nomeLogado && emailLogado && nomeLogado !== emailLogado
    ? `${nomeLogado} — ${emailLogado}`
    : (nomeLogado || emailLogado);
  const [obs, setObs] = useState(obsPadrao);
  const [busy, setBusy] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);
  const [solic, setSolic] = useState<any>(null);

  useEffect(() => {
    if (!open || !solicitacaoId) return;
    setObs(obsPadrao);
    supabase.from("solicitacoes_assinatura").select("*, contratos(id,conteudo_snapshot)").eq("id", solicitacaoId).maybeSingle()
      .then(({ data }) => setSolic(data));
  }, [open, solicitacaoId, obsPadrao]);

  async function assinar() {
    if (!solic) return;
    if (padRef.current?.isEmpty()) return toast.error("Desenhe sua assinatura.");
    setBusy(true);
    try {
      const ua = navigator.userAgent;
      const agora = new Date().toISOString();

      // Upload da assinatura da loja para o storage (para embed no contrato)
      let assinaturaLojaUrl: string | null = null;
      try {
        const sigBlob = await (await fetch(padRef.current!.toDataURL())).blob();
        const sigPath = `${solic.id}/assinatura-loja-${Date.now()}.png`;
        const up = await supabase.storage
          .from("assinaturas-evidencias")
          .upload(sigPath, sigBlob, { upsert: true, contentType: "image/png" });
        if (!up.error) {
          assinaturaLojaUrl = supabase.storage.from("assinaturas-evidencias").getPublicUrl(sigPath).data.publicUrl;
        } else {
          assinaturaLojaUrl = padRef.current!.toDataURL();
        }
      } catch {
        assinaturaLojaUrl = padRef.current!.toDataURL();
      }

      const { data: part } = await supabase.from("assinatura_participantes").insert({
        solicitacao_id: solic.id, tipo: "loja",
        nome: (profile as any)?.nome_completo || user?.email,
        user_id: user?.id, cargo: role,
        status: "assinado", assinado_em: agora, user_agent: ua,
      }).select().single();

      await supabase.from("assinatura_evidencias").insert({
        solicitacao_id: solic.id, participante_id: part?.id,
        assinatura_url: assinaturaLojaUrl,
        aceite: true, aceite_texto: obs || "Assinado pela loja",
        user_agent: ua,
      });

      // Conclui SOMENTE se cliente também já tiver assinado
      const clienteJaAssinou = !!solic.cliente_assinado_em;
      const novoStatus = clienteJaAssinou ? "concluido" : "assinado_loja";
      const upd: any = {
        status: novoStatus,
        loja_assinado_em: agora,
        assinatura_loja_url: assinaturaLojaUrl,
      };
      if (clienteJaAssinou) upd.concluido_em = agora;

      await supabase.from("solicitacoes_assinatura").update(upd).eq("id", solic.id);

      await supabase.from("assinatura_eventos").insert({
        solicitacao_id: solic.id, tipo_evento: "loja_assinou",
        status_anterior: solic.status, status_novo: novoStatus,
        descricao: `Loja assinou (${(profile as any)?.nome_completo || user?.email})`,
        user_id: user?.id,
      });

      // Persiste assinante no snapshot do contrato e regenera o HTML do contrato
      // para que o nome + e-mail do responsável pela loja apareçam na assinatura visível.
      try {
        if ((solic as any)?.contratos?.id) {
          const snap = (((solic as any).contratos.conteudo_snapshot as any) || {});
          await supabase.from("contratos").update({
            conteudo_snapshot: {
              ...snap,
              loja_assinatura_nome: nomeLogado,
              loja_assinatura_email: emailLogado,
            } as any,
          }).eq("id", (solic as any).contratos.id);
        }
        await prepararContratoParaAssinatura(solic.id, { nome: nomeLogado, email: emailLogado });
      } catch (e) {
        console.error("[regenerar contrato pós assinatura loja]", e);
      }

      if (clienteJaAssinou) {
        await arquivarDocumentoAssinado(solic.id);
        toast.success("Documento concluído!");
      } else {
        toast.success("Loja assinou. Aguardando assinatura do cliente.");
      }
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
