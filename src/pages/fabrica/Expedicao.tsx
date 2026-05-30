import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Truck } from "lucide-react";
import { statusFabricaBadgeClass, statusFabricaLabel } from "@/lib/fabrica/statusFabrica";
import { ExpedicaoPedidoSheet } from "@/components/fabrica/ExpedicaoPedidoSheet";

interface PedidoLinha {
  id: string;
  codigo: string | null;
  status_fabrica: string | null;
  cliente?: { nome: string | null } | null;
  loja?: { nome: string | null } | null;
  total?: number;
  carregados?: number;
  pendentes?: number;
  caixas?: number;
  problemas?: number;
}

const STATUS_PERMITIDOS = [
  "pronto_para_expedicao",
  "em_expedicao",
  "expedido",
  "ocorrencia_peca_faltante",
];

export default function Expedicao() {
  const { selectedLojaId } = useLoja();
  const [pedidos, setPedidos] = useState<PedidoLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<PedidoLinha | null>(null);

  async function carregar() {
    setLoading(true);
    let q = (supabase as any)
      .from("pedidos")
      .select("id, codigo, status_fabrica, cliente:clientes(nome), loja:lojas(nome)")
      .in("status_fabrica", STATUS_PERMITIDOS)
      .order("updated_at", { ascending: false })
      .limit(300);
    if (selectedLojaId) q = q.eq("loja_id", selectedLojaId);
    const { data } = await q;
    const lista = (data || []) as PedidoLinha[];

    if (lista.length) {
      const ids = lista.map((p) => p.id);
      const { data: vols } = await (supabase as any)
        .from("fabrica_volumes")
        .select("pedido_id, status, tipo_volume, problema_expedicao")
        .in("pedido_id", ids)
        .neq("status", "cancelado");
      const map: Record<string, { total: number; carregados: number; caixas: number; problemas: number }> = {};
      (vols || []).forEach((v: any) => {
        const m = (map[v.pedido_id] ||= { total: 0, carregados: 0, caixas: 0, problemas: 0 });
        m.total++;
        if (v.status === "carregado") m.carregados++;
        if (v.tipo_volume === "caixa_almoxarifado") m.caixas++;
        if (v.problema_expedicao) m.problemas++;
      });
      lista.forEach((p) => {
        const m = map[p.id] || { total: 0, carregados: 0, caixas: 0, problemas: 0 };
        p.total = m.total;
        p.carregados = m.carregados;
        p.pendentes = m.total - m.carregados;
        p.caixas = m.caixas;
        p.problemas = m.problemas;
      });
    }
    setPedidos(lista);
    setLoading(false);
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [selectedLojaId]);

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center gap-3">
        <Truck className="h-5 w-5 text-amber-700" />
        <div className="flex-1">
          <div className="font-semibold">Expedição por volumes</div>
          <div className="text-xs text-muted-foreground">Bipe cada volume/caixa para conferir o carregamento. Só finaliza quando 100% estiver carregado.</div>
        </div>
        <Button variant="outline" size="sm" onClick={carregar}>Atualizar</Button>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : pedidos.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum pedido para expedição.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Carregados</TableHead>
                <TableHead className="text-center">Pendentes</TableHead>
                <TableHead className="text-center">Caixas</TableHead>
                <TableHead className="text-center">Problemas</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.codigo || p.id.slice(0, 8)}</TableCell>
                  <TableCell>{p.cliente?.nome || "—"}</TableCell>
                  <TableCell>{p.loja?.nome || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusFabricaBadgeClass(p.status_fabrica)}>
                      {statusFabricaLabel(p.status_fabrica)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{p.total ?? 0}</TableCell>
                  <TableCell className="text-center text-emerald-700 font-semibold">{p.carregados ?? 0}</TableCell>
                  <TableCell className="text-center text-amber-700 font-semibold">{p.pendentes ?? 0}</TableCell>
                  <TableCell className="text-center">{p.caixas ?? 0}</TableCell>
                  <TableCell className="text-center text-red-700">{p.problemas ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => setAberto(p)}>
                      {p.status_fabrica === "expedido" ? "Consultar" : "Iniciar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ExpedicaoPedidoSheet
        open={!!aberto}
        onOpenChange={(v) => !v && setAberto(null)}
        pedido={aberto}
        onChanged={carregar}
      />
    </div>
  );
}
