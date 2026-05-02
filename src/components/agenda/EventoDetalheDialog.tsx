import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, User, Package } from "lucide-react";

const TIPO_LABEL: Record<string, string> = {
  apresentacao_comercial: "Apresentação Comercial",
  medicao_tecnica: "Medição Técnica",
  revisao_final: "Revisão Final",
  entrega: "Entrega",
  montagem: "Montagem",
  assistencia_tecnica: "Assistência Técnica",
  tarefa_interna: "Tarefa Interna",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventoId: string | null;
  onChanged?: () => void;
}

export function EventoDetalheDialog({ open, onOpenChange, eventoId, onChanged }: Props) {
  const [evento, setEvento] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [pedido, setPedido] = useState<any>(null);
  const [responsavel, setResponsavel] = useState<string>("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("resumo");

  useEffect(() => {
    if (!open || !eventoId) return;
    setTab("resumo"); setPedido(null);
    (async () => {
      const { data } = await supabase.from("agenda_eventos" as any).select("*").eq("id", eventoId).maybeSingle();
      setEvento(data);
      setObs((data as any)?.descricao || "");
      if ((data as any)?.cliente_id) {
        const { data: c } = await supabase.from("clientes").select("id, nome, telefone, email").eq("id", (data as any).cliente_id).maybeSingle();
        setCliente(c);
      } else { setCliente(null); }
      if ((data as any)?.pedido_id) {
        const { data: p } = await supabase.from("pedidos")
          .select("id, codigo, status, valor_total, created_at")
          .eq("id", (data as any).pedido_id).maybeSingle();
        setPedido(p);
      }
      if ((data as any)?.responsavel_id) {
        const { data: p } = await supabase.from("profiles").select("nome_completo").eq("user_id", (data as any).responsavel_id).maybeSingle();
        setResponsavel((p as any)?.nome_completo || "—");
      }
    })();
  }, [open, eventoId]);

  if (!evento) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent><div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div></DialogContent>
      </Dialog>
    );
  }

  const salvarObs = async () => {
    setSaving(true);
    const { error } = await supabase.from("agenda_eventos" as any).update({ descricao: obs }).eq("id", evento.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Observações salvas");
    onChanged?.();
  };

  const concluir = async () => {
    await supabase.from("agenda_eventos" as any).update({ status: "concluido", concluido_em: new Date().toISOString(), descricao: obs }).eq("id", evento.id);
    // Salva no histórico do cliente
    if (cliente?.id) {
      const { data: c } = await supabase.from("clientes").select("observacoes").eq("id", cliente.id).maybeSingle();
      const dateStr = new Date(evento.data + "T00:00:00").toLocaleDateString("pt-BR");
      const tipoLbl = TIPO_LABEL[evento.tipo] || evento.tipo;
      const linha = `[${dateStr}] ${tipoLbl} — ${evento.titulo}${obs ? `: ${obs}` : ""}`;
      const novo = c?.observacoes ? `${c.observacoes}\n${linha}` : linha;
      await supabase.from("clientes").update({ observacoes: novo }).eq("id", cliente.id);
    }
    toast.success("Evento concluído e registrado no histórico do cliente"); onChanged?.(); onOpenChange(false);
  };
  const cancelar = async () => {
    await supabase.from("agenda_eventos" as any).update({ status: "cancelado", cancelado_em: new Date().toISOString() }).eq("id", evento.id);
    toast.success("Evento cancelado"); onChanged?.(); onOpenChange(false);
  };

  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {TIPO_LABEL[evento.tipo] || evento.tipo}
            <span className="text-xs px-2 py-0.5 rounded bg-muted">{evento.status}</span>
            {evento.excecao && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Exceção</span>}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            {pedido && <TabsTrigger value="pedido">Pedido</TabsTrigger>}
          </TabsList>

          <TabsContent value="resumo" className="space-y-3 text-[13px]">
            <div className="font-semibold text-base">{evento.titulo}</div>

            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div><span className="text-muted-foreground">Data:</span> <span className="capitalize">{fmtDate(evento.data)}</span></div>
              <div><span className="text-muted-foreground">Horário:</span> {evento.hora_inicio?.slice(0,5)}{evento.hora_fim ? ` – ${evento.hora_fim.slice(0,5)}` : ""}</div>
              <div className="col-span-2"><span className="text-muted-foreground">Responsável:</span> {responsavel}</div>
              {evento.endereco && <div className="col-span-2"><span className="text-muted-foreground">Endereço:</span> {evento.endereco}</div>}
            </div>

            {cliente && (
              <div className="rounded-md border p-3 bg-muted/20 text-[12px] space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-[13px]">
                    <User className="w-3.5 h-3.5" /> Cliente vinculado
                  </div>
                  <Link
                    to={`/clientes?cliente=${cliente.id}`}
                    className="text-primary text-[11px] underline font-medium"
                    onClick={() => onOpenChange(false)}
                  >
                    Abrir perfil →
                  </Link>
                </div>
                <div className="font-semibold text-[13px]">{cliente.nome}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
                  {cliente.telefone && <span>📞 {cliente.telefone}</span>}
                  {cliente.email && <span>✉ {cliente.email}</span>}
                </div>
              </div>
            )}

            <div>
              <Label>Observações / Anotações</Label>
              <Textarea rows={4} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Anote tratativas, próximos passos…" />
              <div className="flex justify-end mt-1">
                <Button size="sm" variant="outline" onClick={salvarObs} disabled={saving}>{saving ? "Salvando…" : "Salvar anotações"}</Button>
              </div>
            </div>
          </TabsContent>

          {pedido && (
            <TabsContent value="pedido" className="space-y-3 text-[13px]">
              <div className="rounded-md border p-3 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-[13px]">
                    <Package className="w-3.5 h-3.5" /> Pedido vinculado
                  </div>
                  <Link
                    to={`/pedidos/${pedido.id}`}
                    className="text-primary text-[11px] underline font-medium"
                    onClick={() => onOpenChange(false)}
                  >
                    Abrir pedido →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div><span className="text-muted-foreground">Código:</span> <span className="font-semibold">{pedido.codigo || pedido.id.slice(0,8)}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> {pedido.status || "—"}</div>
                  {pedido.valor_total != null && (
                    <div><span className="text-muted-foreground">Valor:</span> {Number(pedido.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                  )}
                  {pedido.created_at && (
                    <div><span className="text-muted-foreground">Aberto em:</span> {new Date(pedido.created_at).toLocaleDateString("pt-BR")}</div>
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter className="gap-2">
          {evento.status === "agendado" && (
            <>
              <Button variant="outline" onClick={cancelar}><XCircle className="w-4 h-4 mr-1" /> Cancelar</Button>
              <Button onClick={concluir}><CheckCircle2 className="w-4 h-4 mr-1" /> Concluir</Button>
            </>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
