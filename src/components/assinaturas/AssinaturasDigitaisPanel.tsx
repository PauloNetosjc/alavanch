import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Eye, RefreshCcw, Send, FileText, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EvidenciasDialog } from "@/components/assinaturas/EvidenciasDialog";
import { getPublicSignatureUrl } from "@/lib/publicLinks";
import { baixarPdfFinalAssinatura } from "@/lib/assinaturaPdfDownload";

type Solic = {
  id: string;
  token: string;
  status: string;
  expira_em: string;
  cliente_assinado_em: string | null;
  loja_assinado_em: string | null;
  concluido_em: string | null;
  file_name: string | null;
  file_url: string | null;
  storage_path: string | null;
  contrato_id: string | null;
  pedido_documento_id: string | null;
  doc_foto_url: string | null;
  selfie_url: string | null;
  assinatura_cliente_url: string | null;
  tipos_documento?: { nome: string; slug: string; requer_assinatura_loja: boolean } | null;
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  rascunho: { label: "Rascunho", tone: "bg-muted text-muted-foreground" },
  aguardando_cliente: { label: "Aguardando cliente", tone: "bg-amber-100 text-amber-800" },
  assinado_cliente: { label: "Cliente assinou", tone: "bg-blue-100 text-blue-800" },
  aguardando_loja: { label: "Aguardando loja", tone: "bg-indigo-100 text-indigo-800" },
  assinado_loja: { label: "Loja assinou", tone: "bg-blue-100 text-blue-800" },
  concluido: { label: "Concluído", tone: "bg-emerald-100 text-emerald-800" },
  recusado: { label: "Recusado", tone: "bg-red-100 text-red-800" },
  cancelado: { label: "Cancelado", tone: "bg-muted text-muted-foreground" },
  expirado: { label: "Expirado", tone: "bg-muted text-muted-foreground" },
};

export function AssinaturasDigitaisPanel({ pedidoId }: { pedidoId: string }) {
  const [items, setItems] = useState<Solic[]>([]);
  const [loading, setLoading] = useState(true);
  const [evid, setEvid] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("solicitacoes_assinatura")
      .select("*, tipos_documento(nome,slug,requer_assinatura_loja)")
      .eq("pedido_id", pedidoId)
      .order("created_at", { ascending: false });
    setItems((data as any[] as Solic[]) || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [pedidoId]);

  const linkPublico = (s: Solic) => getPublicSignatureUrl(s.token);

  const copiar = (s: Solic) => {
    navigator.clipboard.writeText(linkPublico(s));
    toast.success("Link público copiado");
  };

  const renovarToken = async (s: Solic) => {
    // Apenas estende validade — token público continua válido
    const novaValidade = new Date(Date.now() + 30 * 86400000).toISOString();
    const { error } = await supabase
      .from("solicitacoes_assinatura")
      .update({ expira_em: novaValidade })
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Validade estendida por 30 dias");
    carregar();
  };

  const baixarAssinado = async (s: Solic) => {
    await baixarPdfFinalAssinatura(s.id, s.file_name || "documento-assinado");
  };

  return (
    <section className="surface-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-playfair text-[22px] font-semibold">Assinaturas Digitais</h2>
          <p className="text-[12px] text-muted-foreground">Solicitações de assinatura vinculadas a este pedido</p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar}>
          <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-[12px]">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando…
        </div>
      ) : items.length === 0 ? (
        <div className="text-[12px] text-muted-foreground text-center py-8">
          Nenhuma solicitação de assinatura criada para este pedido.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((s) => {
            const st = STATUS_LABEL[s.status] || { label: s.status, tone: "bg-muted" };
            const expirado = new Date(s.expira_em) < new Date();
            return (
              <div key={s.id} className="border rounded-lg p-3 bg-muted/20 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[13px] truncate">{s.file_name || s.tipos_documento?.nome || "Documento"}</span>
                      <Badge className={`${st.tone} text-[10px] px-1.5 py-0 font-medium`}>{st.label}</Badge>
                      {s.tipos_documento?.requer_assinatura_loja && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">requer loja</Badge>
                      )}
                      {expirado && s.status === "aguardando_cliente" && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">expirado</Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                      <span>Tipo: {s.tipos_documento?.nome || "—"}</span>
                      <span>Cliente: {s.cliente_assinado_em ? new Date(s.cliente_assinado_em).toLocaleString("pt-BR") : "pendente"}</span>
                      <span>Loja: {s.loja_assinado_em ? new Date(s.loja_assinado_em).toLocaleString("pt-BR") : (s.tipos_documento?.requer_assinatura_loja ? "pendente" : "n/a")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <Button size="sm" variant="outline" onClick={() => copiar(s)} title="Copiar link público">
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copiar link
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(linkPublico(s), "_blank")}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir
                    </Button>
                    {expirado && (
                      <Button size="sm" variant="outline" onClick={() => renovarToken(s)}>
                        <Send className="w-3.5 h-3.5 mr-1" /> Renovar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setEvid(s.id)}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Evidências
                    </Button>
                    {(s.status === "concluido" || s.status === "assinado_loja") && (
                      <Button size="sm" variant="outline" onClick={() => baixarAssinado(s)}>
                        <FileText className="w-3.5 h-3.5 mr-1" /> Baixar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {evid && (
        <EvidenciasDialog
          open={!!evid}
          onOpenChange={(v) => !v && setEvid(null)}
          solicitacaoId={evid}
        />
      )}
    </section>
  );
}
