import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Loader2, ScanBarcode, Search } from "lucide-react";
import { statusFabricaBadgeClass, statusFabricaLabel } from "@/lib/fabrica/statusFabrica";
import { ConferenciaPedidoSheet } from "@/components/fabrica/ConferenciaPedidoSheet";

const STATUS_ELEGIVEIS = [
  "aguardando_conferencia",
  "em_separacao_pecas",
  "arquivos_importados",
  "corte_finalizado",
  "atelie",
];

interface Linha {
  id: string;
  codigo: string | null;
  status_fabrica: string | null;
  cliente?: { nome: string | null } | null;
  loja?: { nome: string | null } | null;
  total_pecas: number;
  conferidas: number;
  embaladas: number;
  volumes: number;
  ocorrencias: number;
}

export default function ConferenciaFabrica() {
  const { selectedLojaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    let q = (supabase as any)
      .from("pedidos")
      .select("id, codigo, status_fabrica, cliente:clientes(nome), loja:lojas(nome)")
      .in("status_fabrica", STATUS_ELEGIVEIS)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (selectedLojaId) q = q.eq("loja_id", selectedLojaId);
    const { data: peds } = await q;
    const ids = (peds || []).map((p: any) => p.id);
    if (ids.length === 0) { setLinhas([]); setLoading(false); return; }

    const [{ data: pecas }, { data: vols }] = await Promise.all([
      (supabase as any).from("fabrica_pecas").select("pedido_id, status").in("pedido_id", ids),
      (supabase as any).from("fabrica_volumes").select("pedido_id").in("pedido_id", ids),
    ]);
    const pec = pecas || []; const vol = vols || [];
    setLinhas((peds || []).map((p: any) => {
      const myPec = pec.filter((x: any) => x.pedido_id === p.id);
      return {
        ...p,
        total_pecas: myPec.length,
        conferidas: myPec.filter((x: any) => ["conferida", "aguardando_par_embalagem", "embalada"].includes(x.status)).length,
        embaladas: myPec.filter((x: any) => x.status === "embalada").length,
        volumes: vol.filter((x: any) => x.pedido_id === p.id).length,
        ocorrencias: myPec.filter((x: any) => ["faltante", "avariada", "divergente"].includes(x.status)).length,
      };
    }));
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [selectedLojaId]);

  const filtradas = linhas.filter((l) => {
    if (!busca.trim()) return true;
    const b = busca.toLowerCase();
    return (
      l.codigo?.toLowerCase().includes(b) ||
      l.cliente?.nome?.toLowerCase().includes(b) ||
      l.loja?.nome?.toLowerCase().includes(b)
    );
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ScanBarcode className="h-6 w-6" /> Conferência</h1>
          <p className="text-sm text-muted-foreground">Bipe peças, crie volumes e imprima etiquetas.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pedido, cliente, loja…" className="pl-8 w-72" />
        </div>
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
                  <th className="p-2">Status</th><th className="p-2">Peças</th><th className="p-2">Conferidas</th>
                  <th className="p-2">Embaladas</th><th className="p-2">Volumes</th><th className="p-2">Ocor.</th>
                  <th className="p-2 w-40"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2 font-medium">{p.codigo || "—"}</td>
                    <td className="p-2">{p.cliente?.nome || "—"}</td>
                    <td className="p-2">{p.loja?.nome || "—"}</td>
                    <td className="p-2"><Badge variant="outline" className={statusFabricaBadgeClass(p.status_fabrica)}>{statusFabricaLabel(p.status_fabrica)}</Badge></td>
                    <td className="p-2">{p.total_pecas}</td>
                    <td className="p-2">{p.conferidas}</td>
                    <td className="p-2 text-emerald-700 font-medium">{p.embaladas}</td>
                    <td className="p-2">{p.volumes}</td>
                    <td className="p-2 text-red-700">{p.ocorrencias || "—"}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" onClick={() => setSel(p.id)}>
                        <ScanBarcode className="h-4 w-4 mr-1" /> Iniciar conferência
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr><td className="p-6 text-center text-muted-foreground" colSpan={10}>Nenhum pedido aguardando conferência.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConferenciaPedidoSheet
        open={!!sel}
        onOpenChange={(v) => !v && setSel(null)}
        pedidoId={sel}
        onChanged={carregar}
      />
    </div>
  );
}
