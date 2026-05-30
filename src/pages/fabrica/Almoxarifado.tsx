import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ScanBarcode, PackageOpen } from "lucide-react";
import { statusFabricaBadgeClass, statusFabricaLabel } from "@/lib/fabrica/statusFabrica";
import { AlmoxarifadoPedidoSheet } from "@/components/fabrica/AlmoxarifadoPedidoSheet";

interface PedidoLinha {
  id: string;
  codigo: string | null;
  status_fabrica: string | null;
  cliente?: { nome: string | null } | null;
  loja?: { nome: string | null } | null;
  total_itens?: number;
  separados?: number;
  pendentes?: number;
  faltantes?: number;
  caixas?: number;
}

const STATUS_PERMITIDOS = [
  "arquivos_importados",
  "aguardando_almoxarifado",
  "em_separacao_almoxarifado",
  "aguardando_conferencia",
  "em_separacao_pecas",
  "pronto_para_expedicao",
  "ocorrencia_peca_faltante",
];

export default function Almoxarifado() {
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
      const [itensRes, caixasRes] = await Promise.all([
        (supabase as any).from("fabrica_almoxarifado_itens").select("pedido_id, status").in("pedido_id", ids),
        (supabase as any).from("fabrica_volumes").select("pedido_id, status").in("pedido_id", ids).eq("tipo_volume", "caixa_almoxarifado"),
      ]);
      const itens = itensRes.data || [];
      const caixas = caixasRes.data || [];
      lista.forEach((p) => {
        const meus = itens.filter((i: any) => i.pedido_id === p.id);
        p.total_itens = meus.length;
        p.separados = meus.filter((i: any) => i.status === "separado_completo").length;
        p.faltantes = meus.filter((i: any) => i.status === "faltante").length;
        p.pendentes = meus.filter((i: any) => i.status === "pendente" || i.status === "separado_parcial").length;
        p.caixas = caixas.filter((c: any) => c.pedido_id === p.id && c.status !== "cancelado").length;
      });
    }
    setPedidos(lista);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [selectedLojaId]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PackageOpen className="h-4 w-4" /> Pedidos aguardando separação de almoxarifado
          </div>
          <Button variant="outline" size="sm" onClick={carregar}>Atualizar</Button>
        </div>
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : pedidos.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum pedido na fila do almoxarifado.</div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Status fábrica</TableHead>
                  <TableHead className="text-center">Itens</TableHead>
                  <TableHead className="text-center">Separados</TableHead>
                  <TableHead className="text-center">Pendentes</TableHead>
                  <TableHead className="text-center">Faltantes</TableHead>
                  <TableHead className="text-center">Caixas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.codigo || p.id.slice(0, 8)}</TableCell>
                    <TableCell>{p.cliente?.nome || "—"}</TableCell>
                    <TableCell>{p.loja?.nome || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusFabricaBadgeClass(p.status_fabrica)}>
                        {statusFabricaLabel(p.status_fabrica)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{p.total_itens ?? 0}</TableCell>
                    <TableCell className="text-center text-emerald-700">{p.separados ?? 0}</TableCell>
                    <TableCell className="text-center">{p.pendentes ?? 0}</TableCell>
                    <TableCell className="text-center text-red-700">{p.faltantes ?? 0}</TableCell>
                    <TableCell className="text-center">{p.caixas ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => setAberto(p)}>
                        <ScanBarcode className="h-4 w-4 mr-1" />Iniciar separação
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <AlmoxarifadoPedidoSheet
        open={!!aberto}
        onOpenChange={(v) => !v && setAberto(null)}
        pedido={aberto}
        onChanged={carregar}
      />
    </div>
  );
}
