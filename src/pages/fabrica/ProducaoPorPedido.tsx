import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Eye, Loader2 } from "lucide-react";
import { statusFabricaBadgeClass, statusFabricaLabel } from "@/lib/fabrica/statusFabrica";
import { ProducaoPedidoSheet } from "@/components/fabrica/ProducaoPedidoSheet";

interface Linha {
  id: string;
  codigo: string | null;
  status_fabrica: string | null;
  cliente?: { nome: string | null } | null;
  loja?: { nome: string | null } | null;
  total_modulos: number;
  total_pecas: number;
  total_almox: number;
  total_arquivos: number;
}

export default function ProducaoPorPedido() {
  const { selectedLojaId } = useLoja();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [sel, setSel] = useState<string | null>(params.get("pedido"));

  async function carregar() {
    setLoading(true);
    let q = (supabase as any)
      .from("pedidos")
      .select("id, codigo, status_fabrica, loja_id, cliente:clientes(nome), loja:lojas(nome)")
      .not("status_fabrica", "is", null)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (selectedLojaId) q = q.eq("loja_id", selectedLojaId);
    const { data: peds } = await q;
    const ids = (peds || []).map((p: any) => p.id);
    if (ids.length === 0) { setLinhas([]); setLoading(false); return; }

    const [{ data: mods }, { data: pcs }, { data: als }, { data: ars }] = await Promise.all([
      (supabase as any).from("fabrica_modulos").select("pedido_id").in("pedido_id", ids),
      (supabase as any).from("fabrica_pecas").select("pedido_id").in("pedido_id", ids),
      (supabase as any).from("fabrica_almoxarifado_itens").select("pedido_id").in("pedido_id", ids),
      (supabase as any).from("fabrica_arquivos_producao").select("pedido_id").in("pedido_id", ids),
    ]);
    const count = (arr: any[] | null, pid: string) => (arr || []).filter((x: any) => x.pedido_id === pid).length;
    setLinhas((peds || []).map((p: any) => ({
      ...p,
      total_modulos: count(mods, p.id),
      total_pecas: count(pcs, p.id),
      total_almox: count(als, p.id),
      total_arquivos: count(ars, p.id),
    })));
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [selectedLojaId]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Produção por pedido</h1>
        <p className="text-sm text-muted-foreground">Acompanhe módulos, peças, almoxarifado e arquivos de cada pedido.</p>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-2">Pedido</th><th className="p-2">Cliente</th><th className="p-2">Loja</th>
                  <th className="p-2">Status</th><th className="p-2">Módulos</th><th className="p-2">Peças</th>
                  <th className="p-2">Almox.</th><th className="p-2">Arquivos</th><th className="p-2 w-28"></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2 font-medium">{p.codigo || "—"}</td>
                    <td className="p-2">{p.cliente?.nome || "—"}</td>
                    <td className="p-2">{p.loja?.nome || "—"}</td>
                    <td className="p-2"><Badge variant="outline" className={statusFabricaBadgeClass(p.status_fabrica)}>{statusFabricaLabel(p.status_fabrica)}</Badge></td>
                    <td className="p-2">{p.total_modulos}</td>
                    <td className="p-2">{p.total_pecas}</td>
                    <td className="p-2">{p.total_almox}</td>
                    <td className="p-2">{p.total_arquivos}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => { setSel(p.id); setParams({ pedido: p.id }); }}>
                        <Eye className="h-4 w-4 mr-1" /> Ver
                      </Button>
                    </td>
                  </tr>
                ))}
                {linhas.length === 0 && <tr><td className="p-6 text-center text-muted-foreground" colSpan={9}>Nenhum pedido encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ProducaoPedidoSheet
        open={!!sel}
        onOpenChange={(v) => { if (!v) { setSel(null); setParams({}); } }}
        pedidoId={sel}
        onChanged={carregar}
      />
    </div>
  );
}
