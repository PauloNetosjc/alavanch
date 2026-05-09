import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ShieldCheck, FileText, Upload, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad, type SignaturePadHandle } from "@/components/assinaturas/SignaturePad";

const ACEITE_TEXT =
  "Declaro que li e estou de acordo com o conteúdo deste documento. Confirmo que os dados enviados são verdadeiros e autorizo o uso desta assinatura digital para validação deste documento.";

type Solicitacao = {
  id: string;
  pedido_id: string;
  status: string;
  expira_em: string;
  file_url: string | null;
  file_name: string | null;
  storage_path: string | null;
  cliente_id: string | null;
  loja_id: string | null;
  tipo_documento_id: string;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export default function AssinaturaPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [solic, setSolic] = useState<Solicitacao | null>(null);
  const [tipo, setTipo] = useState<any>(null);
  const [pedido, setPedido] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [loja, setLoja] = useState<any>(null);
  const [erro, setErro] = useState<string>("");
  const [done, setDone] = useState(false);
  const [requerLoja, setRequerLoja] = useState(false);

  const [nome, setNome] = useState("");
  const [doc, setDoc] = useState("");
  const [aceite, setAceite] = useState(false);
  const [docFoto, setDocFoto] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [recusarOpen, setRecusarOpen] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [recusando, setRecusando] = useState(false);
  const [recusado, setRecusado] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      setLoading(true);
      const { data: s } = await supabase
        .from("solicitacoes_assinatura")
        .select("*")
        .eq("token", token)
        .maybeSingle();
      if (!s) {
        setErro("Link inválido.");
        setLoading(false);
        return;
      }
      if (new Date(s.expira_em) < new Date()) setErro("Este link expirou.");
      else if (["cancelado", "expirado", "recusado"].includes(s.status)) setErro("Esta solicitação foi cancelada.");
      else if (["concluido", "assinado_cliente", "aguardando_loja", "assinado_loja"].includes(s.status))
        setDone(true);

      setSolic(s as Solicitacao);

      const [{ data: t }, { data: p }, { data: c }, { data: l }] = await Promise.all([
        supabase.from("tipos_documento").select("*").eq("id", s.tipo_documento_id).maybeSingle(),
        supabase.from("pedidos").select("id,codigo").eq("id", s.pedido_id).maybeSingle(),
        s.cliente_id
          ? supabase.from("clientes").select("nome,email").eq("id", s.cliente_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        s.loja_id
          ? supabase.from("lojas").select("nome").eq("id", s.loja_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setTipo(t);
      setPedido(p);
      setCliente(c);
      setLoja(l);
      setRequerLoja(!!t?.requer_assinatura_loja);
      if (c?.nome) setNome(c.nome);
      setLoading(false);
    })();
  }, [token]);

  async function finalizar() {
    if (!solic) return;
    if (!aceite) return toast.error("Você precisa aceitar os termos.");
    if (!nome.trim()) return toast.error("Informe seu nome completo.");
    if (!docFoto) return toast.error("Envie a foto do documento identificador.");
    if (!selfie) return toast.error("Envie a selfie segurando o documento.");
    if (padRef.current?.isEmpty()) return toast.error("Desenhe sua assinatura.");

    setEnviando(true);
    try {
      const [docUrl, selfieUrl] = await Promise.all([fileToDataUrl(docFoto), fileToDataUrl(selfie)]);
      const assinaturaUrl = padRef.current!.toDataURL();
      const ua = navigator.userAgent;

      // Cria participante
      const { data: part, error: errP } = await supabase
        .from("assinatura_participantes")
        .insert({
          solicitacao_id: solic.id,
          tipo: "cliente",
          nome,
          documento: doc || null,
          status: "assinado",
          assinado_em: new Date().toISOString(),
          user_agent: ua,
        })
        .select()
        .single();
      if (errP) throw errP;

      // Evidência (imutável)
      const { error: errE } = await supabase.from("assinatura_evidencias").insert({
        solicitacao_id: solic.id,
        participante_id: part.id,
        documento_foto_url: docUrl,
        selfie_url: selfieUrl,
        assinatura_url: assinaturaUrl,
        aceite: true,
        aceite_texto: ACEITE_TEXT,
        user_agent: ua,
      });
      if (errE) throw errE;

      // Atualiza status
      const novoStatus = requerLoja ? "aguardando_loja" : "concluido";
      const upd: any = { status: novoStatus, cliente_assinado_em: new Date().toISOString() };
      if (!requerLoja) upd.concluido_em = new Date().toISOString();
      await supabase.from("solicitacoes_assinatura").update(upd).eq("id", solic.id);

      // Evento
      await supabase.from("assinatura_eventos").insert({
        solicitacao_id: solic.id,
        tipo_evento: "cliente_assinou",
        status_anterior: "aguardando_cliente",
        status_novo: novoStatus,
        descricao: `Cliente assinou: ${nome}`,
        participante_id: part.id,
        user_agent: ua,
      });

      setDone(true);
      toast.success("Assinatura registrada!");
    } catch (e: any) {
      toast.error(e.message || "Falha ao registrar assinatura.");
    } finally {
      setEnviando(false);
    }
  }

  async function recusar() {
    if (!solic) return;
    if (!motivoRecusa.trim()) return toast.error("Informe o motivo da recusa.");
    setRecusando(true);
    try {
      const ua = navigator.userAgent;
      const { error } = await supabase
        .from("solicitacoes_assinatura")
        .update({
          status: "recusado",
          motivo_recusa: motivoRecusa,
          recusado_em: new Date().toISOString(),
        })
        .eq("id", solic.id);
      if (error) throw error;
      await supabase.from("assinatura_eventos").insert({
        solicitacao_id: solic.id,
        tipo_evento: "cliente_recusou",
        status_anterior: solic.status,
        status_novo: "recusado",
        descricao: `Cliente recusou. Motivo: ${motivoRecusa}`,
        user_agent: ua,
      });
      setRecusarOpen(false);
      setRecusado(true);
      toast.success("Recusa registrada");
    } catch (e: any) {
      toast.error(e.message || "Falha ao registrar recusa");
    } finally {
      setRecusando(false);
    }
  }
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );

  if (erro)
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Não foi possível abrir</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{erro}</CardContent>
        </Card>
      </div>
    );

  if (recusado)
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" /> Assinatura recusada
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Sua recusa foi registrada e a equipe da loja foi notificada. Em caso de dúvidas, entre em contato.
          </CardContent>
        </Card>
      </div>
    );

  if (done)
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" /> Assinatura realizada
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {requerLoja
              ? "Assinatura realizada com sucesso. O documento foi enviado para validação interna da loja e ficará registrado junto ao seu pedido."
              : "Assinatura realizada com sucesso. O documento foi concluído e registrado junto ao seu pedido."}
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className="min-h-screen bg-muted py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 text-primary font-semibold">
            <ShieldCheck className="w-5 h-5" /> {loja?.nome || "Assinatura Digital"}
          </div>
          <p className="text-xs text-muted-foreground">Confira o documento e assine com segurança</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" /> {tipo?.nome}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><span className="text-muted-foreground">Cliente:</span> {cliente?.nome || "—"}</div>
            <div><span className="text-muted-foreground">Pedido:</span> {pedido?.codigo || "—"}</div>
            <div><span className="text-muted-foreground">Documento:</span> {solic?.file_name || tipo?.nome}</div>
            {solic?.file_url && (
              <a href={solic.file_url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-primary underline text-xs">
                Visualizar documento
              </a>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Identificação</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>CPF/Documento</Label>
              <Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Upload className="w-3.5 h-3.5" /> Foto do documento (RG/CNH)</Label>
              <Input type="file" accept="image/*" capture="environment" onChange={(e) => setDocFoto(e.target.files?.[0] || null)} />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Upload className="w-3.5 h-3.5" /> Selfie segurando o documento</Label>
              <Input type="file" accept="image/*" capture="user" onChange={(e) => setSelfie(e.target.files?.[0] || null)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Assinatura</CardTitle></CardHeader>
          <CardContent>
            <SignaturePad ref={padRef} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <label className="flex items-start gap-2 text-xs">
              <Checkbox checked={aceite} onCheckedChange={(v) => setAceite(!!v)} />
              <span className="text-muted-foreground">{ACEITE_TEXT}</span>
            </label>
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" disabled={enviando} onClick={finalizar}>
          {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Finalizar assinatura
        </Button>
      </div>
    </div>
  );
}
