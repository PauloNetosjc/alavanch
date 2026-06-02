import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, QrCode, RefreshCw, History, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import {
  whatsappGerarQr,
  whatsappDesconectar,
  whatsappSincronizarHistorico,
  whatsappPollStatus,
  type WhatsappStatusResponse,
} from "@/lib/whatsapp/api";

type Conta = WhatsappStatusResponse["contas"][number];

interface Props {
  status: WhatsappStatusResponse | null;
  onRefresh: () => void;
}

export function WhatsappWebQrCard({ status, onRefresh }: Props) {
  const { selectedLojaId } = useLoja();
  const [contaWeb, setContaWeb] = useState<Conta | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const c = (status?.contas ?? []).find((c) => c.tipo_integracao === "whatsapp_web");
    setContaWeb(c ?? null);
  }, [status]);

  // Poll via gateway enquanto aguardando QR / conectando
  useEffect(() => {
    if (!contaWeb) return;
    if (contaWeb.status_conexao !== "aguardando_qr" && contaWeb.status_conexao !== "conectando") return;
    const t = setInterval(async () => {
      try {
        const r = await whatsappPollStatus(contaWeb.id);
        if (r.qr_code) setQrImage(r.qr_code);
        if (r.status === "conectado") {
          setQrImage(null);
          onRefresh();
        }
      } catch {
        /* ignore polling errors */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [contaWeb, onRefresh]);

  const criarConta = async () => {
    if (!selectedLojaId) {
      toast.error("Selecione uma loja primeiro");
      return;
    }
    setCreating(true);
    const { data: nova, error } = await supabase
      .from("whatsapp_contas")
      .insert({
        loja_id: selectedLojaId,
        nome: "WhatsApp Web da Loja",
        tipo_integracao: "whatsapp_web",
      })
      .select("id")
      .single();
    if (error || !nova) {
      setCreating(false);
      toast.error(error?.message ?? "Falha ao criar conta");
      return;
    }
    // Já abre a sessão no gateway para receber o QR
    try {
      const r = await whatsappGerarQr(nova.id);
      if (r.ok && r.qr_code) setQrImage(r.qr_code);
      else if (!r.ok) toast.error(r.erro || "Falha ao iniciar sessão no gateway");
    } catch (e) {
      toast.error(String(e));
    }
    setCreating(false);
    toast.success("Conta WhatsApp Web criada");
    onRefresh();
  };

  const gerarQr = async () => {
    if (!contaWeb) return;
    setQrLoading(true);
    // Limpa imediatamente o QR antigo da tela — nunca reaproveitar.
    setQrImage(null);
    try {
      const r = await whatsappGerarQr(contaWeb.id);
      if (!r.ok && r.configured === false) {
        toast.error("Gateway WhatsApp não configurado", {
          description: "Publique o whatsapp-gateway e atualize WHATSAPP_GATEWAY_URL.",
        });
      } else if (!r.ok) {
        toast.error(r.erro || "Falha ao gerar QR");
      } else {
        if (r.qr_code) setQrImage(r.qr_code);
        toast.success("Nova sessão criada — escaneie o QR Code");
      }
      onRefresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setQrLoading(false);
    }
  };

  const desconectar = async () => {
    if (!contaWeb) return;
    setQrImage(null);
    await whatsappDesconectar(contaWeb.id);
    toast.success("Desconectado");
    onRefresh();
  };

  const sincronizar = async () => {
    if (!contaWeb) return;
    try {
      const r = await whatsappSincronizarHistorico(contaWeb.id);
      if (r.ok) toast.success("Sincronização iniciada");
      else toast.error(r.erro || "Falha na sincronização");
      onRefresh();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    desconectado: { label: "Desconectado", variant: "outline" },
    aguardando_qr: { label: "Aguardando QR", variant: "secondary" },
    conectando: { label: "Conectando…", variant: "secondary" },
    conectado: { label: "Conectado", variant: "default" },
    erro: { label: "Erro", variant: "destructive" },
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Conectar via WhatsApp Web
              <Badge variant="default" className="ml-2">Principal MVP</Badge>
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Conecte escaneando o QR Code. Pode sincronizar conversas recentes disponíveis no WhatsApp Web.
            </p>
          </div>
          {contaWeb && (
            <Badge variant={statusLabel[contaWeb.status_conexao]?.variant ?? "outline"}>
              {statusLabel[contaWeb.status_conexao]?.label ?? contaWeb.status_conexao}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700 dark:text-amber-400">Modo experimental / não oficial</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            WhatsApp Web pode sincronizar conversas recentes disponíveis no dispositivo vinculado, mas não garante histórico completo antigo. Para operação oficial em produção, use WhatsApp Business Cloud API.
          </AlertDescription>
        </Alert>

        {status && !status.configured && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Gateway WhatsApp não configurado</AlertTitle>
            <AlertDescription>
              O serviço <code>whatsapp-gateway</code> precisa ser publicado (Render/Railway/VPS) e os secrets <code>WHATSAPP_GATEWAY_URL</code> e <code>WHATSAPP_GATEWAY_SECRET</code> atualizados com os valores reais. As ações abaixo só funcionarão depois disso.
            </AlertDescription>
          </Alert>
        )}

        {!contaWeb ? (
          <Button onClick={criarConta} disabled={creating || !selectedLojaId} className="w-full sm:w-auto">
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar conta WhatsApp Web para esta loja
          </Button>
        ) : (
          <>
            <div className="text-sm">
              <div><strong>Conta:</strong> {contaWeb.nome}</div>
              {contaWeb.numero_conectado && <div><strong>Número:</strong> +{contaWeb.numero_conectado}</div>}
              {contaWeb.ultima_conexao_em && (
                <div className="text-muted-foreground">
                  Última conexão: {new Date(contaWeb.ultima_conexao_em).toLocaleString("pt-BR")}
                </div>
              )}
            </div>

            {qrImage && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4">
                <img src={qrImage} alt="QR Code WhatsApp" className="h-64 w-64" />
                <p className="text-xs text-muted-foreground">
                  Abra WhatsApp no celular → Aparelhos conectados → Conectar aparelho
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={gerarQr} disabled={qrLoading || !status?.configured} size="sm">
                {qrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                Gerar QR Code
              </Button>
              <Button onClick={onRefresh} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Ver status
              </Button>
              <Button onClick={sincronizar} variant="outline" size="sm" disabled={!status?.configured || contaWeb.status_conexao !== "conectado"}>
                <History className="mr-2 h-4 w-4" />
                Sincronizar histórico recente
              </Button>
              <Button onClick={desconectar} variant="destructive" size="sm" disabled={contaWeb.status_conexao === "desconectado"}>
                <LogOut className="mr-2 h-4 w-4" />
                Desconectar
              </Button>
            </div>

            {contaWeb.historico_sync_status && contaWeb.historico_sync_status !== "nao_iniciado" && (
              <div className="text-xs text-muted-foreground">
                Histórico: <Badge variant="outline">{contaWeb.historico_sync_status}</Badge>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
