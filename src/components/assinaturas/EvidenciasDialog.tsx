import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function EvidenciasDialog({
  open, onOpenChange, solicitacaoId,
}: { open: boolean; onOpenChange: (b: boolean) => void; solicitacaoId: string | null }) {
  const [evid, setEvid] = useState<any[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !solicitacaoId) return;
    (async () => {
      const [{ data: e }, { data: ev }, { data: pa }] = await Promise.all([
        supabase.from("assinatura_evidencias").select("*").eq("solicitacao_id", solicitacaoId).order("created_at"),
        supabase.from("assinatura_eventos").select("*").eq("solicitacao_id", solicitacaoId).order("created_at"),
        supabase.from("assinatura_participantes").select("*").eq("solicitacao_id", solicitacaoId),
      ]);
      setEvid(e || []);
      setEventos(ev || []);
      setParts(pa || []);
    })();
  }, [open, solicitacaoId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Evidências da assinatura</DialogTitle></DialogHeader>
        <Tabs defaultValue="evid">
          <TabsList>
            <TabsTrigger value="evid">Evidências</TabsTrigger>
            <TabsTrigger value="part">Participantes</TabsTrigger>
            <TabsTrigger value="hist">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="evid" className="space-y-3">
            {evid.length === 0 && <p className="text-sm text-muted-foreground">Sem evidências ainda.</p>}
            {evid.map((e) => (
              <div key={e.id} className="border rounded p-3 space-y-2 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  {e.documento_foto_url && <img src={e.documento_foto_url} alt="Doc" className="rounded border" />}
                  {e.selfie_url && <img src={e.selfie_url} alt="Selfie" className="rounded border" />}
                  {e.assinatura_url && <img src={e.assinatura_url} alt="Assinatura" className="rounded border bg-white" />}
                </div>
                <div className="text-muted-foreground">
                  <div>Assinado em: {new Date(e.assinado_em).toLocaleString("pt-BR")}</div>
                  <div>IP: {e.ip || "—"}</div>
                  <div>Navegador: {e.user_agent}</div>
                  <div>Aceite: {e.aceite ? "Sim" : "Não"}</div>
                </div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="part" className="space-y-2">
            {parts.map((p) => (
              <div key={p.id} className="border rounded p-2 text-xs">
                <div className="font-medium">{p.tipo === "cliente" ? "Cliente" : "Loja"}: {p.nome}</div>
                <div className="text-muted-foreground">
                  {p.email && <>E-mail: {p.email} · </>}
                  {p.telefone && <>Tel: {p.telefone} · </>}
                  Status: {p.status}
                  {p.assinado_em && <> · Assinado: {new Date(p.assinado_em).toLocaleString("pt-BR")}</>}
                </div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="hist" className="space-y-1">
            {eventos.map((ev) => (
              <div key={ev.id} className="text-xs border-l-2 border-primary/40 pl-2 py-1">
                <div className="text-muted-foreground">{new Date(ev.created_at).toLocaleString("pt-BR")}</div>
                <div>{ev.descricao || ev.tipo_evento}</div>
                {ev.status_anterior && ev.status_novo && (
                  <div className="text-muted-foreground">{ev.status_anterior} → {ev.status_novo}</div>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
