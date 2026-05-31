import { lazy, Suspense, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Factory, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkflowFabrica, ETAPAS_WORKFLOW } from "@/components/fabrica/WorkflowFabrica";
import { AtalhosFabrica, AtalhoFabrica } from "@/components/fabrica/AtalhosFabrica";

const PainelFabrica = lazy(() => import("@/pages/fabrica/PainelFabrica"));
const ImportarProducao = lazy(() => import("@/pages/fabrica/ImportarProducao"));
const ProducaoPorPedido = lazy(() => import("@/pages/fabrica/ProducaoPorPedido"));
const ConferenciaFabrica = lazy(() => import("@/pages/fabrica/Conferencia"));
const KanbanFabrica = lazy(() => import("@/pages/KanbanFabrica"));
const Almoxarifado = lazy(() => import("@/pages/fabrica/Almoxarifado"));
const Expedicao = lazy(() => import("@/pages/fabrica/Expedicao"));
const Ocorrencias = lazy(() => import("@/pages/fabrica/Ocorrencias"));
const RequisicoesCompra = lazy(() => import("@/pages/fabrica/RequisicoesCompra"));

const LOADING = (
  <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
);

function ProducaoEtapa() {
  // Sub-etapas internas: Corte e Fita / Ateliê
  const [sub, setSub] = useState("corte_fita");
  return (
    <div className="space-y-3">
      <Tabs value={sub} onValueChange={setSub}>
        <TabsList>
          <TabsTrigger value="corte_fita">Corte e Fita</TabsTrigger>
          <TabsTrigger value="atelie">Ateliê</TabsTrigger>
        </TabsList>
        <TabsContent value="corte_fita" className="mt-3">
          <ProducaoPorPedido />
        </TabsContent>
        <TabsContent value="atelie" className="mt-3">
          <Card className="p-6 text-sm text-muted-foreground">
            <div className="font-medium text-foreground mb-1">Ateliê</div>
            Peças especiais (ripado, frente provençal, módulos curvos, pintura, montagem manual)
            aparecerão aqui quando forem enviadas da etapa Corte e Fita.
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Fabrica() {
  const [params, setParams] = useSearchParams();
  const { can, loading } = usePermissions();
  const [atalho, setAtalho] = useState<AtalhoFabrica>(null);

  const etapaAtiva = params.get("aba") || "importar";
  const etapaValida = ETAPAS_WORKFLOW.find((e) => e.value === etapaAtiva) || ETAPAS_WORKFLOW[0];

  function selectEtapa(v: string) {
    setAtalho(null);
    const next = new URLSearchParams(params);
    next.set("aba", v);
    next.delete("atalho");
    setParams(next, { replace: true });
  }

  function selectAtalho(v: AtalhoFabrica) {
    setAtalho(v);
    const next = new URLSearchParams(params);
    if (v) next.set("atalho", v); else next.delete("atalho");
    setParams(next, { replace: true });
  }

  // hidrata atalho a partir da URL
  useEffect(() => {
    const a = params.get("atalho") as AtalhoFabrica | null;
    if (a && ["almoxarifado", "ocorrencias", "requisicoes"].includes(a)) setAtalho(a);
  }, []); // eslint-disable-line

  const conteudo = useMemo(() => {
    if (atalho === "almoxarifado") return <Almoxarifado />;
    if (atalho === "ocorrencias") return <Ocorrencias />;
    if (atalho === "requisicoes") return <RequisicoesCompra />;
    switch (etapaValida.value) {
      case "importar": return <ImportarProducao />;
      case "lotes": return <KanbanFabrica />;
      case "producao": return <ProducaoEtapa />;
      case "conferencia": return <ConferenciaFabrica />;
      case "expedicao": return <Expedicao />;
      default: return null;
    }
  }, [atalho, etapaValida]);

  if (loading) {
    return <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
      <PageHeader
        icon={Factory}
        iconVariant="amber"
        title="Fábrica"
        subtitle="Produção, lotes, conferência, almoxarifado, expedição e ocorrências."
      />

      {/* Atalhos superiores */}
      <AtalhosFabrica active={atalho} onSelect={selectAtalho} />

      {/* Painel fixo (só fora dos atalhos) */}
      {!atalho && (
        <Card className="p-0 overflow-hidden">
          <Suspense fallback={LOADING}>
            <PainelFabrica />
          </Suspense>
        </Card>
      )}

      {/* Workflow sequencial */}
      {!atalho && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium px-1">
            Workflow da fábrica
          </div>
          <WorkflowFabrica active={etapaValida.value} onSelect={selectEtapa} />
        </div>
      )}

      {/* Conteúdo da etapa / atalho */}
      <div className="pt-2">
        <Suspense fallback={LOADING}>{conteudo}</Suspense>
      </div>
    </div>
  );
}
