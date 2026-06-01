import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Cloud, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import type { WhatsappStatusResponse } from "@/lib/whatsapp/api";

interface Props {
  status: WhatsappStatusResponse | null;
  onRefresh: () => void;
}

export function CloudApiCard({ status, onRefresh }: Props) {
  const { selectedLojaId } = useLoja();
  const contaCloud = (status?.contas ?? []).find((c) => c.tipo_integracao === "cloud_api");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "WhatsApp Cloud API",
    cloud_api_token: "",
    cloud_api_phone_number_id: "",
    cloud_api_business_account_id: "",
    cloud_api_webhook_verify_token: "",
  });

  const salvar = async () => {
    if (!selectedLojaId) return toast.error("Selecione uma loja");
    setSaving(true);
    const payload = { loja_id: selectedLojaId, tipo_integracao: "cloud_api" as const, ...form };
    const { error } = contaCloud
      ? await supabase.from("whatsapp_contas").update(payload).eq("id", contaCloud.id)
      : await supabase.from("whatsapp_contas").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cloud API configurada (preparado para futuro)");
    setOpen(false);
    onRefresh();
  };

  const testar = () => {
    toast.info("Teste de Cloud API estará disponível na próxima fase", {
      description: "Foco atual do MVP: WhatsApp Web QR Code.",
    });
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-muted-foreground" />
              API Oficial Meta
              <Badge variant="outline" className="ml-2">Preparado para o futuro</Badge>
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Integração oficial para produção e SaaS, usando token e webhook.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Não é o modo principal nesta fase</AlertTitle>
          <AlertDescription>
            Os campos abaixo já estão prontos para receber as credenciais da Cloud API quando você quiser ativar.
            A emissão real via Cloud API ficará para uma próxima fase.
          </AlertDescription>
        </Alert>

        {!open ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setOpen(true)} variant="outline" size="sm">
              Configurar API
            </Button>
            <Button onClick={testar} variant="outline" size="sm" disabled>
              Testar conexão
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Nome da conta</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Token permanente</Label>
              <Input
                type="password"
                value={form.cloud_api_token}
                onChange={(e) => setForm({ ...form, cloud_api_token: e.target.value })}
                placeholder="EAAxx..."
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Phone Number ID</Label>
                <Input
                  value={form.cloud_api_phone_number_id}
                  onChange={(e) => setForm({ ...form, cloud_api_phone_number_id: e.target.value })}
                />
              </div>
              <div>
                <Label>Business Account ID</Label>
                <Input
                  value={form.cloud_api_business_account_id}
                  onChange={(e) => setForm({ ...form, cloud_api_business_account_id: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Webhook verify token</Label>
              <Input
                value={form.cloud_api_webhook_verify_token}
                onChange={(e) => setForm({ ...form, cloud_api_webhook_verify_token: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={salvar} disabled={saving} size="sm">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
              <Button onClick={() => setOpen(false)} variant="ghost" size="sm">
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
