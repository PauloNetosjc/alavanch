import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Store, User, CheckCircle2, Clock, FileText, Eye, PenLine } from "lucide-react";
import { toast } from "sonner";
import { getPublicSignatureUrl } from "@/lib/publicLinks";
import { EvidenciasDialog } from "@/components/assinaturas/EvidenciasDialog";

type Part = {
  id: string;
  tipo: "cliente" | "loja";
  token: string;
  status: string;
  nome: string | null;
  email: string | null;
  documento: string | null;
  assinado_em: string | null;
  visualizado_em: string | null;
  enviado_em: string | null;
  ip: string | null;
};

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export function VisualizarAssinaturasDialog({
  open, onOpenChange, solicitacaoId, onAssinarLoja,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  solicitacaoId: string | null;
  onAssinarLoja?: (solicId: string) => void;
}) {
  const [parts, setParts] = useState<Part[]>([]);
  const [solic, setSolic] = useState<any>(null);
  const [evidOpen, setEvidOpen] = useState(false);

  useEffect(() => {
    if (!open || !solicitacaoId) return;
    (async () => {
      await supabase.rpc("ensure_participants_for_solicitation" as any, { p_solic: solicitacaoId });
      const [{ data: pa }, { data: s }] = await Promise.all([
        supabase.from("assinatura_participantes" as any)
          .select("*").eq("solicitacao_id", solicitacaoId).order("tipo"),
        supabase.from("solicitacoes_assinatura")
          .select("*, tipos_documento(nome,requer_assinatura_loja)").eq("id", solicitacaoId).maybeSingle(),
      ]);
      setParts((pa as any) || []);
      setSolic(s);
    })();
  }, [open, solicitacaoId]);

  const requeridos = parts.filter((p) =>
    p.tipo === "cliente" || (p.tipo === "loja" && solic?.tipos_documento?.requer_assinatura_loja !== false),
  );
  const assinados = requeridos.filter((p) => !!p.assinado_em).length;
  const total = requeridos.length;

  const copiar = (token: string, label: string) => {
    navigator.clipboard.writeText(getPublicSignatureUrl(token));
    toast.success(`Link da ${label} copiado`);
  };
  const abrir = (token: string) => window.open(getPublicSignatureUrl(token), "_blank");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Assinaturas do documento
              <Badge variant="outline" className="text-[11px]">
                {assinados}/{total} assinaturas
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {parts.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum participante encontrado.</p>
            )}

            {parts.map((p) => {
              const isLoja = p.tipo === "loja";
              const assinado = !!p.assinado_em;
              const Icon = isLoja ? Store : User;
              return (
                <div key={p.id} className="rounded-lg border p-3 bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isLoja ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold flex items-center gap-2">
                          {isLoja ? "Loja (representante)" : "Cliente"}
                          {assinado ? (
                            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Assinado
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 text-[10px] gap-1">
                              <Clock className="w-3 h-3" /> Pendente
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {p.nome || "—"}{p.email ? ` · ${p.email}` : ""}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
                          <div>Visualizado: {fmt(p.visualizado_em)}</div>
                          <div>Assinado: {fmt(p.assinado_em)}{p.ip ? ` · IP ${p.ip}` : ""}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <Button size="sm" variant="outline" onClick={() => copiar(p.token, isLoja ? "loja" : "cliente")}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copiar link
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => abrir(p.token)}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir
                    </Button>
                    {isLoja && !assinado && onAssinarLoja && solicitacaoId && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => onAssinarLoja(solicitacaoId)}
                      >
                        <PenLine className="w-3.5 h-3.5 mr-1" /> Assinar pela loja
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <div className="text-[11px] text-muted-foreground">
                {solic?.file_name ? (
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {solic.file_name}</span>
                ) : "Solicitação de assinatura"}
              </div>
              <Button size="sm" variant="outline" onClick={() => setEvidOpen(true)}>
                <Eye className="w-3.5 h-3.5 mr-1" /> Ver evidências
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EvidenciasDialog
        open={evidOpen}
        onOpenChange={setEvidOpen}
        solicitacaoId={solicitacaoId}
      />
    </>
  );
}
