import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Send, Loader2, Search, Users } from "lucide-react";
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

function formatHora(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  if (mesmoDia) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function initials(s: string) {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function ConversasPanel() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selected, setSelected] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [busca, setBusca] = useState("");
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const carregar = async () => {
    const { data } = await supabase
      .from("whatsapp_conversas")
      .select("id, wa_chat_id, titulo, is_group, ultima_mensagem_em, ultima_mensagem_preview, nao_lidas, conta_id")
      .eq("arquivado", false)
      .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
      .limit(200);
    setConversas((data ?? []) as Conversa[]);
  };

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 8000);
    return () => clearInterval(t);
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
        .limit(300);
      if (!cancel) {
        setMensagens((data ?? []) as Mensagem[]);
        setTimeout(() => scrollEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, [selected]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return conversas;
    return conversas.filter(
      (c) =>
        (c.titulo || "").toLowerCase().includes(q) ||
        c.wa_chat_id.toLowerCase().includes(q) ||
        (c.ultima_mensagem_preview || "").toLowerCase().includes(q),
    );
  }, [conversas, busca]);

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

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar conversa ou iniciar nova"
            className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <span className="shrink-0 text-xs text-muted-foreground">{filtradas.length}</span>
        </div>
        <CardContent className="p-0">
          {filtradas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8" />
              <p>{busca ? "Nenhuma conversa encontrada." : "Sem conversas ainda."}</p>
              {!busca && (
                <p className="text-xs">
                  Conecte uma conta WhatsApp Web e sincronize o histórico recente para popular esta lista.
                </p>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[560px]">
              {filtradas.map((c) => {
                const nome = c.titulo || c.wa_chat_id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left hover:bg-muted/60"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {c.is_group ? <Users className="h-5 w-5" /> : initials(nome) || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{nome}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatHora(c.ultima_mensagem_em)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {c.ultima_mensagem_preview || ""}
                        </span>
                        {c.nao_lidas > 0 && (
                          <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">{c.nao_lidas}</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="flex h-[80vh] max-h-[720px] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b bg-muted/40 px-4 py-3">
            <DialogTitle className="flex items-center gap-3 text-base">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {selected?.is_group ? <Users className="h-4 w-4" /> : initials(selected?.titulo || selected?.wa_chat_id || "?")}
              </div>
              <div className="flex flex-col items-start">
                <span className="font-medium">{selected?.titulo || selected?.wa_chat_id}</span>
                <span className="text-[11px] font-normal text-muted-foreground">{selected?.wa_chat_id}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden bg-muted/20">
            <ScrollArea className="h-full p-4">
              <div className="space-y-2">
                {mensagens.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem nesta conversa.</p>
                )}
                {mensagens.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                      m.direcao === "saida"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-background text-foreground"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {m.texto || <em className="opacity-70">[mídia]</em>}
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-70">
                      <span>{new Date(m.enviado_em).toLocaleString("pt-BR")}</span>
                      {m.origem === "whatsapp_web_history_sync" && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px]">histórico</Badge>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={scrollEndRef} />
              </div>
            </ScrollArea>
          </div>

          <div className="flex gap-2 border-t bg-background p-3">
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
        </DialogContent>
      </Dialog>
    </>
  );
}
