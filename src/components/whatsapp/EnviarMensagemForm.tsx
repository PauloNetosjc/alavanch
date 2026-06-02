import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Send, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { fetchWhatsappStatus, whatsappEnviarMensagem } from "@/lib/whatsapp/api";

const schema = z.object({
  phone: z
    .string()
    .trim()
    .min(8, "Telefone muito curto")
    .max(20, "Telefone muito longo")
    .regex(/^[0-9+()\-\s]+$/, "Use apenas números"),
  message: z.string().trim().min(1, "Mensagem obrigatória").max(4000, "Mensagem muito longa"),
});

function normalizePhone(p: string) {
  return p.replace(/\D/g, "");
}

export function EnviarMensagemForm() {
  const [contaId, setContaId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchWhatsappStatus();
        const conectada = (s.contas ?? []).find((c) => c.status_conexao === "conectado");
        if (conectada) {
          setContaId(conectada.id);
          setSessionId(conectada.sessao_ref ?? null);
        }
      } catch (e) {
        console.error("[enviar-form] status", e);
      }
    })();
  }, []);

  const enviar = async () => {
    const parsed = schema.safeParse({ phone, message });
    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors;
      toast.error(errs.phone?.[0] || errs.message?.[0] || "Dados inválidos");
      return;
    }
    if (!contaId) {
      toast.error("Nenhuma conta WhatsApp conectada para esta loja");
      return;
    }
    setSending(true);
    try {
      const r = await whatsappEnviarMensagem(contaId, normalizePhone(parsed.data.phone), parsed.data.message);
      if (r.ok) {
        toast.success("Mensagem enviada com sucesso");
        setMessage("");
      } else {
        toast.error(r.erro || "Falha ao enviar mensagem");
      }
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Send className="h-4 w-4" /> Enviar mensagem
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!contaId && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            Nenhuma conta WhatsApp conectada. Conecte uma sessão em Configurações.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr]">
          <div className="space-y-1">
            <Label htmlFor="wa-phone" className="text-xs">Telefone (com DDD)</Label>
            <Input
              id="wa-phone"
              placeholder="5511999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={sending}
              maxLength={20}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa-msg" className="text-xs">Mensagem</Label>
            <Textarea
              id="wa-msg"
              placeholder="Digite a mensagem…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
              rows={3}
              maxLength={4000}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            session_id: <span className="font-mono">{sessionId ?? "—"}</span>
          </p>
          <Button onClick={enviar} disabled={sending || !contaId} size="sm">
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
