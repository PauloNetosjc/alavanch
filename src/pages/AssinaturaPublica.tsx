import { useEffect, useRef, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
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
import { getPublicSignatureUrl } from "@/lib/publicLinks";
import { arquivarDocumentoAssinado } from "@/lib/arquivarDocAssinado";
import { prepararContratoParaAssinatura } from "@/lib/contratoAssinaturaDoc";

function maskDocAuto(v: string) {
  const d = unmask(v);
  return d.length <= 11 ? maskCpf(v) : maskCnpj(v);
}

const ACEITE_TEXT =
  "Declaro que li e estou de acordo com o conteúdo deste documento. Confirmo que os dados enviados são verdadeiros e autorizo o uso desta assinatura digital para validação deste documento.";

type Participante = {
  id: string;
  solicitacao_id: string;
  tipo: "cliente" | "loja";
  status: string;
  token: string;
  nome: string | null;
  email: string | null;
  documento: string | null;
  assinado_em: string | null;
  visualizado_em: string | null;
};

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
  cliente_assinado_em?: string | null;
  loja_assinado_em?: string | null;
  contrato_id?: string | null;
  assinatura_loja_url?: string | null;
};

async function getClientLocation() {
  if (!navigator.geolocation) return null;
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      captured_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export default function AssinaturaPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [participante, setParticipante] = useState<Participante | null>(null);
  const [solic, setSolic] = useState<Solicitacao | null>(null);
  const [tipo, setTipo] = useState<any>(null);
  const [pedido, setPedido] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [loja, setLoja] = useState<any>(null);
  const [tpl, setTpl] = useState<ContratoTemplate | null>(null);
  const [docHtml, setDocHtml] = useState<string>("");
  const [erro, setErro] = useState<string>("");
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
  const padRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      setLoading(true);
      setErro("");

      // 1) Busca por token do PARTICIPANTE (novo fluxo)
      const { data: part } = await supabase
        .from("assinatura_participantes" as any)
        .select("*")
        .eq("token", token)
        .maybeSingle();

      let solicId: string | null = (part as any)?.solicitacao_id ?? null;
      let participanteAtual: Participante | null = (part as any) || null;

      // Fallback legado DESATIVADO temporariamente: nunca confiar em solicitacoes_assinatura.token
      if (!part) {
        setErro("Link antigo ou inválido. Gere um novo link no pedido.");
        setLoading(false);
        return;
      }

      if (!solicId) {
        setErro("Link inválido.");
        setLoading(false);
        return;
      }

      // 3) Carrega solicitação
      const { data: s } = await supabase
        .from("solicitacoes_assinatura")
        .select("*")
        .eq("id", solicId)
        .maybeSingle();
      if (!s) {
        setErro("Solicitação não encontrada.");
        setLoading(false);
        return;
      }

      if (s.status === "cancelado") setErro("Esta solicitação foi cancelada.");
      else if (s.status === "expirado" || new Date(s.expira_em) < new Date()) setErro("Este link expirou.");
      else if (s.status === "recusado") setErro("Esta assinatura foi recusada.");

      setSolic(s as Solicitacao);
      setParticipante(participanteAtual);

      // 4) Marca como visualizado (uma vez)
      if (participanteAtual && !participanteAtual.visualizado_em && participanteAtual.status === "pendente") {
        await supabase
          .from("assinatura_participantes" as any)
          .update({ visualizado_em: new Date().toISOString(), status: "visualizado" })
          .eq("id", participanteAtual.id);
      }

      // 5) Carrega contexto (tipo, pedido, cliente, loja)
      const [{ data: t }, { data: p }, { data: c }, { data: l }] = await Promise.all([
        supabase.from("tipos_documento").select("*").eq("id", s.tipo_documento_id).maybeSingle(),
        supabase.from("pedidos").select("id,codigo,valor_total,loja_id,orcamento_id").eq("id", s.pedido_id).maybeSingle(),
        s.cliente_id
          ? supabase.from("clientes").select("nome,email,cpf_cnpj,telefone").eq("id", s.cliente_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        s.loja_id
          ? supabase.from("lojas").select("nome,cnpj,endereco,cidade,uf").eq("id", s.loja_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      const { data: cfg } = p?.loja_id
        ? await supabase.from("configuracoes_empresa").select("nome_empresa,nome_fantasia,cnpj,endereco,telefone").eq("loja_id", p.loja_id).maybeSingle()
        : ({ data: null } as any);
      setTipo(t);
      setPedido(p);
      setCliente(c);
      setLoja(l);
      setRequerLoja(!!t?.requer_assinatura_loja);

      // 6) Render do contrato HTML, se houver
      if (s.contrato_id) {
        const { data: ct } = await supabase.from("contratos").select("*").eq("id", s.contrato_id).maybeSingle();
        if (ct?.template_id) {
          const { data: tpls } = await supabase.from("contratos_template").select("*").eq("id", ct.template_id).maybeSingle();
          setTpl(tpls as any);
          if (tpls && ct.conteudo_snapshot) {
            try {
              const snap = (ct.conteudo_snapshot as any) || {};
              const empresaSnap = snap.empresa || {};
              setDocHtml(renderContratoHtml(tpls as any, {
                ...snap,
                empresa: {
                  ...empresaSnap,
                  nome: cfg?.nome_fantasia || l?.nome || empresaSnap.nome || "Loja",
                  razao_social: cfg?.nome_empresa || l?.nome || empresaSnap.razao_social || empresaSnap.nome || "Loja",
                  nome_fantasia: cfg?.nome_fantasia || l?.nome || empresaSnap.nome_fantasia || empresaSnap.nome || null,
                  cnpj: l?.cnpj || cfg?.cnpj || empresaSnap.cnpj || "",
                  endereco: l?.endereco || cfg?.endereco || empresaSnap.endereco || "",
                  telefone: cfg?.telefone || empresaSnap.telefone || "",
                },
                signing_url: getPublicSignatureUrl(token),
                assinatura_loja_url: (s as any).assinatura_loja_url,
                loja_assinado_em: (s as any).loja_assinado_em,
              }));
            } catch {/* noop */}
          }
        }
      }

      // 7) Prefill com dados do participante / cliente
      const nomeInicial = participanteAtual?.nome || c?.nome || "";
      const docInicial = participanteAtual?.documento || c?.cpf_cnpj || "";
      if (nomeInicial) setNome(nomeInicial);
      if (docInicial) setDoc(maskDocAuto(docInicial));

      setLoading(false);
    })();
  }, [token]);

  async function finalizar() {
    if (!solic || !participante) return;
    if (!aceite) return toast.error("Você precisa aceitar os termos.");
    if (!nome.trim()) return toast.error("Informe seu nome completo.");
    if (padRef.current?.isEmpty()) return toast.error("Desenhe sua assinatura.");

    const isCliente = participante.tipo === "cliente";
    if (isCliente) {
      if (!docFoto) return toast.error("Envie a foto do documento identificador.");
      if (!selfie) return toast.error("Envie a selfie segurando o documento.");
    }

    setEnviando(true);
    try {
      const ua = navigator.userAgent;
      let ip: string | null = null;
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        ip = (await r.json())?.ip || null;
      } catch { /* ignore */ }
      const localizacao = isCliente ? await getClientLocation() : null;

      // Uploads
      const ts = Date.now();
      const sigBlob = await (await fetch(padRef.current!.toDataURL())).blob();
      const sigPath = `${solic.id}/${participante.tipo}-assinatura-${ts}.png`;
      let docUrl: string | null = null;
      let selfieUrl: string | null = null;

      const ups: Promise<any>[] = [
        supabase.storage.from("assinaturas-evidencias").upload(sigPath, sigBlob, { upsert: true, contentType: "image/png" }),
      ];
      if (isCliente && docFoto) {
        const docExt = (docFoto.name.split(".").pop() || "jpg").toLowerCase();
        const docPath = `${solic.id}/cliente-documento-${ts}.${docExt}`;
        ups.push(supabase.storage.from("assinaturas-evidencias").upload(docPath, docFoto, { upsert: true, contentType: docFoto.type }));
      }
      if (isCliente && selfie) {
        const selfieExt = (selfie.name.split(".").pop() || "jpg").toLowerCase();
        const selfiePath = `${solic.id}/cliente-selfie-${ts}.${selfieExt}`;
        ups.push(supabase.storage.from("assinaturas-evidencias").upload(selfiePath, selfie, { upsert: true, contentType: selfie.type }));
      }
      const results = await Promise.all(ups);
      const errAny = results.find((r: any) => r.error);
      if (errAny?.error) throw errAny.error;

      const assinaturaUrl = supabase.storage.from("assinaturas-evidencias").getPublicUrl(sigPath).data.publicUrl;
      if (isCliente && docFoto) {
        const docExt = (docFoto.name.split(".").pop() || "jpg").toLowerCase();
        const docPath = `${solic.id}/cliente-documento-${ts}.${docExt}`;
        docUrl = supabase.storage.from("assinaturas-evidencias").getPublicUrl(docPath).data.publicUrl;
      }
      if (isCliente && selfie) {
        const selfieExt = (selfie.name.split(".").pop() || "jpg").toLowerCase();
        const selfiePath = `${solic.id}/cliente-selfie-${ts}.${selfieExt}`;
        selfieUrl = supabase.storage.from("assinaturas-evidencias").getPublicUrl(selfiePath).data.publicUrl;
      }

      const agora = new Date().toISOString();

      // 1) Atualiza APENAS o participante do token atual
      const { error: errPart } = await supabase
        .from("assinatura_participantes" as any)
        .update({
          status: "assinado",
          assinado_em: agora,
          ip,
          user_agent: ua,
          nome,
          documento: doc || null,
        })
        .eq("id", participante.id);
      if (errPart) throw errPart;

      // 2) Evidência vinculada ao participante
      await supabase.from("assinatura_evidencias").insert({
        solicitacao_id: solic.id,
        participante_id: participante.id,
        documento_foto_url: docUrl,
        selfie_url: selfieUrl,
        assinatura_url: assinaturaUrl,
        aceite: true,
        aceite_texto: ACEITE_TEXT,
        ip,
        localizacao,
        user_agent: ua,
      } as any);

      // 3) Evento
      await supabase.from("assinatura_eventos").insert({
        solicitacao_id: solic.id,
        tipo_evento: isCliente ? "cliente_assinou" : "loja_assinou",
        participante_id: participante.id,
        descricao: `${isCliente ? "Cliente" : "Loja"} assinou: ${nome}`,
        user_agent: ua,
      } as any);

      // 4) Espelho legado em solicitacoes_assinatura (para PDF final e contratos)
      const updSolic: any = {};
      if (isCliente) {
        updSolic.cliente_assinado_em = agora;
        updSolic.cliente_nome = nome;
        updSolic.cliente_documento = doc || null;
        updSolic.cliente_ip = ip;
        updSolic.cliente_user_agent = ua;
        updSolic.cliente_localizacao = localizacao;
        updSolic.assinatura_cliente_url = assinaturaUrl;
        if (docUrl) updSolic.doc_foto_url = docUrl;
        if (selfieUrl) updSolic.selfie_url = selfieUrl;
      } else {
        updSolic.loja_assinado_em = agora;
        updSolic.loja_assinatura_nome = nome;
        updSolic.loja_ip = ip;
        updSolic.loja_user_agent = ua;
        updSolic.assinatura_loja_url = assinaturaUrl;
      }
      await supabase.from("solicitacoes_assinatura").update(updSolic).eq("id", solic.id);

      // 5) Trigger SQL recalcula status geral
      await prepararContratoParaAssinatura(
        solic.id,
        isCliente ? null : { nome, email: participante.email || "" },
        isCliente ? { url: assinaturaUrl, assinadoEm: agora, ip } : undefined
      ).catch(() => null);

      // 6) Recarrega participante para refletir status
      const { data: solicNova } = await supabase
        .from("solicitacoes_assinatura")
        .select("status,cliente_assinado_em,loja_assinado_em")
        .eq("id", solic.id)
        .maybeSingle();
      if (solicNova?.status === "concluido") {
        await supabase.functions.invoke("assinatura-pdf-final", { body: { solicitacao_id: solic.id } }).catch(() => null);
        await arquivarDocumentoAssinado(solic.id).catch(() => null);
      }

      setParticipante({ ...participante, status: "assinado", assinado_em: agora });
      toast.success("Assinatura registrada!");
    } catch (e: any) {
      toast.error(e.message || "Falha ao registrar assinatura.");
    } finally {
      setEnviando(false);
    }
  }

  async function recusar() {
    if (!solic || !participante) return;
    if (!motivoRecusa.trim()) return toast.error("Informe o motivo da recusa.");
    setRecusando(true);
    try {
      const ua = navigator.userAgent;
      await supabase
        .from("assinatura_participantes" as any)
        .update({ status: "recusado", user_agent: ua })
        .eq("id", participante.id);
      await supabase.from("solicitacoes_assinatura").update({
        status: "recusado",
        motivo_recusa: motivoRecusa,
        recusado_em: new Date().toISOString(),
      }).eq("id", solic.id);
      await supabase.from("assinatura_eventos").insert({
        solicitacao_id: solic.id,
        tipo_evento: `${participante.tipo}_recusou`,
        status_anterior: solic.status,
        status_novo: "recusado",
        descricao: `${participante.tipo === "cliente" ? "Cliente" : "Loja"} recusou. Motivo: ${motivoRecusa}`,
        participante_id: participante.id,
        user_agent: ua,
      } as any);
      setRecusarOpen(false);
      setParticipante({ ...participante, status: "recusado" });
      toast.success("Recusa registrada");
    } catch (e: any) {
      toast.error(e.message || "Falha ao registrar recusa");
    } finally {
      setRecusando(false);
    }
  }

  if (redirectTo) return <Navigate to={redirectTo} replace />;
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

  // === Decisão de tela baseada SOMENTE no participante deste token ===
  if (participante?.status === "recusado")
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" /> Assinatura recusada
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Sua recusa foi registrada. Em caso de dúvidas, entre em contato com a loja.
          </CardContent>
        </Card>
      </div>
    );

  if (participante?.status === "assinado")
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" /> Assinatura já realizada
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Esta assinatura foi concluída
              {participante.assinado_em ? <> em <strong>{new Date(participante.assinado_em).toLocaleString("pt-BR")}</strong></> : null}.
            </p>
            <p>Você pode fechar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );

  // Cliente esperando loja assinar (regra do tipo de documento)
  if (participante?.tipo === "cliente" && requerLoja && !solic?.loja_assinado_em)
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <ShieldCheck className="w-5 h-5" /> Aguardando assinatura da loja
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Este contrato exige assinatura da loja antes da sua. Assim que a loja assinar, este mesmo link ficará liberado para você concluir.
          </CardContent>
        </Card>
      </div>
    );

  const isCliente = participante?.tipo === "cliente";

  return (
    <div className="min-h-screen bg-muted py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 text-primary font-semibold">
            <ShieldCheck className="w-5 h-5" /> {loja?.nome || "Assinatura Digital"}
          </div>
          <p className="text-xs text-muted-foreground">
            {isCliente ? "Confira o documento e assine com segurança" : "Assinatura pela loja"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" /> {tipo?.nome}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><span className="text-muted-foreground">Assinando como:</span> {participante?.tipo === "loja" ? "Loja" : "Cliente"}</div>
            <div><span className="text-muted-foreground">Cliente:</span> {cliente?.nome || "—"}</div>
            <div><span className="text-muted-foreground">Pedido:</span> {pedido?.codigo || "—"}</div>
            <div><span className="text-muted-foreground">Documento:</span> {solic?.file_name || tipo?.nome}</div>
          </CardContent>
        </Card>

        {solic?.file_url && (solic.file_url.toLowerCase().includes(".pdf") || solic.file_name?.toLowerCase().endsWith(".pdf")) ? (
          <Card>
            <CardHeader><CardTitle className="text-sm">Contrato em PDF</CardTitle></CardHeader>
            <CardContent>
              <iframe title="Contrato para assinatura" src={solic.file_url} className="w-full h-[70vh] rounded border bg-background" />
            </CardContent>
          </Card>
        ) : docHtml && (
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
            {isCliente && (
              <>
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
              </>
            )}
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
