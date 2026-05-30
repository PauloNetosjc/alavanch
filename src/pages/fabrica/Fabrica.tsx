import { lazy, Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Factory, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";

const PainelFabrica = lazy(() => import("@/pages/fabrica/PainelFabrica"));
const ImportarProducao = lazy(() => import("@/pages/fabrica/ImportarProducao"));
const ProducaoPorPedido = lazy(() => import("@/pages/fabrica/ProducaoPorPedido"));
const ConferenciaFabrica = lazy(() => import("@/pages/fabrica/Conferencia"));
const KanbanFabrica = lazy(() => import("@/pages/KanbanFabrica"));
const Almoxarifado = lazy(() => import("@/pages/fabrica/Almoxarifado"));
const Expedicao = lazy(() => import("@/pages/fabrica/Expedicao"));
const Ocorrencias = lazy(() => import("@/pages/fabrica/Ocorrencias"));

interface AbaDef {
  value: string;
  label: string;
  permissao?: string;
  render: () => JSX.Element;
}

function EmBreve({ titulo }: { titulo: string }) {
  return (
    <Card className="p-10 text-center text-muted-foreground">
      <div className="text-lg font-semibold mb-2">{titulo}</div>
      <div className="text-sm">Em breve nesta tela.</div>
    </Card>
  );
}

const ABAS: AbaDef[] = [
  { value: "painel", label: "Painel", permissao: "fabrica_painel", render: () => <PainelFabrica /> },
  { value: "importar", label: "Importar Produção", permissao: "fabrica_importar_producao", render: () => <ImportarProducao /> },
  { value: "producao-pedido", label: "Produção por Pedido", permissao: "fabrica_producao_pedido", render: () => <ProducaoPorPedido /> },
  { value: "conferencia", label: "Conferência", permissao: "fabrica_conferencia", render: () => <ConferenciaFabrica /> },
  { value: "almoxarifado", label: "Almoxarifado", permissao: "fabrica_almoxarifado", render: () => <Almoxarifado /> },
  { value: "expedicao", label: "Expedição", permissao: "fabrica_expedicao", render: () => <Expedicao /> },
  { value: "ocorrencias", label: "Ocorrências", permissao: "fabrica_ocorrencias", render: () => <Ocorrencias /> },
  { value: "lotes", label: "Kanban / Lotes", permissao: "fabrica_lotes", render: () => <KanbanFabrica /> },
];

export default function Fabrica() {
  const [params, setParams] = useSearchParams();
  const { can, loading } = usePermissions();

  const abasVisiveis = useMemo(
    () => ABAS.filter((a) => !a.permissao || can(a.permissao, "view")),
    [can]
  );

  const abaAtual = params.get("aba") || abasVisiveis[0]?.value || "painel";
  const abaAtiva = abasVisiveis.find((a) => a.value === abaAtual) || abasVisiveis[0];

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <PageHeader
        icon={Factory}
        iconVariant="amber"
        title="Fábrica"
        subtitle="Produção, lotes, conferência, almoxarifado e expedição."
      />

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : abasVisiveis.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          Você não possui permissão para acessar nenhuma área do módulo Fábrica.
        </Card>
      ) : (
        <Tabs
          value={abaAtiva?.value}
          onValueChange={(v) => {
            const next = new URLSearchParams(params);
            next.set("aba", v);
            setParams(next, { replace: true });
          }}
        >
          <div className="overflow-x-auto -mx-1 px-1 mb-4">
            <TabsList className="h-auto flex-wrap gap-1">
              {abasVisiveis.map((a) => (
                <TabsTrigger key={a.value} value={a.value} className="text-xs sm:text-sm">
                  {a.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {abasVisiveis.map((a) => (
            <TabsContent key={a.value} value={a.value} className="mt-0">
              <Suspense fallback={<div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}>
                {abaAtiva?.value === a.value ? a.render() : null}
              </Suspense>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
