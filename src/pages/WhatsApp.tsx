import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { MessageCircle, Settings as SettingsIcon, MessageSquare, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WhatsappWebQrCard } from "@/components/whatsapp/WhatsappWebQrCard";
import { CloudApiCard } from "@/components/whatsapp/CloudApiCard";
import { ConversasPanel } from "@/components/whatsapp/ConversasPanel";
import { EnviarMensagemForm } from "@/components/whatsapp/EnviarMensagemForm";
import { fetchWhatsappStatus, type WhatsappStatusResponse } from "@/lib/whatsapp/api";

export default function WhatsApp() {
  const [status, setStatus] = useState<WhatsappStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchWhatsappStatus();
      setStatus(s);
    } catch (e) {
      console.error("[whatsapp-status]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        icon={MessageCircle}
        title="WhatsApp"
        subtitle="Atendimento via WhatsApp Web (QR) e preparação para Cloud API oficial."
      />

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-start gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {(() => {
              const sessaoConectada = (status?.contas ?? []).some((c) => c.status_conexao === "conectado");
              if (!status?.configured) {
                return (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span>Gateway WhatsApp não configurado</span>
                    <Badge variant="outline">aguardando deploy</Badge>
                  </>
                );
              }
              return (
                <>
                  {sessaoConectada ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                  <span>Gateway WhatsApp configurado</span>
                  {sessaoConectada ? (
                    <Badge variant="default">online</Badge>
                  ) : (
                    <Badge variant="outline">offline</Badge>
                  )}
                </>
              );
            })()}
          </div>
          <span className="text-xs text-muted-foreground">{loading ? "Atualizando…" : "Status atualizado"}</span>
        </CardContent>
      </Card>

      {(() => {
        const temConectado = (status?.contas ?? []).some((c) => c.status_conexao === "conectado");
        return (
          <Tabs defaultValue="config" className="space-y-4">
            <TabsList>
              <TabsTrigger value="config" className="gap-2">
                <SettingsIcon className="h-4 w-4" />
                Configurações
              </TabsTrigger>
              <TabsTrigger value="conversas" className="gap-2" disabled={!temConectado}>
                <MessageSquare className="h-4 w-4" />
                Conversas
                {!temConectado && <Badge variant="outline" className="ml-1 text-[10px]">conecte uma conta</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <WhatsappWebQrCard status={status} onRefresh={refresh} />
                <CloudApiCard status={status} onRefresh={refresh} />
              </div>
            </TabsContent>

            <TabsContent value="conversas" className="space-y-4">
              <EnviarMensagemForm />
              <ConversasPanel />
            </TabsContent>
          </Tabs>
        );
      })()}
    </div>
  );
}
