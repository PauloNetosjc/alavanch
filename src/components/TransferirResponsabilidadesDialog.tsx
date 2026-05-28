import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowRightLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Profile = { user_id: string; nome_completo: string | null; ativo: boolean };

export function TransferirResponsabilidadesDialog({
  open, onOpenChange, usuarioAntigo, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  usuarioAntigo: { user_id: string; nome_completo: string | null } | null;
  onDone?: () => void;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [novoId, setNovoId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState({
    pedidos: true, tarefas: true, chamados: true,
    agenda: true, kanban: true, clientes: false,
  });

  useEffect(() => {
    if (!open) return;
    setNovoId(""); setMotivo("");
    setOpts({ pedidos: true, tarefas: true, chamados: true, agenda: true, kanban: true, clientes: false });
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, nome_completo, ativo")
        .eq("ativo", true)
        .order("nome_completo");
      setProfiles(((data as any) || []).filter((p: Profile) => p.user_id !== usuarioAntigo?.user_id));
    })();
  }, [open, usuarioAntigo?.user_id]);

  const confirmar = async () => {
    if (!usuarioAntigo) return;
    if (!novoId) return toast.error("Selecione o novo responsável");
    if (!motivo.trim()) return toast.error("Motivo é obrigatório");
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("transferir_responsabilidades_usuario" as any, {
        p_usuario_antigo: usuarioAntigo.user_id,
        p_usuario_novo: novoId,
        p_transferir_pedidos: opts.pedidos,
        p_transferir_tarefas: opts.tarefas,
        p_transferir_chamados: opts.chamados,
        p_transferir_agenda: opts.agenda,
        p_transferir_kanban: opts.kanban,
        p_transferir_clientes: opts.clientes,
        p_motivo: motivo.trim(),
      });
      if (error) throw error;
      const c = (data as Record<string, number>) || {};
      const resumo = Object.entries(c).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(" · ");
      toast.success("Responsabilidades transferidas e usuário desativado", { description: resumo || "Nenhum item para transferir" });
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e.message || "Falha ao transferir");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            Transferir responsabilidades antes de desativar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-[13px] p-2 rounded bg-muted/40 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-600" />
            <div>
              Usuário a desativar: <strong>{usuarioAntigo?.nome_completo || "—"}</strong>.
              O histórico será preservado; apenas itens em aberto serão transferidos.
            </div>
          </div>

          <div>
            <Label>Novo responsável</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-[13px]"
              value={novoId}
              onChange={(e) => setNovoId(e.target.value)}
            >
              <option value="">— Selecionar —</option>
              {profiles.map(p => (
                <option key={p.user_id} value={p.user_id}>{p.nome_completo || p.user_id}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[13px]">
            {([
              ["pedidos", "Pedidos / orçamentos"],
              ["tarefas", "Tarefas nativas"],
              ["chamados", "Chamados / assistências"],
              ["agenda", "Agenda futura"],
              ["kanban", "Cards de Kanban / leads"],
              ["clientes", "Carteira de clientes"],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={(opts as any)[k]} onCheckedChange={(v) => setOpts(o => ({ ...o, [k]: !!v }))} />
                {label}
              </label>
            ))}
          </div>

          <div>
            <Label>Motivo <span className="text-destructive">*</span></Label>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: desligamento, transferência de loja…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={confirmar} disabled={busy}>
            {busy ? "Transferindo…" : "Transferir e desativar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
