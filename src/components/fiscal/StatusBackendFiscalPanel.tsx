import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Activity, RefreshCw, PlayCircle } from "lucide-react";
import { toast } from "sonner";

type StatusResp = {
  ok: boolean;
  edge_functions: string[];
  secrets: Record<string, boolean>;
  gateway: {
    configurado: boolean; ok?: boolean; httpStatus?: number;
    service?: string; env?: string; ts?: string;
    duracao_ms?: number; erro?: string; mensagem?: string;
  };
  ambiente: string;
  producao_bloqueada: boolean;
  cfg: any;
  cert: any;
  rascunho_teste: { id: string; numero: string | null; tipo: string } | null;
};

function Ind({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b last:border-0">
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5"/> : <XCircle className="w-4 h-4 text-red-600 mt-0.5"/>}
      <div className="flex-1">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <Badge variant={ok ? "secondary" : "destructive"} className="text-[10px]">{ok ? "OK" : "Pendente"}</Badge>
    </div>
  );
}

export function StatusBackendFiscalPanel() {
  const { selectedLojaId } = useLoja();
  const [data, setData] = useState<StatusResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  async function load() {
    if (!selectedLojaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiscal-status", {
        body: undefined,
        method: "GET" as any,
      } as any);
      // edge function reads loja_id from query; fallback via direct fetch:
      const sess = (await supabase.auth.getSession()).data.session;
      const proj = (supabase as any).supabaseUrl as string;
      const resp = await fetch(`${proj}/functions/v1/fiscal-status?loja_id=${selectedLojaId}`, {
        headers: { Authorization: `Bearer ${sess?.access_token ?? ""}` },
      });
      const j = await resp.json();
      setData(j);
      if (!resp.ok) toast.error(j?.error ?? "Erro ao consultar status");
      void data; void error;
    } catch (e) {
      toast.error("Falha ao consultar status fiscal");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [selectedLojaId]);

  async function testGateway() { await load(); toast.success("Healthcheck do gateway atualizado"); }

  async function testarCertificado() {
    if (!data?.cert?.id) { toast.error("Nenhum certificado A1 cadastrado."); return; }
    if (!data.cert.senha_cifrada) { toast.error("Senha do certificado ainda não foi cifrada. Reenvie o certificado."); return; }
    toast.success(`Certificado '${data.cert.nome}' ativo (validade ${data.cert.validade_fim?.slice(0,10) ?? "—"}).`);
  }

  async function testarHomologacao() {
    if (!data?.rascunho_teste) {
      toast.error("Crie uma pré-nota (NF-e em homologação, status rascunho) antes de testar.");
      return;
    }
    setTesting(true);
    try {
      const { data: out, error } = await supabase.functions.invoke("fiscal-nfe-emitir", {
        body: { nota_fiscal_id: data.rascunho_teste.id },
      });
      if (error) { toast.error(error.message ?? "Erro no teste de homologação"); return; }
      const o: any = out;
      if (o?.ok && o.status === "autorizada") toast.success(`Autorizada • protocolo ${o.protocolo}`);
      else if (o?.status === "enviada") toast.success(`Lote enviado • recibo ${o.numeroRecibo}`);
      else if (o?.status === "rejeitada") toast.error(`Rejeitada: ${o.mensagem ?? o.cStat}`);
      else toast.error(`Erro: ${o?.erro ?? o?.mensagem ?? "desconhecido"}`);
      await load();
    } finally { setTesting(false); }
  }

  if (!selectedLojaId) return <Card className="p-6 text-sm text-muted-foreground">Selecione uma loja no topo.</Card>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-display flex items-center gap-2"><Activity className="w-5 h-5"/> Status do Backend Fiscal</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1"/> : <RefreshCw className="w-4 h-4 mr-1"/>}
            Atualizar
          </Button>
        </div>
      </div>

      {loading && !data && (
        <Card className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></Card>
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card className="p-4 space-y-1">
            <h3 className="text-sm font-medium mb-2">Edge Functions e Secrets</h3>
            <Ind ok={data.edge_functions.includes("fiscal-nfe-emitir")} label="Edge Functions fiscais implantadas" hint={data.edge_functions.join(", ")}/>
            <Ind ok={!!data.secrets.FISCAL_CRYPTO_KEY} label="FISCAL_CRYPTO_KEY" hint="Cifra a senha do certificado A1 (AES-256-GCM)."/>
            <Ind ok={!!data.secrets.URL_DO_PORTAL_FISCAL} label="URL_DO_PORTAL_FISCAL" hint="URL pública do gateway mTLS (FISCAL_GATEWAY_URL)."/>
            <Ind ok={!!data.secrets.SEGREDO_DO_PORTAL_FISCAL} label="SEGREDO_DO_PORTAL_FISCAL" hint="Segredo compartilhado com o gateway (FISCAL_GATEWAY_SECRET)."/>
            <div className="text-[11px] text-muted-foreground pt-2">
              Valores nunca são exibidos. Configure em <strong>Backend → Secrets</strong>.
            </div>
          </Card>

          <Card className="p-4 space-y-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Gateway Fiscal mTLS</h3>
              <Button variant="outline" size="sm" onClick={testGateway} disabled={loading}>Testar gateway</Button>
            </div>
            <Ind ok={data.gateway.configurado} label="Gateway configurado"
              hint={data.gateway.configurado ? "URL e segredo presentes." : "Defina URL_DO_PORTAL_FISCAL e SEGREDO_DO_PORTAL_FISCAL."}/>
            <Ind ok={!!data.gateway.ok} label="Healthcheck /health"
              hint={data.gateway.ok
                ? `${data.gateway.service ?? "—"} • ${data.gateway.env ?? "—"} • ${data.gateway.duracao_ms ?? "?"}ms`
                : (data.gateway.mensagem ?? data.gateway.erro ?? "Sem resposta")}/>
            {data.gateway.httpStatus !== undefined && (
              <div className="text-[11px] text-muted-foreground">HTTP {data.gateway.httpStatus}</div>
            )}
          </Card>

          <Card className="p-4 space-y-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Configuração Fiscal e Certificado</h3>
              <Button variant="outline" size="sm" onClick={testarCertificado}>Testar certificado</Button>
            </div>
            <Ind ok={!!data.cfg?.completo} label="Configuração fiscal completa"
              hint={data.cfg?.completo ? `${data.cfg.uf} • próx. NF-e ${data.cfg.proximo_numero_nfe ?? "—"}` : "Preencha CNPJ, razão, UF, município e código IBGE."}/>
            <Ind ok={data.cert?.status === "ativo"} label="Certificado A1 ativo"
              hint={data.cert ? `${data.cert.nome} • validade ${data.cert.validade_fim?.slice(0,10) ?? "—"}` : "Nenhum certificado cadastrado."}/>
            <Ind ok={!!data.cert?.senha_cifrada} label="Senha do certificado cifrada (AES-256-GCM)"
              hint={data.cert?.senha_cifrada ? "Senha persistida cifrada." : "Reenvie o certificado para cifrar a senha."}/>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-medium">Ambiente</h3>
              <Badge variant={data.ambiente === "producao" ? "default" : "secondary"}>
                {data.ambiente === "producao" ? "Produção" : "Homologação"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
              <AlertTriangle className="w-4 h-4"/>
              <span>Emissão em produção está <strong>bloqueada</strong> nesta fase.</span>
            </div>

            <div className="pt-2 border-t mt-2 space-y-2">
              <h4 className="text-sm font-medium">Teste fiscal de homologação</h4>
              <p className="text-xs text-muted-foreground">
                Executa: configuração → certificado → montagem XML → assinatura → validação → gateway → registro de eventos.
              </p>
              {!data.rascunho_teste ? (
                <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4"/> Crie uma pré-nota antes de testar.
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground">
                  Usará a NF-e rascunho mais recente: {data.rascunho_teste.numero ?? "(sem número)"}
                </div>
              )}
              <Button onClick={testarHomologacao}
                disabled={testing || !data.rascunho_teste || !data.cert || !data.cfg?.completo || !data.gateway.ok}>
                {testing ? <Loader2 className="w-4 h-4 animate-spin mr-1"/> : <PlayCircle className="w-4 h-4 mr-1"/>}
                Executar teste fiscal de homologação
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
