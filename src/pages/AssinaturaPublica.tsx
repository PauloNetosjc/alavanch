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
import { renderContratoHtml, type ContratoTemplate } from "@/lib/contratoTemplate";
import { maskCpf, maskCnpj, unmask } from "@/lib/masks";

function maskDocAuto(v: string) {
  const d = unmask(v);
  return d.length <= 11 ? maskCpf(v) : maskCnpj(v);
}

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
  const [contrato, setContrato] = useState<any>(null);
  const [tpl, setTpl] = useState<ContratoTemplate | null>(null);
  const [docHtml, setDocHtml] = useState<string>("");
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
      const cacheBust = Date.now().toString();
      const { data: s, error: solicError } = await supabase
        .from("solicitacoes_assinatura")
        .select("*")
        .filter("id", "not.is", null)
        .eq("token", token)
        .limit(1)
        .maybeSingle();
      if (solicError) {
        setErro("Não foi possível carregar a assinatura. Tente abrir o link novamente.");
        setLoading(false);
        return;
      }
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
        supabase.from("pedidos").select("id,codigo,valor_total,loja_id,orcamento_id").eq("id", s.pedido_id).limit(1).maybeSingle(),
        s.cliente_id
          ? supabase.from("clientes").select("nome,email,cpf_cnpj,telefone").eq("id", s.cliente_id).maybeSingle()
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

      // Carrega contrato + template e renderiza HTML inline (somente leitura)
      if (s.contrato_id) {
        const { data: ct } = await supabase
          .from("contratos")
          .select("*")
          .eq("id", s.contrato_id)
          .maybeSingle();
        setContrato(ct);
        if (ct?.template_id) {
          const { data: tpls } = await supabase
            .from("contratos_template")
            .select("*")
            .eq("id", ct.template_id)
            .maybeSingle();
          setTpl(tpls as any);
          if (tpls && ct.conteudo_snapshot) {
            try {
              setDocHtml(renderContratoHtml(tpls as any, { ...(ct.conteudo_snapshot as any), signing_url: `${window.location.origin}/assinatura/${token}?v=${cacheBust}` }));
            } catch {/* noop */}
          }
        }
      }

      // Prefill com dados do cliente
      if (c?.nome) setNome(c.nome);
      if (c?.cpf_cnpj) setDoc(maskDocAuto(c.cpf_cnpj));
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
      const ua = navigator.userAgent;
      // Captura de IP (best effort, sem bloquear)
      let ip: string | null = null;
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        ip = (await r.json())?.ip || null;
      } catch { /* ignore */ }

      // Sobe arquivos para storage `assinaturas-evidencias/{solic_id}/...`
      const ts = Date.now();
      const docExt = (docFoto.name.split(".").pop() || "jpg").toLowerCase();
      const selfieExt = (selfie.name.split(".").pop() || "jpg").toLowerCase();
      const docPath = `${solic.id}/documento-${ts}.${docExt}`;
      const selfiePath = `${solic.id}/selfie-${ts}.${selfieExt}`;
      const sigBlob = await (await fetch(padRef.current!.toDataURL("image/png"))).blob();
      const sigPath = `${solic.id}/assinatura-${ts}.png`;

      const ups = await Promise.all([
        supabase.storage.from("assinaturas-evidencias").upload(docPath, docFoto, { upsert: true, contentType: docFoto.type }),
        supabase.storage.from("assinaturas-evidencias").upload(selfiePath, selfie, { upsert: true, contentType: selfie.type }),
        supabase.storage.from("assinaturas-evidencias").upload(sigPath, sigBlob, { upsert: true, contentType: "image/png" }),
      ]);
      const upErr = ups.find((u) => u.error);
      if (upErr?.error) throw upErr.error;
      const docUrl = supabase.storage.from("assinaturas-evidencias").getPublicUrl(docPath).data.publicUrl;
      const selfieUrl = supabase.storage.from("assinaturas-evidencias").getPublicUrl(selfiePath).data.publicUrl;
      const assinaturaUrl = supabase.storage.from("assinaturas-evidencias").getPublicUrl(sigPath).data.publicUrl;

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

      // Atualiza status + snapshot
      const novoStatus = requerLoja ? "aguardando_loja" : "concluido";
      const upd: any = {
        status: novoStatus,
        cliente_assinado_em: new Date().toISOString(),
        cliente_nome: nome,
        cliente_ip: ip,
        cliente_user_agent: ua,
        assinatura_cliente_url: assinaturaUrl,
        doc_foto_url: docUrl,
        selfie_url: selfieUrl,
      };
      if (!requerLoja) upd.concluido_em = new Date().toISOString();
      const { error: errUpd } = await supabase.from("solicitacoes_assinatura").update(upd).eq("id", solic.id);
      if (errUpd) throw errUpd;

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
      <div className="min-h-screen flex items-center justify-center bg-muted" role="status" aria-label="Carregando assinatura">
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
          </CardContent>
        </Card>

        {docHtml && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Documento</CardTitle></CardHeader>
            <CardContent>
              <div
                className="prose prose-sm max-w-none bg-background p-4 rounded border max-h-[60vh] overflow-auto"
                dangerouslySetInnerHTML={{ __html: docHtml }}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-sm">Identificação</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>CPF/CNPJ</Label>
              <Input value={doc} onChange={(e) => setDoc(maskDocAuto(e.target.value))} placeholder="000.000.000-00" />
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

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <Button className="w-full" size="lg" disabled={enviando} onClick={finalizar}>
            {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Finalizar assinatura
          </Button>
          <Button variant="outline" size="lg" onClick={() => setRecusarOpen(true)}>
            <XCircle className="w-4 h-4 mr-1" /> Recusar
          </Button>
        </div>
      </div>

      <Dialog open={recusarOpen} onOpenChange={setRecusarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar assinatura</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da recusa</Label>
            <Textarea
              rows={4}
              value={motivoRecusa}
              onChange={(e) => setMotivoRecusa(e.target.value)}
              placeholder="Descreva o motivo (obrigatório)"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecusarOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={recusando} onClick={recusar}>
              {recusando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
