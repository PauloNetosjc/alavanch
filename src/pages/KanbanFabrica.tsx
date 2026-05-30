import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { findKanban } from "@/components/kanban/kanbanRegistry";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, PackagePlus, Loader2, ListChecks, Factory, Boxes } from "lucide-react";
import { CriarLoteDialog } from "@/components/fabrica/CriarLoteDialog";
import { LotesAtivos } from "@/components/fabrica/LotesAtivos";
import { KanbanProducao } from "@/components/fabrica/KanbanProducao";
import { usePermissions } from "@/hooks/usePermissions";

const def = findKanban("fabrica");

type Linha = {
  id: string;
  codigo: string | null;
  loja_id: string | null;
  created_at: string | null;
  valor_total: number | null;
  data_assinatura_pdf_final: string | null;
  data_limite_entrega: string | null;
  status_fabrica: string | null;
  cliente_nome: string | null;
  loja_nome: string | null;
};

function fmtBrl(n: number | null): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));
}

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

function ListaLiberadosFabrica({ onCriarLote }: { onCriarLote: () => void }) {
  const { selectedLojaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<Linha[]>([]);

  async function carregar() {
    setLoading(true);
    let query = (supabase as any)
      .from("pedidos")
      .select(
        "id, codigo, loja_id, created_at, valor_total, data_assinatura_pdf_final, data_limite_entrega, status_fabrica, cliente:clientes(nome), loja:lojas(nome)"
      )
      .eq("status_fabrica", "liberado_para_lote")
      .order("created_at", { ascending: false });

    if (selectedLojaId) query = query.eq("loja_id", selectedLojaId);

    const { data: pedidos, error } = await query;
    if (error) {
      console.error("[ListaLiberadosFabrica] erro", error);
      setLinhas([]);
      setLoading(false);
      return;
    }

    const result: Linha[] = (pedidos || []).map((p: any) => ({
      id: p.id,
      codigo: p.codigo,
      loja_id: p.loja_id,
      created_at: p.created_at,
      valor_total: p.valor_total,
      data_assinatura_pdf_final: p.data_assinatura_pdf_final,
      data_limite_entrega: p.data_limite_entrega,
      status_fabrica: p.status_fabrica,
      cliente_nome: p.cliente?.nome || null,
      loja_nome: p.loja?.nome || null,
    }));

    setLinhas(result);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("fabrica-liberados")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedLojaId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-playfair text-lg font-semibold">Pedidos liberados para lote</h2>
          <p className="text-xs text-muted-foreground">
            Pedidos prontos para entrar em produção. Selecione e crie um lote.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-violet-100 text-violet-700">
            {linhas.length} pedido{linhas.length === 1 ? "" : "s"}
          </Badge>
          <Button onClick={onCriarLote} disabled={linhas.length === 0}>
            <PackagePlus className="w-4 h-4 mr-2" /> Criar lote
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : linhas.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum pedido liberado para lote no momento.
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-background">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">PV</th>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-left px-3 py-2">Loja</th>
                  <th className="text-left px-3 py-2">Assinatura PDF</th>
                  <th className="text-left px-3 py-2">Prazo Entrega</th>
                  <th className="text-left px-3 py-2">Valor</th>
                  <th className="text-right px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{l.codigo || "—"}</td>
                    <td className="px-3 py-2">{l.cliente_nome || "—"}</td>
                    <td className="px-3 py-2">{l.loja_nome || "—"}</td>
                    <td className="px-3 py-2">{fmtData(l.data_assinatura_pdf_final)}</td>
                    <td className="px-3 py-2">{fmtData(l.data_limite_entrega)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{fmtBrl(l.valor_total)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/pedidos/${l.id}`}>
                          <Eye className="w-3.5 h-3.5 mr-1" /> Ver pedido
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KanbanFabrica() {
  const { can, isAdmin } = usePermissions();
  const podeEditar = isAdmin || can("fabrica_lotes", "edit");

  const [tab, setTab] = useState<string>(() => {
    try { return localStorage.getItem("fabrica:tab") || "kanban"; } catch { return "kanban"; }
  });
  const [criarOpen, setCriarOpen] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    try { localStorage.setItem("fabrica:tab", tab); } catch {}
  }, [tab]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-playfair text-2xl font-semibold">{def.label}</h1>
          {def.subtitle && (
            <p className="text-sm text-muted-foreground">{def.subtitle}</p>
          )}
        </div>
        {podeEditar && (
          <Button onClick={() => setCriarOpen(true)}>
            <PackagePlus className="w-4 h-4 mr-2" /> Criar lote
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="kanban">
            <Factory className="w-4 h-4 mr-1.5" /> Kanban de Produção
          </TabsTrigger>
          <TabsTrigger value="lotes">
            <Boxes className="w-4 h-4 mr-1.5" /> Lotes
          </TabsTrigger>
          <TabsTrigger value="liberados">
            <ListChecks className="w-4 h-4 mr-1.5" /> Liberados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <KanbanProducao reloadKey={reload} />
        </TabsContent>

        <TabsContent value="lotes" className="mt-4">
          <LotesAtivos reloadKey={reload} onChanged={() => setReload((r) => r + 1)} />
        </TabsContent>

        <TabsContent value="liberados" className="mt-4">
          <ListaLiberadosFabrica onCriarLote={() => setCriarOpen(true)} />
        </TabsContent>
      </Tabs>

      <CriarLoteDialog
        open={criarOpen}
        onOpenChange={setCriarOpen}
        onCriado={() => { setReload((r) => r + 1); setTab("kanban"); }}
      />
    </div>
  );
}
