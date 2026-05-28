import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { findKanban } from "@/components/kanban/kanbanRegistry";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LayoutGrid, List, Eye, PackagePlus, Loader2 } from "lucide-react";

const def = findKanban("fabrica");

type View = "kanban" | "lista";

type Linha = {
  id: string;
  codigo: string | null;
  loja_id: string | null;
  created_at: string | null;
  valor_total: number | null;
  data_assinatura_pdf_final: string | null;
  status_fabrica: string | null;
  cliente_nome: string | null;
  loja_nome: string | null;
};

function fmtBrl(n: number | null): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));
}

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function ListaLiberadosFabrica() {
  const { selectedLojaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<Linha[]>([]);

  async function carregar() {
    setLoading(true);
    let query = (supabase as any)
      .from("pedidos")
      .select(
        "id, codigo, loja_id, created_at, valor_total, data_assinatura_pdf_final, status_fabrica, arquivado, cliente:clientes(nome), loja:lojas(nome)"
      )
      .eq("status_fabrica", "liberado_para_lote")
      .or("arquivado.is.null,arquivado.eq.false")
      .order("created_at", { ascending: false });

    if (selectedLojaId) query = query.eq("loja_id", selectedLojaId);

    const { data: pedidos, error } = await query;

    if (error) {
      console.error("[ListaLiberadosFabrica] erro", error);
      setLinhas([]);
      setLoading(false);
      return;
    }

    // Fonte de verdade: status_fabrica = 'liberado_para_lote'.
    const result: Linha[] = (pedidos || []).map((p: any) => ({
      id: p.id,
      codigo: p.codigo,
      loja_id: p.loja_id,
      created_at: p.created_at,
      valor_total: p.valor_total,
      data_assinatura_pdf_final: p.data_assinatura_pdf_final,
      status_fabrica: p.status_fabrica,
      cliente_nome: p.cliente?.nome || null,
      loja_nome: p.loja?.nome || null,
    }));

    if (import.meta.env.DEV) {
      console.debug("[FabricaDebug] Lista", {
        lojaAtual: selectedLojaId,
        quantidadeRetornada: result.length,
        queryUsada: "pedidos.status_fabrica = 'liberado_para_lote' + loja_id atual + arquivado != true",
        filtrosAplicados: { status_fabrica: "liberado_para_lote", loja_id: selectedLojaId, arquivado: false },
        pedidosRetornados: result.map((p) => ({ codigo: p.codigo, loja_id: p.loja_id, status_fabrica: p.status_fabrica })),
      });
    }

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
  }, [selectedLojaId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-playfair text-lg font-semibold">Pedidos liberados para lote</h2>
          <p className="text-xs text-muted-foreground">
            Pedidos com status de fábrica liberado para lote na loja atual.
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
                  <th className="text-left px-3 py-2">Criado em</th>
                  <th className="text-left px-3 py-2">Valor</th>
                  <th className="text-left px-3 py-2">Assinatura PDF Final</th>
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
                    <td className="px-3 py-2">{fmtData(l.created_at)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{fmtBrl(l.valor_total)}</td>
                    <td className="px-3 py-2">{fmtData(l.data_assinatura_pdf_final)}</td>
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

function KanbanLiberadosFabrica() {
  const { selectedLojaId } = useLoja();
  const [loading, setLoading] = useState(true);
  const [linhas, setLinhas] = useState<Linha[]>([]);

  async function carregar() {
    setLoading(true);
    let query = (supabase as any)
      .from("pedidos")
      .select("id, codigo, loja_id, created_at, valor_total, data_assinatura_pdf_final, status_fabrica, arquivado, cliente:clientes(nome), loja:lojas(nome)")
      .eq("status_fabrica", "liberado_para_lote")
      .or("arquivado.is.null,arquivado.eq.false")
      .order("created_at", { ascending: false });

    if (selectedLojaId) query = query.eq("loja_id", selectedLojaId);

    const { data: pedidos, error } = await query;
    if (error) {
      console.error("[FabricaKanban] erro", error);
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
      status_fabrica: p.status_fabrica,
      cliente_nome: p.cliente?.nome || null,
      loja_nome: p.loja?.nome || null,
    }));

    if (import.meta.env.DEV) {
      console.debug("[FabricaDebug] Kanban", {
        lojaAtual: selectedLojaId,
        quantidadeRetornada: result.length,
        queryUsada: "pedidos.status_fabrica = 'liberado_para_lote' + loja_id atual + arquivado != true",
        filtrosAplicados: { status_fabrica: "liberado_para_lote", loja_id: selectedLojaId, arquivado: false },
        pedidosRetornados: result.map((p) => ({ codigo: p.codigo, loja_id: p.loja_id, status_fabrica: p.status_fabrica })),
      });
    }

    setLinhas(result);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("fabrica-kanban-liberados")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        () => carregar()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [selectedLojaId]);

  if (loading) {
    return <div className="text-center text-muted-foreground py-12 text-[13px]">Carregando…</div>;
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        <div className="w-[320px] shrink-0">
          <div className="rounded-t-lg px-3 py-2 bg-violet-500/10 border-t-[3px] border-violet-500">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[12px] font-semibold uppercase text-violet-700">Liberado para lote</div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-background text-foreground">{linhas.length}</span>
            </div>
          </div>
          <div className="bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[180px]">
            {linhas.map((p) => (
              <Card key={p.id} className="border-l-4 border-l-violet-500 p-3 space-y-2 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[12px] font-bold text-primary">{p.codigo || "—"}</div>
                    <div className="text-[12px] font-medium truncate max-w-[220px]">{p.cliente_nome || "—"}</div>
                  </div>
                  <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">Liberado</Badge>
                </div>
                <div className="grid gap-0.5 text-[10px] text-muted-foreground">
                  <span>{p.loja_nome || "—"}</span>
                  <span>Criado em {fmtData(p.created_at)}</span>
                  <span className="font-mono text-foreground">{fmtBrl(p.valor_total)}</span>
                </div>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to={`/pedidos/${p.id}`}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> Ver pedido
                  </Link>
                </Button>
              </Card>
            ))}
            {linhas.length === 0 && (
              <div className="text-[11px] text-muted-foreground text-center py-4">Vazio</div>
            )}
          </div>
        </div>
      </div>
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
      <KanbanLiberadosFabrica />
    </div>
  );
}
