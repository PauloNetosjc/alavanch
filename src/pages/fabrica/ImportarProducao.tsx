import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Upload, Loader2 } from "lucide-react";
import { statusFabricaBadgeClass, statusFabricaLabel } from "@/lib/fabrica/statusFabrica";
import { ImportarProducaoDialog } from "@/components/fabrica/ImportarProducaoDialog";

export default function ImportarProducao() {
  const { selectedLojaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [sel, setSel] = useState<{ id: string; codigo: string | null } | null>(null);

  async function carregar() {
    setLoading(true);
    let q = (supabase as any)
      .from("pedidos")
      .select("id, codigo, status_fabrica, data_assinatura_pdf_final, valor_total, cliente:clientes(nome), loja:lojas(nome)")
      .in("status_fabrica", ["liberado_para_lote", "aguardando_arquivos", "arquivos_importados"])
      .order("data_assinatura_pdf_final", { ascending: false, nullsFirst: false })
      .limit(200);
    if (selectedLojaId) q = q.eq("loja_id", selectedLojaId);
    const { data } = await q;
    setPedidos((data as any) || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [selectedLojaId]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Importar produção</h1>
        <p className="text-sm text-muted-foreground">Anexe os relatórios obrigatórios e arquivos opcionais dos pedidos liberados para fábrica.</p>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-2">Pedido</th><th className="p-2">Cliente</th><th className="p-2">Loja</th>
                <th className="p-2">Status fábrica</th><th className="p-2">Liberação</th><th className="p-2 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-2 font-medium">{p.codigo || "—"}</td>
                  <td className="p-2">{p.cliente?.nome || "—"}</td>
                  <td className="p-2">{p.loja?.nome || "—"}</td>
                  <td className="p-2"><Badge variant="outline" className={statusFabricaBadgeClass(p.status_fabrica)}>{statusFabricaLabel(p.status_fabrica)}</Badge></td>
                  <td className="p-2 text-xs">{p.data_assinatura_pdf_final ? new Date(p.data_assinatura_pdf_final).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="p-2 text-right">
                    <Button size="sm" onClick={() => setSel({ id: p.id, codigo: p.codigo })}>
                      <Upload className="h-4 w-4 mr-1" /> Importar
                    </Button>
                  </td>
                </tr>
              ))}
              {pedidos.length === 0 && <tr><td className="p-6 text-center text-muted-foreground" colSpan={6}>Nenhum pedido liberado para fábrica.</td></tr>}
            </tbody>
          </table>
        )}
      </Card>

      <ImportarProducaoDialog
        open={!!sel}
        onOpenChange={(v) => !v && setSel(null)}
        pedidoId={sel?.id || ""}
        pedidoCodigo={sel?.codigo}
        onConcluido={carregar}
      />
    </div>
  );
}
