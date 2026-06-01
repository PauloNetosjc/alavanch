import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { MessageCircle, Settings as SettingsIcon, MessageSquare, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WhatsappWebQrCard } from "@/components/whatsapp/WhatsappWebQrCard";
import { CloudApiCard } from "@/components/whatsapp/CloudApiCard";
import { ConversasPanel } from "@/components/whatsapp/ConversasPanel";
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
            {status?.configured ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Gateway WhatsApp configurado</span>
                {status.gateway.ok ? (
                  <Badge variant="default">online ({status.gateway.latency_ms}ms)</Badge>
                ) : (
                  <Badge variant="destructive">offline</Badge>
                )}
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Gateway WhatsApp não configurado</span>
                <Badge variant="outline">aguardando deploy</Badge>
              </>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{loading ? "Atualizando…" : "Status atualizado"}</span>
        </CardContent>
      </Card>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="conversas" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <WhatsappWebQrCard status={status} onRefresh={refresh} />
            <CloudApiCard status={status} onRefresh={refresh} />
          </div>
        </TabsContent>

        <TabsContent value="conversas">
          <ConversasPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
