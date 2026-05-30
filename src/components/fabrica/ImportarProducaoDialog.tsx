import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadArquivoFabrica } from "@/lib/fabrica/arquivos";
import {
  importarPlanilhaFabricacao,
  importarPlanilhaAlmoxarifado,
  lerPlanilha,
} from "@/lib/fabrica/importProducao";

const SLOTS: Array<{ key: string; label: string; obrigatorio: boolean; estruturado?: "fab" | "alm" }> = [
  { key: "relatorio_fabricacao_modulo", label: "Relatório de fabricação por módulo (obrigatório)", obrigatorio: true, estruturado: "fab" },
  { key: "relatorio_almoxarifado", label: "Relatório de almoxarifado (obrigatório)", obrigatorio: true, estruturado: "alm" },
  { key: "cut_pro", label: "Arquivo Cut Pro (opcional)", obrigatorio: false },
  { key: "cnc_nesting", label: "Arquivo CNC / Nesting (opcional)", obrigatorio: false },
  { key: "promob", label: "Arquivo Promob (opcional)", obrigatorio: false },
  { key: "outro", label: "Outro anexo (opcional)", obrigatorio: false },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedidoId: string;
  pedidoCodigo?: string | null;
  onConcluido?: () => void;
}

export function ImportarProducaoDialog({ open, onOpenChange, pedidoId, pedidoCodigo, onConcluido }: Props) {
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  function pushLog(s: string) {
    setLog((l) => [...l, s]);
  }

  async function handleEnviar() {
    const obrigatoriosOk = SLOTS.filter((s) => s.obrigatorio).every((s) => !!files[s.key]);
    if (!obrigatoriosOk) {
      toast.error("Anexe os arquivos obrigatórios antes de importar.");
      return;
    }
    setLoading(true);
    setLog([]);
    try {
      for (const slot of SLOTS) {
        const f = files[slot.key];
        if (!f) continue;
        pushLog(`Enviando ${slot.label}…`);
        await uploadArquivoFabrica(pedidoId, f, slot.key, slot.obrigatorio);
        // se for planilha estruturada, processar
        const isPlan = /\.(xlsx|xls|csv)$/i.test(f.name);
        if (isPlan && slot.estruturado) {
          pushLog(`Processando planilha (${f.name})…`);
          const rows = await lerPlanilha(f);
          const res =
            slot.estruturado === "fab"
              ? await importarPlanilhaFabricacao(pedidoId, rows)
              : await importarPlanilhaAlmoxarifado(pedidoId, rows);
          pushLog(
            `→ módulos: ${res.modulosCriados} · peças: ${res.pecasCriadas} · almoxarifado: ${res.itensAlmoxarifado}`,
          );
          if (res.erros.length) {
            res.erros.slice(0, 5).forEach((e) => pushLog(`  ⚠ ${e}`));
            if (res.erros.length > 5) pushLog(`  …+${res.erros.length - 5} avisos`);
          }
        }
      }
      // atualizar status do pedido
      await (supabase as any)
        .from("pedidos")
        .update({ status_fabrica: "arquivos_importados" })
        .eq("id", pedidoId);
      pushLog("Status atualizado para 'arquivos_importados'.");
      toast.success("Arquivos importados com sucesso.");
      onConcluido?.();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao importar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar produção {pedidoCodigo ? `· ${pedidoCodigo}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
          {SLOTS.map((s) => (
            <Card key={s.key} className="p-3">
              <Label className="text-sm font-medium">{s.label}</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="file"
                  accept={s.estruturado ? ".xlsx,.xls,.csv,.pdf" : undefined}
                  onChange={(e) => setFiles((f) => ({ ...f, [s.key]: e.target.files?.[0] || null }))}
                  disabled={loading}
                />
                {files[s.key] && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {files[s.key]!.name}
                  </span>
                )}
              </div>
              {s.estruturado && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  XLSX/CSV estruturado será processado automaticamente. PDF é anexado como referência.
                </p>
              )}
            </Card>
          ))}

          {log.length > 0 && (
            <Card className="p-3 bg-muted/30">
              <Label className="text-xs">Progresso</Label>
              <pre className="mt-1 text-[11px] whitespace-pre-wrap leading-relaxed">{log.join("\n")}</pre>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
