import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import { findKanban } from "@/components/kanban/kanbanRegistry";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LayoutGrid, List, Eye, PackagePlus, Loader2 } from "lucide-react";

const def = findKanban("fabrica");

type View = "kanban" | "lista";

type Linha = {
  id: string;
  codigo: string | null;
  data_assinatura_pdf_final: string | null;
  data_upload_projeto_producao: string | null;
  status_fabrica: string | null;
  cliente_nome: string | null;
  loja_nome: string | null;
  vendedor_nome: string | null;
};

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function ListaLiberadosFabrica() {
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<Linha[]>([]);

  async function carregar() {
    setLoading(true);
    const { data: pedidos, error } = await (supabase as any)
      .from("pedidos")
      .select(
        "id, codigo, vendedor_id, data_assinatura_pdf_final, status_fabrica, cliente:clientes(nome), loja:lojas(nome)"
      )
      .eq("status_fabrica", "liberado_para_lote")
      .order("data_assinatura_pdf_final", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("[ListaLiberadosFabrica] erro", error);
      setLinhas([]);
      setLoading(false);
      return;
    }

    const ids = (pedidos || []).map((p: any) => p.id);
    const vendedorIds = Array.from(
      new Set((pedidos || []).map((p: any) => p.vendedor_id).filter(Boolean))
    );

    const [{ data: docs }, { data: profs }] = await Promise.all([
      ids.length
        ? (supabase as any)
            .from("pedido_documentos")
            .select("pedido_id, created_at")
            .in("pedido_id", ids)
            .eq("categoria_projeto", "projeto_para_producao")
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
      vendedorIds.length
        ? supabase
            .from("profiles")
            .select("user_id, nome_completo")
            .in("user_id", vendedorIds as string[])
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const datasUpload: Record<string, string> = {};
    (docs || []).forEach((d: any) => {
      if (!datasUpload[d.pedido_id]) datasUpload[d.pedido_id] = d.created_at;
    });
    const vendedorMap: Record<string, string> = {};
    (profs || []).forEach((p: any) => {
      vendedorMap[p.user_id] = p.nome_completo || "";
    });

    // Fonte de verdade: status_fabrica = 'liberado_para_lote'.
    // Não filtramos por data_assinatura_pdf_final/projeto_para_producao aqui —
    // apenas enriquecemos a linha quando esses dados existirem.
    const result: Linha[] = (pedidos || []).map((p: any) => ({
      id: p.id,
      codigo: p.codigo,
      data_assinatura_pdf_final: p.data_assinatura_pdf_final,
      data_upload_projeto_producao: datasUpload[p.id] || null,
      status_fabrica: p.status_fabrica,
      cliente_nome: p.cliente?.nome || null,
      loja_nome: p.loja?.nome || null,
      vendedor_nome: p.vendedor_id ? vendedorMap[p.vendedor_id] || null : null,
    }));

    setLinhas(result);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("fabrica-liberados")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        () => carregar()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-playfair text-lg font-semibold">Pedidos liberados para lote</h2>
          <p className="text-xs text-muted-foreground">
            Pedidos com Projeto para Produção enviado e PDF Projeto Final assinado pelo cliente.
          </p>
        </div>
        <Badge variant="secondary" className="bg-violet-100 text-violet-700">
          {linhas.length} pedido{linhas.length === 1 ? "" : "s"}
        </Badge>
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
                  <th className="text-left px-3 py-2">Vendedor</th>
                  <th className="text-left px-3 py-2">Assinatura PDF Final</th>
                  <th className="text-left px-3 py-2">Projeto p/ Produção</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{l.codigo || "—"}</td>
                    <td className="px-3 py-2">{l.cliente_nome || "—"}</td>
                    <td className="px-3 py-2">{l.loja_nome || "—"}</td>
                    <td className="px-3 py-2">{l.vendedor_nome || "—"}</td>
                    <td className="px-3 py-2">{fmtData(l.data_assinatura_pdf_final)}</td>
                    <td className="px-3 py-2">{fmtData(l.data_upload_projeto_producao)}</td>
                    <td className="px-3 py-2">
                      <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
                        Liberado para lote
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1.5">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/pedidos/${l.id}`}>
                            <Eye className="w-3.5 h-3.5 mr-1" /> Ver pedido
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled
                          title="Em breve: separação em lote de produção"
                        >
                          <PackagePlus className="w-3.5 h-3.5 mr-1" /> Adicionar a lote
                        </Button>
                      </div>
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
  const [view, setView] = useState<View>(() => {
    try {
      const v = localStorage.getItem("fabrica:view");
      return v === "lista" ? "lista" : "kanban";
    } catch {
      return "kanban";
    }
  });

  useEffect(() => {
    try { localStorage.setItem("fabrica:view", view); } catch {}
  }, [view]);

  const Toggle = useMemo(
    () => (
      <div className="inline-flex rounded-lg border bg-background p-0.5">
        <Button
          size="sm"
          variant={view === "kanban" ? "default" : "ghost"}
          className="h-8 px-3"
          onClick={() => setView("kanban")}
        >
          <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> Kanban
        </Button>
        <Button
          size="sm"
          variant={view === "lista" ? "default" : "ghost"}
          className="h-8 px-3"
          onClick={() => setView("lista")}
        >
          <List className="w-3.5 h-3.5 mr-1.5" /> Lista
        </Button>
      </div>
    ),
    [view]
  );

  if (view === "lista") {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-playfair text-2xl font-semibold">{def.label}</h1>
            {def.subtitle && (
              <p className="text-sm text-muted-foreground">{def.subtitle}</p>
            )}
          </div>
          {Toggle}
        </div>
        <ListaLiberadosFabrica />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute right-4 top-4 z-10">{Toggle}</div>
      <KanbanBoard
        activeKey="fabrica"
        pipeline={def.pipeline!}
        title={def.label}
        subtitle={def.subtitle}
        icon={def.icon}
        iconVariant={def.variant}
        useStageDialog
      />
    </div>
  );
}
