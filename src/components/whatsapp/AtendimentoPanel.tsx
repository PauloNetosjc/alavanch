import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Send,
  Loader2,
  Search,
  Users,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { whatsappEnviarMensagem, fetchWhatsappStatus, type WhatsappStatusResponse } from "@/lib/whatsapp/api";

type Conversa = {
  id: string;
  wa_chat_id: string;
  titulo: string | null;
  is_group: boolean;
  ultima_mensagem_em: string | null;
  ultima_mensagem_preview: string | null;
  nao_lidas: number;
  conta_id: string;
  loja_id: string;
};

type Mensagem = {
  id: string;
  texto: string | null;
  direcao: "entrada" | "saida";
  enviado_em: string;
  origem: string;
  status: string | null;
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

function normalizePhoneBR(raw: string) {
  let digits = (raw || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (!digits.startsWith("55")) digits = "55" + digits;
  return digits;
}

function phoneFromChatId(chatId: string) {
  return chatId.split("@")[0] || chatId;
}

export function AtendimentoPanel() {
  const [status, setStatus] = useState<WhatsappStatusResponse | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [busca, setBusca] = useState("");
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [criando, setCriando] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const contaConectada = useMemo(
    () => (status?.contas ?? []).find((c) => c.status_conexao === "conectado") ?? null,
    [status],
  );
  const selected = useMemo(
    () => conversas.find((c) => c.id === selectedId) ?? null,
    [conversas, selectedId],
  );

  const refreshStatus = async () => {
    try {
      setStatus(await fetchWhatsappStatus());
    } catch (e) {
      console.error("[atendimento status]", e);
    }
  };

  const carregarConversas = async () => {
    setLoadingConv(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_conversas")
        .select("id, wa_chat_id, titulo, is_group, ultima_mensagem_em, ultima_mensagem_preview, nao_lidas, conta_id, loja_id")
        .eq("arquivado", false)
        .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
        .limit(300);
      if (error) throw error;
      setConversas((data ?? []) as Conversa[]);
    } finally {
      setLoadingConv(false);
    }
  };

  const carregarMensagens = async (conversaId: string) => {
    setLoadingMsgs(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_mensagens")
        .select("id, texto, direcao, enviado_em, origem, status")
        .eq("conversa_id", conversaId)
        .order("enviado_em", { ascending: true })
        .limit(500);
      if (error) throw error;
      setMensagens((data ?? []) as Mensagem[]);
      setTimeout(() => scrollEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } finally {
      setLoadingMsgs(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    carregarConversas();
  }, []);

  // Realtime conversas
  useEffect(() => {
    const ch = supabase
      .channel("wa-conversas-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversas" },
        () => carregarConversas(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Realtime mensagens da conversa selecionada
  useEffect(() => {
    if (!selectedId) {
      setMensagens([]);
      return;
    }
    carregarMensagens(selectedId);
    const ch = supabase
      .channel(`wa-msgs-${selectedId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_mensagens", filter: `conversa_id=eq.${selectedId}` },
        () => carregarMensagens(selectedId),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [selectedId]);

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
    if (!selected) return;
    const texto = novaMsg.trim();
    if (!texto) return;
    if (!contaConectada || contaConectada.id !== selected.conta_id) {
      toast.error("WhatsApp não conectado. Conecte o WhatsApp para enviar mensagens.");
      return;
    }
    if (!contaConectada.sessao_ref) {
      toast.error("Sessão WhatsApp ausente (session_id). Gere um novo QR Code.");
      return;
    }
    setSending(true);
    try {
      const phone = phoneFromChatId(selected.wa_chat_id);
      const r = await whatsappEnviarMensagem(selected.conta_id, phone, texto);
      if (!r.ok) {
        toast.error(r.erro || "Falha ao enviar");
        return;
      }
      // Atualiza conversa
      await supabase
        .from("whatsapp_conversas")
        .update({
          ultima_mensagem_em: new Date().toISOString(),
          ultima_mensagem_preview: texto.slice(0, 200),
        })
        .eq("id", selected.id);
      setNovaMsg("");
      carregarMensagens(selected.id);
      carregarConversas();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSending(false);
    }
  };

  const criarConversa = async () => {
    const tel = normalizePhoneBR(novoTelefone);
    if (!tel) {
      toast.error("Telefone obrigatório");
      return;
    }
    if (!contaConectada) {
      toast.error("Conecte uma conta WhatsApp antes de criar uma conversa.");
      return;
    }
    setCriando(true);
    try {
      const waChatId = `${tel}@s.whatsapp.net`;
      const { data: existente } = await supabase
        .from("whatsapp_conversas")
        .select("id")
        .eq("conta_id", contaConectada.id)
        .eq("wa_chat_id", waChatId)
        .maybeSingle();

      let conversaId = existente?.id as string | undefined;
      if (!conversaId) {
        const { data: nova, error } = await supabase
          .from("whatsapp_conversas")
          .insert({
            conta_id: contaConectada.id,
            loja_id: contaConectada.loja_id,
            wa_chat_id: waChatId,
            titulo: novoNome.trim() || null,
            is_group: false,
          })
          .select("id")
          .single();
        if (error) throw error;
        conversaId = nova.id;
      }
      await carregarConversas();
      setSelectedId(conversaId!);
      setNovaOpen(false);
      setNovoNome("");
      setNovoTelefone("");
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setCriando(false);
    }
  };

  const podeEnviar =
    !!selected &&
    !!contaConectada &&
    contaConectada.id === selected.conta_id &&
    !!contaConectada.sessao_ref;

  return (
    <Card className="grid h-[78vh] grid-cols-[340px_1fr] overflow-hidden">
      {/* Coluna esquerda */}
      <div className="flex h-full flex-col border-r">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar conversa"
            className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => {
              carregarConversas();
              refreshStatus();
            }}
            title="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${loadingConv ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="border-b px-3 py-2">
          <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => setNovaOpen(true)}>
            <Plus className="h-4 w-4" /> Nova conversa
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {filtradas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8" />
              <p className="text-sm">{busca ? "Nenhuma conversa encontrada." : "Sem conversas ainda."}</p>
            </div>
          ) : (
            filtradas.map((c) => {
              const nome = c.titulo || phoneFromChatId(c.wa_chat_id);
              const ativo = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors ${
                    ativo ? "bg-muted" : "hover:bg-muted/60"
                  }`}
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
                        {c.ultima_mensagem_preview || phoneFromChatId(c.wa_chat_id)}
                      </span>
                      {c.nao_lidas > 0 && (
                        <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">{c.nao_lidas}</Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* Área direita */}
      <div className="flex h-full flex-col bg-muted/10">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 opacity-50" />
            <p className="text-sm">Selecione uma conversa para iniciar o atendimento.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {selected.is_group ? <Users className="h-4 w-4" /> : initials(selected.titulo || phoneFromChatId(selected.wa_chat_id))}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{selected.titulo || phoneFromChatId(selected.wa_chat_id)}</span>
                  <span className="text-[11px] text-muted-foreground">{phoneFromChatId(selected.wa_chat_id)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {contaConectada && contaConectada.id === selected.conta_id ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-emerald-600">Conectado</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-600">Desconectado</span>
                  </>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {loadingMsgs && mensagens.length === 0 ? (
                <div className="flex justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : mensagens.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma mensagem nesta conversa.</p>
              ) : (
                <div className="space-y-2">
                  {mensagens.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                        m.direcao === "saida"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-background text-foreground border"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">
                        {m.texto || <em className="opacity-70">[mídia]</em>}
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-70">
                        <span>
                          {new Date(m.enviado_em).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {m.origem === "whatsapp_web_history_sync" && (
                          <Badge variant="outline" className="h-4 px-1 text-[9px]">histórico</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={scrollEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="border-t bg-background p-3">
              {!podeEnviar && (
                <div className="mb-2 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  WhatsApp não conectado. Conecte o WhatsApp para enviar mensagens.
                </div>
              )}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Digite uma mensagem…"
                  value={novaMsg}
                  onChange={(e) => setNovaMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar();
                    }
                  }}
                  disabled={sending || !podeEnviar}
                  rows={2}
                  className="min-h-[44px] resize-none"
                />
                <Button onClick={enviar} disabled={sending || !novaMsg.trim() || !podeEnviar} size="icon" className="h-auto">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Nome (opcional)</Label>
              <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: João Silva" />
            </div>
            <div className="space-y-1">
              <Label>Telefone *</Label>
              <Input
                value={novoTelefone}
                onChange={(e) => setNovoTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
              <p className="text-[11px] text-muted-foreground">
                DDI 55 será adicionado automaticamente se ausente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaOpen(false)} disabled={criando}>
              Cancelar
            </Button>
            <Button onClick={criarConversa} disabled={criando || !novoTelefone.trim()}>
              {criando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
