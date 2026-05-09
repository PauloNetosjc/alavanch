import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Estagio = { id: string; nome: string; ordem: number; pipeline: string };

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cardId: string;
  pedidoId: string | null;
  pipeline: string;
  estagios: { id: string; nome: string; ordem: number }[];
  estagioAtualId: string;
  onDone: () => void;
};

type Acao = "remover" | "proxima" | "outro_kanban";

const PIPELINES: { value: string; label: string }[] = [
  { value: "operacional", label: "Operacional" },
  { value: "pos_venda", label: "Pós-Venda e Financeiro" },
  { value: "revisao", label: "Revisão de Projeto" },
  { value: "montagem", label: "Montagem" },
  { value: "fabrica", label: "Fábrica" },
];

export function ConcluirCardDialog({
  open, onOpenChange, cardId, pedidoId, pipeline, estagios, estagioAtualId, onDone,
}: Props) {
  const [acao, setAcao] = useState<Acao>("proxima");
  const [destPipeline, setDestPipeline] = useState<string>("");
  const [destEstagios, setDestEstagios] = useState<Estagio[]>([]);
  const [destEstagioId, setDestEstagioId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const proxEstagio = useMemo(() => {
    const cur = estagios.find((e) => e.id === estagioAtualId);
    if (!cur) return null;
    const ordenados = [...estagios].sort((a, b) => a.ordem - b.ordem);
    const idx = ordenados.findIndex((e) => e.id === cur.id);
    return idx >= 0 && idx < ordenados.length - 1 ? ordenados[idx + 1] : null;
  }, [estagios, estagioAtualId]);

  useEffect(() => {
    if (!open) {
      setAcao("proxima");
      setDestPipeline("");
      setDestEstagios([]);
      setDestEstagioId("");
    }
  }, [open]);

  useEffect(() => {
    if (!destPipeline) { setDestEstagios([]); setDestEstagioId(""); return; }
    (async () => {
      const { data } = await (supabase as any).from("pipeline_estagios")
        .select("id,nome,ordem,pipeline")
        .eq("pipeline", destPipeline).eq("ativo", true).order("ordem");
      setDestEstagios((data ?? []) as Estagio[]);
      setDestEstagioId("");
    })();
  }, [destPipeline]);

  const log = async (tipo: string, descricao: string, metadata: Record<string, any>) => {
    if (!pedidoId) return;
    try {
      const { data: u } = await supabase.auth.getUser();
      await (supabase as any).from("timeline_eventos").insert({
        entidade_tipo: "pedido", entidade_id: pedidoId, tipo, descricao,
        usuario_id: u.user?.id ?? null, metadata,
      });
    } catch (e) { console.error(e); }
  };

  const confirmar = async () => {
    setBusy(true);
    try {
      if (acao === "remover") {
        const { error } = await (supabase as any).from("kanban_cards").delete().eq("id", cardId);
        if (error) throw error;
        await log("kanban_removido", `[${pipeline}] Card removido do kanban (pedido preservado)`, { pipeline, card_id: cardId });
        toast.success("Card removido do kanban");
      } else if (acao === "proxima") {
        if (!proxEstagio) throw new Error("Não há próxima etapa");
        const { error } = await (supabase as any).from("kanban_cards")
          .update({ estagio_id: proxEstagio.id, iniciado_em: new Date().toISOString(), notificacao_atraso_em: null })
          .eq("id", cardId);
        if (error) throw error;
        await log("kanban_movimento", `[${pipeline}] Avançou para "${proxEstagio.nome}"`, { pipeline, para: proxEstagio.nome, card_id: cardId });
        toast.success(`Card movido para "${proxEstagio.nome}"`);
      } else {
        if (!destPipeline || !destEstagioId) throw new Error("Selecione kanban e estágio de destino");
        if (!pedidoId) throw new Error("Card sem pedido vinculado");
        // Verifica se já existe card desse pedido no pipeline destino
        const { data: existente } = await (supabase as any).from("kanban_cards")
          .select("id").eq("pipeline", destPipeline).eq("pedido_id", pedidoId).maybeSingle();
        if (existente?.id) {
          const { error } = await (supabase as any).from("kanban_cards")
            .update({ estagio_id: destEstagioId, iniciado_em: new Date().toISOString(), notificacao_atraso_em: null })
            .eq("id", existente.id);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any).from("kanban_cards").insert({
            pipeline: destPipeline, pedido_id: pedidoId, estagio_id: destEstagioId,
            iniciado_em: new Date().toISOString(),
          });
          if (error) throw error;
        }
        // Remove o card do pipeline atual
        await (supabase as any).from("kanban_cards").delete().eq("id", cardId);
        const destLbl = PIPELINES.find((p) => p.value === destPipeline)?.label ?? destPipeline;
        const estLbl = destEstagios.find((e) => e.id === destEstagioId)?.nome ?? "—";
        await log("kanban_transferido", `[${pipeline}] → [${destPipeline}] estágio "${estLbl}"`,
          { de_pipeline: pipeline, para_pipeline: destPipeline, para_estagio: estLbl, card_id: cardId });
        toast.success(`Card enviado para ${destLbl}`);
      }
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao concluir card");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Concluir card</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={acao} onValueChange={(v) => setAcao(v as Acao)} className="space-y-2">
            <label className="flex items-start gap-2 p-3 border rounded-md cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="proxima" id="a-prox" className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">Mover para a próxima etapa</div>
                <div className="text-xs text-muted-foreground">
                  {proxEstagio ? `Avança para "${proxEstagio.nome}"` : "Sem próxima etapa neste kanban"}
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2 p-3 border rounded-md cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="outro_kanban" id="a-outro" className="mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Enviar para outro kanban</div>
                <div className="text-xs text-muted-foreground">Escolha o kanban e o estágio de destino</div>
              </div>
            </label>

            <label className="flex items-start gap-2 p-3 border rounded-md cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="remover" id="a-rem" className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">Remover do kanban</div>
                <div className="text-xs text-muted-foreground">Remove o card sem eliminar dados do pedido</div>
              </div>
            </label>
          </RadioGroup>

          {acao === "outro_kanban" && (
            <div className="space-y-3 pl-1">
              <div>
                <Label className="text-xs">Kanban de destino</Label>
                <Select value={destPipeline} onValueChange={setDestPipeline}>
                  <SelectTrigger><SelectValue placeholder="Selecionar kanban" /></SelectTrigger>
                  <SelectContent>
                    {PIPELINES.filter((p) => p.value !== pipeline).map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Estágio de destino</Label>
                <Select value={destEstagioId} onValueChange={setDestEstagioId} disabled={!destEstagios.length}>
                  <SelectTrigger><SelectValue placeholder="Selecionar estágio" /></SelectTrigger>
                  <SelectContent>
                    {destEstagios.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button
            onClick={confirmar}
            disabled={
              busy ||
              (acao === "proxima" && !proxEstagio) ||
              (acao === "outro_kanban" && (!destPipeline || !destEstagioId))
            }
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
