import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Eye, RefreshCcw, Send, FileText, ShieldCheck, Loader2, Store, User } from "lucide-react";
import { toast } from "sonner";
import { EvidenciasDialog } from "@/components/assinaturas/EvidenciasDialog";
import { getPublicSignatureUrl } from "@/lib/publicLinks";
import { baixarPdfFinalAssinatura } from "@/lib/assinaturaPdfDownload";

type Participante = {
  id: string;
  solicitacao_id: string;
  tipo: "cliente" | "loja";
  token: string;
  status: string;
  nome: string | null;
  email: string | null;
  assinado_em: string | null;
  visualizado_em: string | null;
  enviado_em: string | null;
};

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
  contrato_id: string | null;
  pedido_documento_id: string | null;
  tipos_documento?: { nome: string; slug: string; requer_assinatura_loja: boolean } | null;
  participantes?: Participante[];
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

const PART_STATUS: Record<string, { label: string; tone: string }> = {
  pendente: { label: "Pendente", tone: "bg-amber-100 text-amber-800" },
  visualizado: { label: "Visualizado", tone: "bg-blue-100 text-blue-800" },
  enviado: { label: "Enviado", tone: "bg-blue-100 text-blue-800" },
  assinado: { label: "Assinado", tone: "bg-emerald-100 text-emerald-800" },
  recusado: { label: "Recusado", tone: "bg-red-100 text-red-800" },
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
    const solics = (data as any[]) || [];
    if (solics.length) {
      const ids = solics.map((s) => s.id);
      const { data: parts } = await supabase
        .from("assinatura_participantes" as any)
        .select("*")
        .in("solicitacao_id", ids);
      const partsBySolic = new Map<string, Participante[]>();
      for (const p of (parts as any[] | null) || []) {
        const arr = partsBySolic.get(p.solicitacao_id) || [];
        arr.push(p);
        partsBySolic.set(p.solicitacao_id, arr);
      }
      for (const s of solics) s.participantes = partsBySolic.get(s.id) || [];
    }
    setItems(solics as Solic[]);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [pedidoId]);

  const garantirParticipante = async (solicId: string, tipo: "loja" | "cliente"): Promise<Participante | null> => {
    const { data, error } = await supabase.rpc("garantir_participante" as any, { p_solic: solicId, p_tipo: tipo });
    if (error) { toast.error(error.message); return null; }
    return data as any;
  };

  const copiarLinkParticipante = async (solic: Solic, tipo: "loja" | "cliente") => {
    let part = solic.participantes?.find((p) => p.tipo === tipo);
    if (!part) {
      part = (await garantirParticipante(solic.id, tipo)) || undefined;
      if (!part) return;
      await carregar();
    }
    if (part.status === "assinado") {
      toast.error("Este participante já assinou.");
      return;
    }
    const url = getPublicSignatureUrl(part.token);
    await navigator.clipboard.writeText(url);
    toast.success(`Link da ${tipo === "loja" ? "loja" : "cliente"} copiado`);
  };

  const abrirLinkParticipante = async (solic: Solic, tipo: "loja" | "cliente") => {
    let part = solic.participantes?.find((p) => p.tipo === tipo);
    if (!part) {
      part = (await garantirParticipante(solic.id, tipo)) || undefined;
      if (!part) return;
      await carregar();
    }
    window.open(getPublicSignatureUrl(part.token), "_blank");
  };

  const renovarToken = async (s: Solic) => {
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
    const completo = s.status === "concluido" && !!s.cliente_assinado_em && (!s.tipos_documento?.requer_assinatura_loja || !!s.loja_assinado_em);
    if (!completo) return toast.error("O PDF assinado só pode ser baixado após cliente e loja assinarem.");
    await baixarPdfFinalAssinatura(s.id, s.file_name || "documento-assinado");
  };

  const renderParticipanteBloco = (
    s: Solic,
    tipo: "loja" | "cliente",
    requerLojaPrimeiro: boolean,
  ) => {
    const p = s.participantes?.find((x) => x.tipo === tipo);
    const stLabel = PART_STATUS[p?.status || "pendente"] || PART_STATUS.pendente;
    const lojaAssinou = !!s.participantes?.find((x) => x.tipo === "loja" && x.status === "assinado");
    const bloqueadoPorLoja = tipo === "cliente" && requerLojaPrimeiro && !lojaAssinou && (!p || p.status !== "assinado");
    const Icon = tipo === "loja" ? Store : User;

    return (
      <div className="flex-1 min-w-[260px] border rounded-lg p-3 bg-background/60">
        <div className="flex items-start gap-2 mb-2">
          <Icon className="w-4 h-4 mt-0.5 text-muted-foreground" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[13px]">{tipo === "loja" ? "Assinatura da loja" : "Assinatura do cliente"}</span>
              <Badge className={`${stLabel.tone} text-[10px] px-1.5 py-0`}>{stLabel.label}</Badge>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {p?.nome || (tipo === "loja" ? "—" : "—")}
              {p?.email ? <> · {p.email}</> : null}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
              {p?.visualizado_em && <span>Visualizado: {new Date(p.visualizado_em).toLocaleString("pt-BR")}</span>}
              {p?.assinado_em && <span>Assinado: {new Date(p.assinado_em).toLocaleString("pt-BR")}</span>}
              {!p?.assinado_em && bloqueadoPorLoja && <span className="text-amber-700">Aguardando loja assinar primeiro</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            size="sm" variant="outline"
            disabled={bloqueadoPorLoja || p?.status === "assinado"}
            onClick={() => copiarLinkParticipante(s, tipo)}
            title={bloqueadoPorLoja ? "A loja precisa assinar antes de enviar ao cliente" : "Copiar link"}
          >
            <Copy className="w-3.5 h-3.5 mr-1" /> Copiar link
          </Button>
          <Button
            size="sm" variant="outline"
            disabled={bloqueadoPorLoja || p?.status === "assinado"}
            onClick={() => abrirLinkParticipante(s, tipo)}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir
          </Button>
        </div>
      </div>
    );
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
        <div className="space-y-3">
          {items.map((s) => {
            const st = STATUS_LABEL[s.status] || { label: s.status, tone: "bg-muted" };
            const expirado = new Date(s.expira_em) < new Date();
            const requerLoja = !!s.tipos_documento?.requer_assinatura_loja;
            const completo = s.status === "concluido" && !!s.cliente_assinado_em && (!requerLoja || !!s.loja_assinado_em);
            return (
              <div key={s.id} className="border rounded-lg p-3 bg-muted/20">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-[13px]">{s.file_name || s.tipos_documento?.nome || "Documento"}</span>
                  <Badge className={`${st.tone} text-[10px] px-1.5 py-0`}>{st.label}</Badge>
                  {requerLoja && <Badge variant="outline" className="text-[10px] px-1.5 py-0">requer loja</Badge>}
                  {expirado && s.status !== "concluido" && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">expirado</Badge>
                  )}
                  <div className="ml-auto flex items-center gap-1 flex-wrap">
                    {expirado && (
                      <Button size="sm" variant="outline" onClick={() => renovarToken(s)}>
                        <Send className="w-3.5 h-3.5 mr-1" /> Renovar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setEvid(s.id)}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Evidências
                    </Button>
                    {completo && (
                      <Button size="sm" variant="outline" onClick={() => baixarAssinado(s)}>
                        <FileText className="w-3.5 h-3.5 mr-1" /> Baixar PDF
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {requerLoja && renderParticipanteBloco(s, "loja", requerLoja)}
                  {renderParticipanteBloco(s, "cliente", requerLoja)}
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
