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
import { renderContratoHtml, enrichContratoCtxWithLive, type ContratoTemplate } from "@/lib/contratoTemplate";
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
  const [documentoUrl, setDocumentoUrl] = useState<string>("");
  const [documentoNome, setDocumentoNome] = useState<string>("");
  const [documentoMime, setDocumentoMime] = useState<string>("");
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

  // Dados do representante da loja (preenchidos a partir da sessão, se houver)
  const [representanteEmail, setRepresentanteEmail] = useState("");
  const [representanteCargo, setRepresentanteCargo] = useState("");
  const [representanteUserId, setRepresentanteUserId] = useState<string | null>(null);
  const [representanteVeioDaSessao, setRepresentanteVeioDaSessao] = useState(false);

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
      else if (s.status === "assinado_manual") setErro("Este contrato foi assinado manualmente. A assinatura digital foi encerrada.");
      else if (s.status === "expirado" || new Date(s.expira_em) < new Date()) setErro("Este link expirou.");
      else if (s.status === "recusado") setErro("Esta assinatura foi recusada.");
      else if (participanteAtual?.status === "cancelado_manual") setErro("Este contrato foi assinado manualmente. A assinatura digital foi encerrada.");

      setSolic(s as Solicitacao);
      setParticipante(participanteAtual);

      // 3.1) Busca URL assinada do documento anexado (suporta storage_path sem file_url público)
      try {
        const { data: docData } = await supabase.functions.invoke("assinatura-documento-url", {
          body: { token },
        });
        if (docData) {
          const u = (docData as any).url || (docData as any).url_do_arquivo || (docData as any).file_url || "";
          const n = (docData as any).nome || (docData as any).nome_do_arquivo || (docData as any).file_name || "";
          const m = (docData as any).mime || (docData as any).tipo_mime || (docData as any).mime_type || "";
          if (u) setDocumentoUrl(u);
          if (n) setDocumentoNome(n);
          if (m) setDocumentoMime(m);
        }
      } catch { /* fallback para solic.file_url / docHtml */ }
      if (!documentoUrl && (s as any).file_url) {
        setDocumentoUrl((s as any).file_url);
        setDocumentoNome((s as any).file_name || "");
      }


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
        ? await supabase.from("configuracoes_empresa").select("nome_empresa,nome_fantasia,cnpj,endereco,telefone,mostrar_desconto_contrato" as any).eq("loja_id", p.loja_id).maybeSingle()
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
              const baseCtx = {
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
                mostrar_desconto: (cfg as any)?.mostrar_desconto_contrato !== false,
              };
              const enriched = await enrichContratoCtxWithLive(baseCtx as any, {
                orcamento_id: (p as any)?.orcamento_id || null,
                cliente_id: s.cliente_id || null,
              });
              setDocHtml(renderContratoHtml(tpls as any, enriched));
            } catch {/* noop */}
          }
        }
      }


      // 7) Prefill — REGRA: nunca usar dados do cliente para o participante 'loja'.
      if (participanteAtual?.tipo === "loja") {
        // Prioridade: 1) dados já salvos no participante  2) sessão atual  3) manual
        let nomeLoja = participanteAtual?.nome || (s as any)?.loja_assinatura_nome || "";
        let emailLoja = participanteAtual?.email || (s as any)?.loja_assinatura_email || "";
        let cargoLoja = (participanteAtual as any)?.cargo || (s as any)?.loja_assinatura_cargo || "";
        let userIdLoja: string | null = (participanteAtual as any)?.user_id || null;
        let veioDaSessao = false;

        try {
          const { data: sess } = await supabase.auth.getSession();
          const sUser = sess?.session?.user;
          if (sUser?.id) {
            const [{ data: prof }, { data: rol }] = await Promise.all([
              supabase.from("profiles").select("nome_completo,loja_id").eq("user_id", sUser.id).maybeSingle(),
              supabase.from("user_roles").select("role").eq("user_id", sUser.id).limit(1).maybeSingle(),
            ]);
            const nomeSessao = prof?.nome_completo || sUser.email || "";
            const emailSessao = sUser.email || "";
            const cargoSessao = (rol as any)?.role || "";

            if (!nomeLoja && nomeSessao) { nomeLoja = nomeSessao; veioDaSessao = true; }
            if (!emailLoja && emailSessao) { emailLoja = emailSessao; veioDaSessao = true; }
            if (!cargoLoja && cargoSessao) cargoLoja = cargoSessao;
            if (!userIdLoja && sUser.id) userIdLoja = sUser.id;
          }
        } catch { /* sem sessão — usuário preenche manualmente */ }

        if (nomeLoja) setNome(nomeLoja);
        if (emailLoja) setRepresentanteEmail(emailLoja);
        if (cargoLoja) setRepresentanteCargo(cargoLoja);
        if (userIdLoja) setRepresentanteUserId(userIdLoja);
        setRepresentanteVeioDaSessao(veioDaSessao);
        // NUNCA preencher CPF/documento para loja
      } else {
        // Cliente: pode usar dados do próprio cliente
        const nomeInicial = participanteAtual?.nome || c?.nome || "";
        const docInicial = participanteAtual?.documento || c?.cpf_cnpj || "";
        if (nomeInicial) setNome(nomeInicial);
        if (docInicial) setDoc(maskDocAuto(docInicial));
      }

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

      // 1) Espelho em solicitacoes_assinatura ANTES do participante.
      //    O trigger trg_recalcular_status_ap altera cliente_assinado_em/status quando o participante
      //    vira 'assinado'; se atualizarmos o espelho depois, a policy anon bloqueia.
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
        if (representanteEmail) updSolic.loja_assinatura_email = representanteEmail;
        if (representanteCargo) updSolic.loja_assinatura_cargo = representanteCargo;
        updSolic.loja_ip = ip;
        updSolic.loja_user_agent = ua;
        updSolic.assinatura_loja_url = assinaturaUrl;
      }
      const { error: errSolic } = await supabase.from("solicitacoes_assinatura").update(updSolic).eq("id", solic.id);
      if (errSolic) console.warn("[finalizar] update solicitacoes_assinatura falhou:", errSolic);

      // 2) Evidência vinculada ao participante (antes do participante mudar para 'assinado')
      const evid: any = {
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
      };
      if (!isCliente) {
        evid.aceite_texto =
          `Assinado pela loja — Representante: ${nome}` +
          (representanteEmail ? ` <${representanteEmail}>` : "") +
          (representanteCargo ? ` — Cargo: ${representanteCargo}` : "");
      }
      const { error: errEvid } = await supabase.from("assinatura_evidencias").insert(evid);
      if (errEvid) console.warn("[finalizar] insert assinatura_evidencias falhou:", errEvid);

      // 3) Evento
      const { error: errEv } = await supabase.from("assinatura_eventos").insert({
        solicitacao_id: solic.id,
        tipo_evento: isCliente ? "cliente_assinou" : "loja_assinou",
        participante_id: participante.id,
        descricao: `${isCliente ? "Cliente" : "Loja"} assinou: ${nome}${!isCliente && representanteEmail ? ` <${representanteEmail}>` : ""}`,
        user_id: !isCliente ? representanteUserId : null,
        user_agent: ua,
      } as any);
      if (errEv) console.warn("[finalizar] insert assinatura_eventos falhou:", errEv);

      // 4) Atualiza o participante POR ÚLTIMO — o trigger SQL recalcula o status da solicitação
      const updPart: any = {
        status: "assinado",
        assinado_em: agora,
        ip,
        user_agent: ua,
        nome,
        documento: isCliente ? (doc || null) : null,
      };
      if (!isCliente) {
        if (representanteEmail) updPart.email = representanteEmail;
        if (representanteCargo) updPart.cargo = representanteCargo;
        if (representanteUserId) updPart.user_id = representanteUserId;
      }
      const { error: errPart } = await supabase
        .from("assinatura_participantes" as any)
        .update(updPart)
        .eq("id", participante.id);
      if (errPart) throw errPart;

      // 5) Regenera o PDF base do contrato com o carimbo do cliente ANTES de gerar o PDF final
      try {
        await prepararContratoParaAssinatura(
          solic.id,
          isCliente ? null : { nome, email: participante.email || "" },
          isCliente ? { url: assinaturaUrl, assinadoEm: agora, ip } : undefined
        );
      } catch (e) {
        console.error("[finalizar] regeneração do contrato falhou:", e);
      }

      // 6) Só agora dispara o PDF final (concatena o contrato regenerado + evidências)
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
            <div><span className="text-muted-foreground">Assinando como:</span> <strong>{participante?.tipo === "loja" ? "Loja (representante)" : "Cliente"}</strong></div>
            {participante?.tipo === "loja" && (
              <>
                <div><span className="text-muted-foreground">Loja:</span> {loja?.nome || "—"}</div>
                <div><span className="text-muted-foreground">Representante:</span> {nome || "(preencha abaixo)"}</div>
                <div><span className="text-muted-foreground">E-mail:</span> {representanteEmail || "(preencha abaixo)"}</div>
                {representanteCargo && (
                  <div><span className="text-muted-foreground">Cargo:</span> {representanteCargo}</div>
                )}
                <div><span className="text-muted-foreground">Cliente (referência):</span> {cliente?.nome || "—"}</div>
              </>
            )}
            {participante?.tipo === "cliente" && (
              <div><span className="text-muted-foreground">Cliente:</span> {cliente?.nome || "—"}</div>
            )}
            <div><span className="text-muted-foreground">Pedido:</span> {pedido?.codigo || "—"}</div>
            <div><span className="text-muted-foreground">Documento:</span> {solic?.file_name || tipo?.nome}</div>
          </CardContent>
        </Card>

        {participante?.tipo === "loja" && !representanteVeioDaSessao && (
          <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-xs p-3">
            Você está assinando pela loja sem sessão ativa. Preencha os dados do representante.
          </div>
        )}

        {(() => {
          const url = documentoUrl;
          const nome = documentoNome || solic?.file_name || "documento";
          const mime = (documentoMime || "").toLowerCase();
          const lower = (url || "").toLowerCase();
          const isPdf = mime.includes("pdf") || lower.includes(".pdf") || nome.toLowerCase().endsWith(".pdf");
          const isImg = mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(lower);

          if (url && isPdf) {
            return (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Documento (PDF)</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={url} target="_blank" rel="noopener noreferrer">Abrir</a>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={url} download={nome}>Baixar</a>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <object data={url} type="application/pdf" className="w-full h-[70vh] rounded border bg-background">
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Não foi possível exibir o PDF aqui.{" "}
                      <a className="text-primary underline" href={url} target="_blank" rel="noopener noreferrer">Abrir</a> ou{" "}
                      <a className="text-primary underline" href={url} download={nome}>baixar</a>.
                    </div>
                  </object>
                </CardContent>
              </Card>
            );
          }

          if (url && isImg) {
            return (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Documento (imagem)</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={url} target="_blank" rel="noopener noreferrer">Abrir</a>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={url} download={nome}>Baixar</a>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <img src={url} alt={nome} className="w-full max-h-[70vh] object-contain rounded border bg-background" />
                </CardContent>
              </Card>
            );
          }

          if (url) {
            return (
              <Card>
                <CardHeader><CardTitle className="text-sm">Documento</CardTitle></CardHeader>
                <CardContent className="flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">Abrir documento</a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={url} download={nome}>Baixar</a>
                  </Button>
                </CardContent>
              </Card>
            );
          }

          if (docHtml) {
            return (
              <Card>
                <CardHeader><CardTitle className="text-sm">Documento</CardTitle></CardHeader>
                <CardContent>
                  <div
                    className="prose prose-sm max-w-none bg-background p-4 rounded border max-h-[60vh] overflow-auto"
                    dangerouslySetInnerHTML={{ __html: docHtml }}
                  />
                </CardContent>
              </Card>
            );
          }

          return (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Documento não carregado. Solicite um novo link à loja antes de assinar.
              </CardContent>
            </Card>
          );
        })()}


        <Card>
          <CardHeader><CardTitle className="text-sm">Identificação</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                readOnly={!isCliente && representanteVeioDaSessao && !!nome}
              />
            </div>
            {!isCliente && (
              <>
                <div>
                  <Label>E-mail do representante</Label>
                  <Input
                    type="email"
                    value={representanteEmail}
                    onChange={(e) => setRepresentanteEmail(e.target.value)}
                    readOnly={representanteVeioDaSessao && !!representanteEmail}
                    placeholder="email@empresa.com"
                  />
                </div>
                {representanteCargo && (
                  <div>
                    <Label>Cargo</Label>
                    <Input value={representanteCargo} readOnly />
                  </div>
                )}
              </>
            )}
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
          <Button
            className="w-full"
            size="lg"
            disabled={enviando || (!documentoUrl && !docHtml)}
            onClick={finalizar}
            title={!documentoUrl && !docHtml ? "Documento não carregado" : undefined}
          >
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
