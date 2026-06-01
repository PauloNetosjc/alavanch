import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { whatsappEnviarMensagem } from "@/lib/whatsapp/api";
import { ScrollArea } from "@/components/ui/scroll-area";

type Conversa = {
  id: string;
  wa_chat_id: string;
  titulo: string | null;
  is_group: boolean;
  ultima_mensagem_em: string | null;
  ultima_mensagem_preview: string | null;
  nao_lidas: number;
  conta_id: string;
};

type Mensagem = {
  id: string;
  texto: string | null;
  direcao: "entrada" | "saida";
  enviado_em: string;
  origem: string;
};

export function ConversasPanel() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selected, setSelected] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [sending, setSending] = useState(false);

  const carregar = async () => {
    const { data } = await supabase
      .from("whatsapp_conversas")
      .select("id, wa_chat_id, titulo, is_group, ultima_mensagem_em, ultima_mensagem_preview, nao_lidas, conta_id")
      .eq("arquivado", false)
      .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
      .limit(100);
    setConversas((data ?? []) as Conversa[]);
  };

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancel = false;
    const load = async () => {
      const { data } = await supabase
        .from("whatsapp_mensagens")
        .select("id, texto, direcao, enviado_em, origem")
        .eq("conversa_id", selected.id)
        .order("enviado_em", { ascending: true })
        .limit(200);
      if (!cancel) setMensagens((data ?? []) as Mensagem[]);
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, [selected]);

  const enviar = async () => {
    if (!selected || !novaMsg.trim()) return;
    setSending(true);
    try {
      const r = await whatsappEnviarMensagem(selected.conta_id, selected.wa_chat_id, novaMsg.trim());
      if (!r.ok) toast.error(r.erro || "Falha ao enviar");
      else {
        setNovaMsg("");
        toast.success("Mensagem enviada");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSending(false);
    }
  };

  if (conversas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8" />
          <p>Sem conversas ainda.</p>
          <p className="text-xs">
            Conecte uma conta WhatsApp Web e sincronize o histórico recente para popular esta lista.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
      <Card className="overflow-hidden">
        <CardHeader className="py-3"><CardTitle className="text-sm">Conversas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[480px]">
            {conversas.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={`flex w-full flex-col items-start gap-1 border-b border-border px-3 py-2 text-left text-sm hover:bg-muted ${
                  selected?.id === c.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="truncate font-medium">{c.titulo || c.wa_chat_id}</span>
                  {c.nao_lidas > 0 && <Badge variant="default" className="h-5 px-1.5 text-[10px]">{c.nao_lidas}</Badge>}
                </div>
                <span className="line-clamp-1 text-xs text-muted-foreground">{c.ultima_mensagem_preview || ""}</span>
              </button>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex h-[480px] flex-col">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-sm">{selected?.titulo || selected?.wa_chat_id || "Selecione uma conversa"}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full p-4">
            {!selected && <p className="text-sm text-muted-foreground">Selecione uma conversa à esquerda</p>}
            <div className="space-y-2">
              {mensagens.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    m.direcao === "saida"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.texto || <em className="opacity-70">[mídia]</em>}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] opacity-70">
                    <span>{new Date(m.enviado_em).toLocaleString("pt-BR")}</span>
                    {m.origem === "whatsapp_web_history_sync" && <Badge variant="outline" className="h-4 px-1 text-[9px]">histórico</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
        {selected && (
          <div className="flex gap-2 border-t p-2">
            <Input
              placeholder="Digite uma mensagem…"
              value={novaMsg}
              onChange={(e) => setNovaMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && enviar()}
              disabled={sending}
            />
            <Button onClick={enviar} disabled={sending || !novaMsg.trim()} size="icon">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
