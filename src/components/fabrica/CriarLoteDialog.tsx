import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PackagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { criarLoteComPedidos } from "@/lib/lotesProducao";
import { toast } from "sonner";

type PedidoLiberado = {
  id: string;
  codigo: string | null;
  cliente_nome: string | null;
  data_limite_entrega: string | null;
  data_assinatura_pdf_final: string | null;
};

function fmt(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

export function CriarLoteDialog({
  open,
  onOpenChange,
  onCriado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCriado?: () => void;
}) {
  const { selectedLojaId } = useLoja();
  const [liberados, setLiberados] = useState<PedidoLiberado[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [descricao, setDescricao] = useState("");
  const [previsao, setPrevisao] = useState("");

  async function carregar() {
    setLoading(true);
    let q = (supabase as any)
      .from("pedidos")
      .select("id, codigo, data_limite_entrega, data_assinatura_pdf_final, cliente:clientes(nome)")
      .eq("status_fabrica", "liberado_para_lote")
      .order("data_assinatura_pdf_final", { ascending: true });
    if (selectedLojaId) q = q.eq("loja_id", selectedLojaId);
    const { data, error } = await q;
    if (error) {
      console.error(error);
      setLiberados([]);
    } else {
      setLiberados(
        (data || []).map((p: any) => ({
          id: p.id,
          codigo: p.codigo,
          cliente_nome: p.cliente?.nome ?? null,
          data_limite_entrega: p.data_limite_entrega,
          data_assinatura_pdf_final: p.data_assinatura_pdf_final,
        }))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    if (open) {
      setSelecionados(new Set());
      setDescricao("");
      setPrevisao("");
      carregar();
    }
  }, [open, selectedLojaId]);

  function toggle(id: string) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function salvar() {
    if (selecionados.size === 0) {
      toast.error("Selecione ao menos um pedido.");
      return;
    }
    setSalvando(true);
    try {
      const lote = await criarLoteComPedidos({
        lojaId: selectedLojaId,
        descricao: descricao.trim() || null,
        dataPrevisaoConclusao: previsao || null,
        pedidoIds: Array.from(selecionados),
      });
      toast.success(`Lote ${lote.numero_lote} criado com ${selecionados.size} pedido(s).`);
      onOpenChange(false);
      onCriado?.();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao criar lote: " + (e.message || ""));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-playfair flex items-center gap-2">
            <PackagePlus className="w-5 h-5" /> Criar Lote de Produção
          </DialogTitle>
          <DialogDescription>
            Selecione os pedidos liberados que farão parte deste lote.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Input id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Lote semanal 22" />
          </div>
          <div>
            <Label htmlFor="previsao">Previsão de conclusão</Label>
            <Input id="previsao" type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
          </div>
        </div>

        <div className="border rounded-md max-h-[360px] overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
            </div>
          ) : liberados.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido liberado para lote no momento.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 w-10"></th>
                  <th className="text-left px-3 py-2">PV</th>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-left px-3 py-2">Assinatura</th>
                  <th className="text-left px-3 py-2">Prazo Entrega</th>
                </tr>
              </thead>
              <tbody>
                {liberados.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => toggle(p.id)}>
                    <td className="px-3 py-2">
                      <Checkbox checked={selecionados.has(p.id)} onCheckedChange={() => toggle(p.id)} onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td className="px-3 py-2 font-medium">{p.codigo || "—"}</td>
                    <td className="px-3 py-2">{p.cliente_nome || "—"}</td>
                    <td className="px-3 py-2">{fmt(p.data_assinatura_pdf_final)}</td>
                    <td className="px-3 py-2">{fmt(p.data_limite_entrega)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || selecionados.size === 0}>
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackagePlus className="w-4 h-4 mr-2" />}
            Criar lote com {selecionados.size} pedido{selecionados.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
