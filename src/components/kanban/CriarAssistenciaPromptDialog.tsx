import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wrench, AlertCircle } from "lucide-react";

const PRIO = [
  { value: "baixa", label: "Baixa", bg: "#dcfce7", fg: "#16a34a" },
  { value: "media", label: "Média", bg: "#fef3c7", fg: "#ca8a04" },
  { value: "alta", label: "Alta", bg: "#fed7aa", fg: "#ea580c" },
  { value: "urgente", label: "Urgente", bg: "#fecaca", fg: "#dc2626" },
];

export function CriarAssistenciaPromptDialog({
  open,
  onOpenChange,
  pedidoId,
  mensagem,
  onSimCriada,
  onNao,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedidoId: string | null;
  mensagem: string;
  /** Chamado após criação bem-sucedida da assistência */
  onSimCriada?: () => void;
  /** Chamado quando usuário responde "Não" */
  onNao?: () => void;
}) {
  const [step, setStep] = useState<"confirm" | "form">("confirm");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("confirm");
      setDescricao("");
      setPrioridade("media");
    }
  }, [open]);

  const handleNao = () => {
    onOpenChange(false);
    onNao?.();
  };

  const handleSim = () => setStep("form");

  const submit = async () => {
    if (!pedidoId) return toast.error("Pedido não encontrado");
    if (!descricao.trim()) return toast.error("Descreva o problema");
    setSaving(true);
    try {
      const { data: ped } = await supabase
        .from("pedidos")
        .select("cliente_id, loja_id")
        .eq("id", pedidoId)
        .maybeSingle();
      const codigo = `AT-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      const { error } = await supabase.from("assistencias").insert({
        codigo,
        cliente_id: (ped as any)?.cliente_id || null,
        pedido_id: pedidoId,
        tipo: "Garantia",
        prioridade,
        descricao,
        status: "triagem",
      } as any);
      if (error) throw error;
      try {
        const { dispatchKanbanTrigger } = await import("@/lib/kanbanTriggers");
        await dispatchKanbanTrigger("assistencia_aberta", { pedidoId });
      } catch {}
      toast.success("Assistência criada!");
      onOpenChange(false);
      onSimCriada?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar assistência");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-amber-600" />
            </div>
            <DialogTitle>
              {step === "confirm" ? "Será necessária assistência?" : "Nova Assistência"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {step === "confirm" ? (
          <>
            <div className="text-sm text-muted-foreground py-2 whitespace-pre-wrap">
              {mensagem || "Será necessário abrir um chamado de assistência para este pedido?"}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleNao}>Não</Button>
              <Button onClick={handleSim}>Sim, abrir chamado</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  Descrição do Problema
                </Label>
                <Textarea
                  rows={4}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva o problema..."
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider">Prioridade</Label>
                <div className="grid grid-cols-4 gap-2 mt-1.5">
                  {PRIO.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPrioridade(p.value)}
                      className="py-2 rounded-lg text-[12px] font-semibold transition border-2"
                      style={{
                        background: prioridade === p.value ? p.bg : "#f8fafc",
                        color: prioridade === p.value ? p.fg : "#94a3b8",
                        borderColor: prioridade === p.value ? p.fg : "transparent",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setStep("confirm")} disabled={saving}>
                Voltar
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? "Criando…" : "Criar Assistência"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
