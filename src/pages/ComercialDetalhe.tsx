import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, ArrowLeft, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

type Orc = {
  id: string;
  codigo: string;
  nome_projeto: string | null;
  status: string;
  subtotal: number | null;
  desconto_perc: number | null;
  desconto_valor: number | null;
  total: number | null;
  created_at: string;
  cliente?: { nome: string; telefone: string | null; email: string | null } | null;
};
type Ambiente = {
  id: string;
  nome: string;
  ordem: number | null;
  custo_fabrica: number | null;
  custo_loja: number | null;
  custo_aquisicao: number | null;
  itens: Array<{
    id: string;
    descricao: string;
    quantidade: number | null;
    largura: number | null;
    altura: number | null;
    profundidade: number | null;
    custo_cliente: number | null;
    custo_loja: number | null;
    custo_fabrica: number | null;
    cor: string | null;
    categoria: string | null;
  }>;
};

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export default function ComercialDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orc, setOrc] = useState<Orc | null>(null);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: o, error } = await supabase
        .from("orcamentos")
        .select("*, cliente:clientes(nome, telefone, email)")
        .eq("id", id)
        .maybeSingle();
      if (error || !o) {
        toast.error("Orçamento não encontrado");
        setLoading(false);
        return;
      }
      setOrc(o as unknown as Orc);

      const { data: ambs } = await supabase
        .from("ambientes")
        .select("*")
        .eq("orcamento_id", id)
        .order("ordem");
      const ambIds = (ambs ?? []).map((a) => a.id);
      const { data: itens } = ambIds.length
        ? await supabase.from("sub_itens_ambiente").select("*").in("ambiente_id", ambIds)
        : { data: [] as any[] };
      const byAmb: Record<string, Ambiente["itens"]> = {};
      (itens ?? []).forEach((it: any) => {
        (byAmb[it.ambiente_id] ||= []).push(it);
      });
      setAmbientes((ambs ?? []).map((a: any) => ({ ...a, itens: byAmb[a.id] ?? [] })));
      setOpenIds(new Set((ambs ?? []).map((a: any) => a.id)));
      setLoading(false);
    })();
  }, [id]);

  const toggle = (id: string) => {
    const n = new Set(openIds);
    n.has(id) ? n.delete(id) : n.add(id);
    setOpenIds(n);
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="h-20 mb-6" />
        <Skeleton className="h-32 mb-4" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!orc) return null;

  const totalCliente = ambientes.reduce(
    (s, a) => s + a.itens.reduce((ss, it) => ss + (it.custo_cliente ?? 0) * (it.quantidade ?? 1), 0),
    0,
  );
  const totalLoja = ambientes.reduce(
    (s, a) => s + a.itens.reduce((ss, it) => ss + (it.custo_loja ?? 0) * (it.quantidade ?? 1), 0),
    0,
  );
  const totalFabrica = ambientes.reduce(
    (s, a) => s + a.itens.reduce((ss, it) => ss + (it.custo_fabrica ?? 0) * (it.quantidade ?? 1), 0),
    0,
  );

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

  return (
    <div>
      <PageHeader
        icon={Briefcase}
        iconVariant="purple"
        title={orc.nome_projeto ?? orc.codigo}
        subtitle={`${orc.codigo} • ${orc.cliente?.nome ?? "—"} • criado em ${fmtDate(orc.created_at)}`}
        actions={
          <Button variant="outline" onClick={() => navigate("/comercial")}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Voltar
          </Button>
        }
      />

      <Tabs defaultValue="ambientes">
        <TabsList>
          <TabsTrigger value="ambientes">Ambientes</TabsTrigger>
          <TabsTrigger value="custos">Custos gerenciais</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="ambientes" className="mt-4 space-y-3">
          {ambientes.length === 0 ? (
            <div className="surface-card text-center py-10 text-[12px] text-muted-foreground">
              Sem ambientes neste orçamento.
            </div>
          ) : ambientes.map((a) => {
            const open = openIds.has(a.id);
            const totalAmb = a.itens.reduce((s, it) => s + (it.custo_cliente ?? 0) * (it.quantidade ?? 1), 0);
            return (
              <div key={a.id} className="surface-card p-0 overflow-hidden">
                <button
                  onClick={() => toggle(a.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-[13px] font-medium">{a.nome}</span>
                    <span className="text-[10px] text-muted-foreground">({a.itens.length} itens)</span>
                  </div>
                  <span className="text-mono text-foreground">{fmtBrl(totalAmb)}</span>
                </button>
                {open && a.itens.length > 0 && (
                  <div className="border-t border-border px-4 py-3">
                    <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                      <div className="col-span-5">Descrição</div>
                      <div className="col-span-1 text-center">Qtd</div>
                      <div className="col-span-2 text-right">L×A×P</div>
                      <div className="col-span-2">Cor</div>
                      <div className="col-span-2 text-right">Cliente</div>
                    </div>
                    {a.itens.map((it) => (
                      <div key={it.id} className="grid grid-cols-12 gap-2 text-[11px] py-1.5 border-b border-border/40 last:border-0">
                        <div className="col-span-5 truncate">{it.descricao}</div>
                        <div className="col-span-1 text-center text-mono">{it.quantidade ?? 1}</div>
                        <div className="col-span-2 text-right text-mono">
                          {[it.largura, it.altura, it.profundidade].filter(Boolean).join("×") || "—"}
                        </div>
                        <div className="col-span-2 truncate text-muted-foreground">{it.cor ?? "—"}</div>
                        <div className="col-span-2 text-right text-mono text-foreground">{fmtBrl((it.custo_cliente ?? 0))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="custos" className="mt-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="surface-card">
              <div className="kpi-label">Custo Cliente</div>
              <div className="kpi-value mt-2">{fmtBrl(totalCliente)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">100%</div>
            </div>
            <div className="surface-card">
              <div className="kpi-label">Custo Loja</div>
              <div className="kpi-value mt-2">{fmtBrl(totalLoja)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {totalCliente > 0 ? ((totalLoja / totalCliente) * 100).toFixed(1) : 0}% do cliente
              </div>
            </div>
            <div className="surface-card">
              <div className="kpi-label">Custo Fábrica</div>
              <div className="kpi-value mt-2">{fmtBrl(totalFabrica)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {totalCliente > 0 ? ((totalFabrica / totalCliente) * 100).toFixed(1) : 0}% do cliente
              </div>
            </div>
          </div>
          <div className="surface-card">
            <div className="kpi-label mb-2">Margem estimada</div>
            <div className="text-[20px] font-light">{fmtBrl(totalCliente - totalFabrica)}</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {totalCliente > 0 ? (((totalCliente - totalFabrica) / totalCliente) * 100).toFixed(1) : 0}% sobre cliente
            </div>
          </div>
        </TabsContent>

        <TabsContent value="resumo" className="mt-4">
          <div className="surface-card max-w-md">
            <div className="grid grid-cols-2 gap-y-2 text-[13px]">
              <div className="text-muted-foreground">Subtotal</div>
              <div className="text-right text-mono">{fmtBrl(Number(orc.subtotal) || 0)}</div>
              <div className="text-muted-foreground">Desconto ({orc.desconto_perc ?? 0}%)</div>
              <div className="text-right text-mono">- {fmtBrl(Number(orc.desconto_valor) || 0)}</div>
              <div className="text-foreground font-medium pt-2 border-t border-border">Total</div>
              <div className="text-right text-foreground font-medium pt-2 border-t border-border text-mono">{fmtBrl(Number(orc.total) || 0)}</div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
