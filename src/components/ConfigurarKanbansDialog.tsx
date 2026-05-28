import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  KANBANS_CATALOGO, KANBAN_DEFAULT_ATIVO, KanbanChave,
  useKanbansVisibilidade,
} from "@/hooks/useKanbansVisibilidade";
import { toast } from "sonner";
import { RotateCcw, KanbanSquare } from "lucide-react";

export default function ConfigurarKanbansDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { selectedLojaId } = useLoja();
  const { user } = useAuth();
  const { map: mapAtual, invalidate } = useKanbansVisibilidade();
  const [estado, setEstado] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const inicial: Record<string, boolean> = {};
      KANBANS_CATALOGO.forEach((k) => {
        inicial[k.chave] = mapAtual[k.chave] !== false;
      });
      setEstado(inicial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const ativos = Object.values(estado).filter(Boolean).length;

  function toggle(chave: KanbanChave, v: boolean) {
    setEstado((prev) => {
      const novo = { ...prev, [chave]: v };
      const totalAtivos = Object.values(novo).filter(Boolean).length;
      if (totalAtivos === 0) {
        toast.warning("É necessário manter pelo menos um kanban ativo.");
        return prev;
      }
      // CRM Comercial sempre ativo
      if (chave === "crm_comercial" && !v) {
        toast.info("O CRM Comercial não pode ser desativado.");
        return prev;
      }
      return novo;
    });
  }

  function restaurarPadrao() {
    const padrao: Record<string, boolean> = {};
    KANBANS_CATALOGO.forEach((k) => { padrao[k.chave] = KANBAN_DEFAULT_ATIVO[k.chave]; });
    padrao.crm_comercial = true;
    setEstado(padrao);
    toast.info("Padrão restaurado. Clique em Salvar para aplicar.");
  }

  async function salvar() {
    setSaving(true);
    try {
      const linhas = KANBANS_CATALOGO.map((k) => ({
        loja_id: selectedLojaId || null,
        chave_kanban: k.chave,
        nome_kanban: k.nome,
        descricao: k.descricao,
        ativo: estado[k.chave] !== false,
        atualizado_por: user?.id || null,
      }));
      const { error } = await supabase
        .from("configuracoes_kanbans" as any)
        .upsert(linhas, { onConflict: "loja_id,chave_kanban" });
      if (error) throw error;
      toast.success("Configuração de kanbans salva com sucesso.");
      invalidate();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KanbanSquare className="w-5 h-5 text-primary" /> Configuração de Kanbans
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Escolha quais kanbans ficarão visíveis no sistema. A desativação apenas oculta o kanban,
            sem apagar dados ou alterar regras internas.
          </p>
        </DialogHeader>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {KANBANS_CATALOGO.map((k) => {
            const ativo = estado[k.chave] !== false;
            const fixo = k.chave === "crm_comercial";
            return (
              <div
                key={k.chave}
                className="flex items-start justify-between gap-4 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {k.nome}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {ativo ? "Ativo" : "Inativo"}
                    </span>
                    {fixo && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Obrigatório</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{k.descricao}</p>
                  {!ativo && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      Apenas ocultado da navegação. Dados, tarefas e regras internas permanecem ativos.
                    </p>
                  )}
                </div>
                <Switch
                  checked={ativo}
                  onCheckedChange={(v) => toggle(k.chave, v)}
                  disabled={fixo}
                />
              </div>
            );
          })}
        </div>

        <div className="text-[11px] text-muted-foreground">
          {ativos} de {KANBANS_CATALOGO.length} kanbans ativos
          {selectedLojaId ? " (configuração desta loja)" : " (configuração global)"}.
        </div>

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          <Button variant="outline" type="button" onClick={restaurarPadrao}>
            <RotateCcw className="w-4 h-4" /> Restaurar padrão
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={salvar} disabled={saving}>
              {saving ? "Salvando…" : "Salvar configurações"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
