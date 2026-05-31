import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Factory, Upload, Boxes, ClipboardList, Truck, AlertTriangle, Loader2 } from "lucide-react";
import { STATUS_FABRICA_ORDEM, statusFabricaBadgeClass, statusFabricaLabel } from "@/lib/fabrica/statusFabrica";

interface Pedido {
  id: string;
  codigo: string | null;
  status_fabrica: string | null;
  valor_total: number | null;
  updated_at: string | null;
  cliente?: { nome: string | null } | null;
}

export default function PainelFabrica() {
  const { selectedLojaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  async function carregar() {
    setLoading(true);
    let q = (supabase as any)
      .from("pedidos")
      .select("id, codigo, status_fabrica, valor_total, updated_at, cliente:clientes(nome)")
      .not("status_fabrica", "is", null)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (selectedLojaId) q = q.eq("loja_id", selectedLojaId);
    const { data } = await q;
    setPedidos((data as any) || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [selectedLojaId]);

  const contagem = (s: string) => pedidos.filter((p) => p.status_fabrica === s).length;
  const valor = (s: string) => pedidos.filter((p) => p.status_fabrica === s).reduce((a, p) => a + Number(p.valor_total || 0), 0);

  const cards: Array<{ key: string; icon: any }> = [
    { key: "aguardando_arquivos", icon: Upload },
    { key: "arquivos_importados", icon: Boxes },
    { key: "aguardando_corte", icon: ClipboardList },
    { key: "em_corte", icon: Factory },
    { key: "aguardando_conferencia", icon: ClipboardList },
    { key: "pronto_para_expedicao", icon: Truck },
    { key: "em_expedicao", icon: Truck },
    { key: "expedido", icon: Truck },
    { key: "ocorrencia_peca_faltante", icon: AlertTriangle },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2"><Factory className="h-4 w-4" /> Painel da Fábrica</h2>
          <p className="text-xs text-muted-foreground">Visão consolidada dos pedidos em produção.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Card key={c.key} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">{statusFabricaLabel(c.key)}</div>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold mt-1">{contagem(c.key)}</div>
                  <div className="text-[11px] text-muted-foreground">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor(c.key))}</div>
                </Card>
              );
            })}
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b text-sm font-medium">Pedidos recentes</div>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr><th className="p-2">Pedido</th><th className="p-2">Cliente</th><th className="p-2">Status fábrica</th><th className="p-2">Atualizado</th><th className="p-2"></th></tr>
              </thead>
              <tbody>
                {pedidos.slice(0, 30).map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2 font-medium">{p.codigo || "—"}</td>
                    <td className="p-2">{p.cliente?.nome || "—"}</td>
                    <td className="p-2"><Badge variant="outline" className={statusFabricaBadgeClass(p.status_fabrica)}>{statusFabricaLabel(p.status_fabrica)}</Badge></td>
                    <td className="p-2 text-xs">{p.updated_at ? new Date(p.updated_at).toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-2 text-right"><Button size="sm" variant="outline" asChild><Link to={`/fabrica/producao?pedido=${p.id}`}>Abrir</Link></Button></td>
                  </tr>
                ))}
                {pedidos.length === 0 && <tr><td className="p-6 text-center text-muted-foreground" colSpan={5}>Nenhum pedido em produção.</td></tr>}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
