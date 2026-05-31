import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Upload, Loader2, FileArchive, Layers, Tag, AlertTriangle, Eye } from "lucide-react";
import { statusFabricaBadgeClass, statusFabricaLabel } from "@/lib/fabrica/statusFabrica";
import { ImportarProducaoDialog } from "@/components/fabrica/ImportarProducaoDialog";
import { ImportarPacoteTecnicoDialog } from "@/components/fabrica/ImportarPacoteTecnicoDialog";
import { VisualizadorPlanoCorteDialog } from "@/components/fabrica/VisualizadorPlanoCorteDialog";

export default function ImportarProducao() {
  const { selectedLojaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [sel, setSel] = useState<{ id: string; codigo: string | null } | null>(null);
  const [tecSel, setTecSel] = useState<{ id: string; codigo: string | null } | null>(null);
  const [verCorte, setVerCorte] = useState<{ id: string; codigo: string | null } | null>(null);
  const [multi, setMulti] = useState<Record<string, boolean>>({});
  const [tecMultiOpen, setTecMultiOpen] = useState(false);
  const [resumo, setResumo] = useState({ pacotes: 0, erros: 0, chapas: 0, etiquetas: 0, arquivos: 0 });

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

    // resumo técnico
    let qi = (supabase as any).from("fabrica_importacoes_tecnicas").select("status_importacao,total_chapas,total_etiquetas,total_arquivos_tecnicos");
    if (selectedLojaId) qi = qi.eq("loja_id", selectedLojaId);
    const { data: imps } = await qi;
    const list = (imps as any[]) || [];
    setResumo({
      pacotes: list.length,
      erros: list.filter((i) => i.status_importacao === "erro").length,
      chapas: list.reduce((a, i) => a + (i.total_chapas || 0), 0),
      etiquetas: list.reduce((a, i) => a + (i.total_etiquetas || 0), 0),
      arquivos: list.reduce((a, i) => a + (i.total_arquivos_tecnicos || 0), 0),
    });

    setLoading(false);
  }

  useEffect(() => { carregar(); }, [selectedLojaId]);

  const multiIds = Object.entries(multi).filter(([, v]) => v).map(([k]) => k);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Importar produção</h1>
        <p className="text-sm text-muted-foreground">Anexe relatórios obrigatórios ou o pacote técnico Promob/Nesting/Cut Pro dos pedidos liberados para fábrica.</p>
      </div>

      {/* Resumo técnico */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><FileArchive className="h-3 w-3" /> Pacotes técnicos</div><div className="text-2xl font-bold">{resumo.pacotes}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Com erro</div><div className="text-2xl font-bold text-red-600">{resumo.erros}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><Layers className="h-3 w-3" /> Chapas</div><div className="text-2xl font-bold">{resumo.chapas}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Etiquetas</div><div className="text-2xl font-bold">{resumo.etiquetas}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Arquivos técnicos</div><div className="text-2xl font-bold">{resumo.arquivos}</div></Card>
      </div>

      {/* Multi-cliente */}
      {multiIds.length > 0 && (
        <Card className="p-3 flex items-center justify-between bg-muted/40">
          <div className="text-sm"><strong>{multiIds.length}</strong> pedido(s) selecionado(s) para pacote técnico multi-cliente</div>
          <Button onClick={() => setTecMultiOpen(true)}><FileArchive className="h-4 w-4 mr-1" /> Importar pacote técnico do lote</Button>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-2 w-8"></th>
                <th className="p-2">Pedido</th><th className="p-2">Cliente</th><th className="p-2">Loja</th>
                <th className="p-2">Status fábrica</th><th className="p-2">Liberação</th><th className="p-2 w-64"></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-2">
                    <Checkbox checked={!!multi[p.id]} onCheckedChange={(v) => setMulti((s) => ({ ...s, [p.id]: !!v }))} />
                  </td>
                  <td className="p-2 font-medium">{p.codigo || "—"}</td>
                  <td className="p-2">{p.cliente?.nome || "—"}</td>
                  <td className="p-2">{p.loja?.nome || "—"}</td>
                  <td className="p-2"><Badge variant="outline" className={statusFabricaBadgeClass(p.status_fabrica)}>{statusFabricaLabel(p.status_fabrica)}</Badge></td>
                  <td className="p-2 text-xs">{p.data_assinatura_pdf_final ? new Date(p.data_assinatura_pdf_final).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="p-2 text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => setSel({ id: p.id, codigo: p.codigo })}>
                      <Upload className="h-4 w-4 mr-1" /> Relatórios
                    </Button>
                    <Button size="sm" onClick={() => setTecSel({ id: p.id, codigo: p.codigo })}>
                      <FileArchive className="h-4 w-4 mr-1" /> Pacote técnico
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setVerCorte({ id: p.id, codigo: p.codigo })}>
                      <Eye className="h-4 w-4 mr-1" /> Plano de corte
                    </Button>
                  </td>
                </tr>
              ))}
              {pedidos.length === 0 && <tr><td className="p-6 text-center text-muted-foreground" colSpan={7}>Nenhum pedido liberado para fábrica.</td></tr>}
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

      <ImportarPacoteTecnicoDialog
        open={!!tecSel}
        onOpenChange={(v) => !v && setTecSel(null)}
        modo="individual"
        pedidoId={tecSel?.id || null}
        pedidoCodigo={tecSel?.codigo || null}
        onConcluido={() => { setTecSel(null); carregar(); }}
      />

      <ImportarPacoteTecnicoDialog
        open={tecMultiOpen}
        onOpenChange={setTecMultiOpen}
        modo="lote_multi_cliente"
        pedidosIds={multiIds}
        onConcluido={() => { setTecMultiOpen(false); setMulti({}); carregar(); }}
      />

      <VisualizadorPlanoCorteDialog
        open={!!verCorte}
        onOpenChange={(v) => !v && setVerCorte(null)}
        pedidoId={verCorte?.id || null}
      />
    </div>
  );
}
