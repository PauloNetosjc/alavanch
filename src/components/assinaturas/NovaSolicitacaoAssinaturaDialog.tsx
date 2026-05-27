import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Loader2, MessageCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { getPublicSignatureUrl } from "@/lib/publicLinks";
import { buildLojaSignatureBlob, buildLojaSignatureDataUrl } from "@/lib/lojaSignature";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  pedidoId: string;
  defaults?: {
    pedido_documento_id?: string;
    contrato_id?: string;
    file_url?: string;
    file_name?: string;
    storage_path?: string;
    tipo_slug?: string;
  };
  onCreated?: (id: string, link: string) => void;
};

export function NovaSolicitacaoAssinaturaDialog({ open, onOpenChange, pedidoId, defaults, onCreated }: Props) {
  const { user, profile, role } = useAuth();
  const [tipos, setTipos] = useState<any[]>([]);
  const [tipoId, setTipoId] = useState<string>("");
  const [pedido, setPedido] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [validade, setValidade] = useState(30);
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLink(null);
    (async () => {
      const { data: t } = await supabase.from("tipos_documento").select("*").eq("ativo", true).order("nome");
      setTipos(t || []);
      if (defaults?.tipo_slug) {
        const m = (t || []).find((x: any) => x.slug === defaults.tipo_slug);
        if (m) setTipoId(m.id);
      }
      const { data: p } = await supabase
        .from("pedidos")
        .select("id,codigo,cliente_id,loja_id")
        .eq("id", pedidoId)
        .maybeSingle();
      setPedido(p);
      if (p?.cliente_id) {
        const { data: c } = await supabase
          .from("clientes")
          .select("nome,email,telefone")
          .eq("id", p.cliente_id)
          .maybeSingle();
        setCliente(c);
        setEmail(c?.email || "");
        setTelefone(c?.telefone || "");
      }
    })();
  }, [open, pedidoId, defaults?.tipo_slug]);

  async function criar() {
    if (!tipoId) return toast.error("Escolha o tipo de documento");
    if (!pedido) return;
    setBusy(true);
    try {
      const expira = new Date();
      expira.setDate(expira.getDate() + validade);
      const { data, error } = await supabase
        .from("solicitacoes_assinatura")
        .insert({
          pedido_id: pedido.id,
          tipo_documento_id: tipoId,
          cliente_id: pedido.cliente_id,
          loja_id: pedido.loja_id,
          pedido_documento_id: defaults?.pedido_documento_id || null,
          contrato_id: defaults?.contrato_id || null,
          file_url: defaults?.file_url || null,
          file_name: defaults?.file_name || null,
          storage_path: defaults?.storage_path || null,
          observacao: obs || null,
          expira_em: expira.toISOString(),
          status: "aguardando_cliente",
        })
        .select()
        .single();
      if (error) throw error;

      // participante cliente
      await supabase.from("assinatura_participantes").insert({
        solicitacao_id: data.id,
        tipo: "cliente",
        nome: cliente?.nome || null,
        email,
        telefone,
        status: "pendente",
      });
      await supabase.from("assinatura_eventos").insert({
        solicitacao_id: data.id,
        tipo_evento: "solicitacao_criada",
        status_novo: "aguardando_cliente",
        descricao: "Solicitação de assinatura criada",
      });

      // === Pré-assinatura automática da loja (carimbo + assinatura simulada) ===
      try {
        const { data: lojaInfo } = await supabase
          .from("lojas")
          .select("nome,cnpj,endereco,cidade,uf")
          .eq("id", pedido.loja_id)
          .maybeSingle();
        const responsavel = (profile as any)?.nome_completo || user?.email || "Loja";
        const sigData = {
          nome: lojaInfo?.nome || "Loja",
          cnpj: lojaInfo?.cnpj,
          endereco: lojaInfo?.endereco,
          cidade: lojaInfo?.cidade,
          uf: lojaInfo?.uf,
          responsavel,
        };
        const sigBlob = await buildLojaSignatureBlob(sigData);
        const sigPath = `${data.id}/assinatura-loja-${Date.now()}.svg`;
        let assinaturaLojaUrl = "";
        const up = await supabase.storage
          .from("assinaturas-evidencias")
          .upload(sigPath, sigBlob, { upsert: true, contentType: "image/svg+xml" });
        if (!up.error) {
          assinaturaLojaUrl = supabase.storage.from("assinaturas-evidencias").getPublicUrl(sigPath).data.publicUrl;
        } else {
          // fallback: data URL inline caso storage falhe
          assinaturaLojaUrl = buildLojaSignatureDataUrl(sigData);
        }

        const { data: partLoja } = await supabase
          .from("assinatura_participantes")
          .insert({
            solicitacao_id: data.id,
            tipo: "loja",
            nome: responsavel,
            user_id: user?.id || null,
            cargo: role || null,
            status: "assinado",
            assinado_em: new Date().toISOString(),
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          })
          .select()
          .single();

        await supabase.from("assinatura_evidencias").insert({
          solicitacao_id: data.id,
          participante_id: partLoja?.id,
          assinatura_url: assinaturaLojaUrl,
          aceite: true,
          aceite_texto: "Pré-assinatura digital da loja (carimbo eletrônico)",
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        });

        await supabase
          .from("solicitacoes_assinatura")
          .update({
            loja_assinado_em: new Date().toISOString(),
            assinatura_loja_url: assinaturaLojaUrl,
          })
          .eq("id", data.id);

        await supabase.from("assinatura_eventos").insert({
          solicitacao_id: data.id,
          tipo_evento: "loja_assinou",
          status_anterior: "aguardando_cliente",
          status_novo: "aguardando_cliente",
          descricao: `Loja pré-assinou automaticamente (${responsavel})`,
          user_id: user?.id || null,
        });
      } catch (preErr) {
        // Não bloqueia a criação se a pré-assinatura falhar
        console.warn("Falha ao gerar pré-assinatura da loja:", preErr);
      }


      const url = getPublicSignatureUrl(data.token);
      setLink(url);
      onCreated?.(data.id, url);
      toast.success("Solicitação criada");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova solicitação de assinatura</DialogTitle>
        </DialogHeader>
        {link ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Link gerado. Compartilhe com o cliente:</p>
            <div className="flex gap-2">
              <Input value={link} readOnly />
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("Copiado!"); }}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={!telefone}
                onClick={() => {
                  const tel = (telefone || "").replace(/\D/g, "");
                  const msg = encodeURIComponent(
                    `Olá${cliente?.nome ? " " + cliente.nome.split(" ")[0] : ""}! Segue o link para assinatura digital do seu documento: ${link}`
                  );
                  window.open(`https://wa.me/${tel.startsWith("55") ? tel : "55" + tel}?text=${msg}`, "_blank");
                }}
              >
                <MessageCircle className="w-4 h-4 mr-1" /> Enviar WhatsApp
              </Button>
              <Button
                variant="outline"
                disabled={!email}
                onClick={() => {
                  const subj = encodeURIComponent("Assinatura digital de documento");
                  const body = encodeURIComponent(
                    `Olá${cliente?.nome ? " " + cliente.nome.split(" ")[0] : ""},\n\nAcesse o link abaixo para assinar seu documento de forma segura:\n\n${link}\n\nAtenciosamente.`
                  );
                  window.open(`mailto:${email}?subject=${subj}&body=${body}`);
                }}
              >
                <Mail className="w-4 h-4 mr-1" /> Enviar e-mail
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              O WhatsApp abre com a mensagem pronta para envio. Para envio automático por e-mail integrado, configure o domínio de e-mails em Lovable Cloud → E-mails.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Tipo de documento</Label>
              <Select value={tipoId} onValueChange={setTipoId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>E-mail do cliente</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Validade (dias)</Label>
              <Input type="number" min={1} value={validade} onChange={(e) => setValidade(parseInt(e.target.value) || 30)} />
            </div>
            <div>
              <Label>Observação interna</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
            </div>
          </div>
        )}
        <DialogFooter>
          {link ? (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          ) : (
            <Button onClick={criar} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Gerar link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
