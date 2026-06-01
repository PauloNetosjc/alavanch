import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertTriangle, BarChart3, CheckCircle2, FileText, Settings, Shield, Wrench, XCircle,
  Package, History, Activity, ListOrdered, Layers, Calculator, ArrowLeft, ChevronRight,
} from "lucide-react";

import { BRL } from "@/lib/financeiro";
import { ConfiguracoesFiscaisPanel } from "@/components/fiscal/ConfiguracoesFiscaisPanel";
import { CertificadoPanel } from "@/components/fiscal/CertificadoPanel";
import { ProdutosFiscaisPanel } from "@/components/fiscal/ProdutosFiscaisPanel";
import { ServicosFiscaisPanel } from "@/components/fiscal/ServicosFiscaisPanel";
import { NotasEmitidasPanel } from "@/components/fiscal/NotasEmitidasPanel";
import { EventosAuditoriaPanel } from "@/components/fiscal/EventosAuditoriaPanel";
import { StatusBackendFiscalPanel } from "@/components/fiscal/StatusBackendFiscalPanel";
import { CfopsPanel } from "@/components/fiscal/CfopsPanel";
import { OperacoesFiscaisPanel } from "@/components/fiscal/OperacoesFiscaisPanel";
import { ConfiguracoesTributariasPanel } from "@/components/fiscal/ConfiguracoesTributariasPanel";

type NF = { id: string; tipo: string; status: string; valor_total: number; ambiente: string | null; created_at: string };
type Cert = { id: string; nome: string; validade_fim: string | null; status: string };
type Cfg = { ambiente: string | null; emitir_nfe: boolean | null; emitir_nfse: boolean | null };

const MAIN_TABS = ["dashboard", "nfe", "nfse", "emitidas"] as const;
type ConfigKey = "produtos" | "servicos" | "cfops" | "operacoes" | "tributarias" | "certificado" | "config" | "status" | "eventos";
const CONFIG_GROUPS: { titulo: string; itens: { key: ConfigKey; label: string; icon: React.ReactNode; desc?: string }[] }[] = [
  { titulo: "Cadastros fiscais", itens: [
    { key: "produtos", label: "Produtos Fiscais", icon: <Package className="w-4 h-4"/> },
    { key: "servicos", label: "Serviços Fiscais", icon: <Wrench className="w-4 h-4"/> },
    { key: "cfops", label: "CFOPs", icon: <ListOrdered className="w-4 h-4"/> },
  ]},
  { titulo: "Operações e impostos", itens: [
    { key: "operacoes", label: "Operações Fiscais", icon: <Layers className="w-4 h-4"/> },
    { key: "tributarias", label: "Configurações Tributárias", icon: <Calculator className="w-4 h-4"/> },
  ]},
  { titulo: "Empresa e certificado", itens: [
    { key: "certificado", label: "Certificado", icon: <Shield className="w-4 h-4"/> },
    { key: "config", label: "Configurações Fiscais", icon: <Settings className="w-4 h-4"/> },
  ]},
  { titulo: "Sistema", itens: [
    { key: "status", label: "Status Backend", icon: <Activity className="w-4 h-4"/> },
    { key: "eventos", label: "Eventos / Auditoria", icon: <History className="w-4 h-4"/> },
  ]},
];
const CONFIG_LABEL: Record<ConfigKey, string> = {
  produtos: "Produtos Fiscais", servicos: "Serviços Fiscais", cfops: "CFOPs",
  operacoes: "Operações Fiscais", tributarias: "Configurações Tributárias",
  certificado: "Certificado", config: "Configurações Fiscais",
  status: "Status Backend", eventos: "Eventos / Auditoria",
};

export default function NotasFiscais() {
  const { selectedLojaId } = useLoja();
  const [tab, setTab] = useState<string>("dashboard");
  const [configOpen, setConfigOpen] = useState(false);
  const [notas, setNotas] = useState<NF[]>([]);
  const [cert, setCert] = useState<Cert | null>(null);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const isConfigView = !(MAIN_TABS as readonly string[]).includes(tab);


  useEffect(() => {
    if (!selectedLojaId) return;
    supabase.from("notas_fiscais" as any).select("id,tipo,status,valor_total,ambiente,created_at")
      .eq("loja_id", selectedLojaId).order("created_at", { ascending: false })
      .then(({ data }) => setNotas((data as any) || []));
    supabase.from("certificados_digitais" as any).select("id,nome,validade_fim,status")
      .eq("loja_id", selectedLojaId).in("status", ["ativo", "pendente_validacao"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setCert(data as any));
    supabase.from("configuracoes_fiscais" as any).select("ambiente,emitir_nfe,emitir_nfse")
      .eq("loja_id", selectedLojaId).maybeSingle()
      .then(({ data }) => setCfg(data as any));
  }, [selectedLojaId, tab]);

  const stats = useMemo(() => {
    const aut = notas.filter((n) => n.status === "autorizada");
    const neg = notas.filter((n) => n.status === "rejeitada" || n.status === "denegada" || n.status === "erro_transmissao");
    const can = notas.filter((n) => n.status === "cancelada");
    const pend = notas.filter((n) => ["rascunho","pronta_para_emitir","assinada","enviada","aguardando_consulta"].includes(n.status));
    return {
      total: notas.length, aut: aut.length, neg: neg.length, can: can.length, pend: pend.length,
      valor: aut.reduce((s, n) => s + Number(n.valor_total || 0), 0),
    };
  }, [notas]);

  const certOk = cert && cert.status === "ativo";
  const ambiente = cfg?.ambiente || "homologacao";

  const configPanels: Record<ConfigKey, React.ReactNode> = {
    produtos: <ProdutosFiscaisPanel/>,
    servicos: <ServicosFiscaisPanel/>,
    cfops: <CfopsPanel/>,
    operacoes: <OperacoesFiscaisPanel/>,
    tributarias: <ConfiguracoesTributariasPanel/>,
    certificado: <CertificadoPanel/>,
    config: <ConfiguracoesFiscaisPanel/>,
    status: <StatusBackendFiscalPanel/>,
    eventos: <EventosAuditoriaPanel/>,
  };

  const goConfig = (key: ConfigKey) => { setTab(key); setConfigOpen(false); };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h1 className="text-2xl font-display flex items-center gap-2"><FileText className="w-5 h-5"/> Notas Fiscais</h1>
        <div className="flex items-center gap-2">
          <Badge variant={ambiente === "producao" ? "default" : "secondary"}>
            Ambiente: {ambiente === "producao" ? "Produção" : "Homologação"}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings className="w-4 h-4 mr-1.5"/> Configurações
          </Button>
        </div>
      </div>

      {isConfigView ? (
        <div className="mt-2 space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setTab("dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1.5"/> Voltar para Notas Fiscais
            </Button>
            <h2 className="text-lg font-medium">{CONFIG_LABEL[tab as ConfigKey]}</h2>
          </div>
          <div>{configPanels[tab as ConfigKey]}</div>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-transparent border-b w-full justify-start rounded-none p-0 h-auto flex-wrap">
            <TabT v="dashboard" i={<BarChart3 className="w-4 h-4 mr-1.5"/>}>Dashboard</TabT>
            <TabT v="nfe" i={<FileText className="w-4 h-4 mr-1.5"/>}>NF-e</TabT>
            <TabT v="nfse" i={<Wrench className="w-4 h-4 mr-1.5"/>}>NFS-e</TabT>
            <TabT v="emitidas" i={<FileText className="w-4 h-4 mr-1.5"/>}>Notas Emitidas</TabT>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6 space-y-6">
            {!certOk && (
              <Card className="p-4 flex items-center justify-between bg-red-50 border-red-200">
                <div className="flex items-center gap-3 text-red-800">
                  <AlertTriangle className="w-5 h-5"/>
                  <div>
                    <div className="font-medium">Envio de notas bloqueado até configurar o certificado digital</div>
                    <div className="text-sm">Envie o certificado A1 da empresa em Configurações &gt; Certificado.</div>
                  </div>
                </div>
                <Button variant="destructive" onClick={() => setTab("certificado")}>Configurar certificado</Button>
              </Card>
            )}

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Stat label="Total" value={stats.total} icon={<FileText className="w-4 h-4"/>}/>
              <Stat label="Autorizadas" value={stats.aut} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600"/>}/>
              <Stat label="Rejeitadas / Erro" value={stats.neg} icon={<XCircle className="w-4 h-4 text-red-600"/>}/>
              <Stat label="Canceladas" value={stats.can} icon={<AlertTriangle className="w-4 h-4 text-amber-600"/>}/>
              <Stat label="Pendentes" value={stats.pend} icon={<FileText className="w-4 h-4 text-blue-600"/>}/>
              <Stat label="Valor autorizado" value={BRL(stats.valor)} icon={<BarChart3 className="w-4 h-4"/>}/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ResumoTipo titulo="NF-e" notas={notas.filter((n) => n.tipo === "nfe")}/>
              <ResumoTipo titulo="NFS-e" notas={notas.filter((n) => n.tipo === "nfse")}/>
              <Card className="p-4">
                <h4 className="text-sm font-medium mb-3">Status do módulo</h4>
                <Linha k="Certificado" v={certOk ? <span className="text-emerald-700">Ativo</span> : cert?.status === "pendente_validacao" ? <span className="text-amber-700">Pendente validação</span> : <span className="text-red-700">Ausente</span>}/>
                <Linha k="Validade certificado" v={cert?.validade_fim ? new Date(cert.validade_fim).toLocaleDateString("pt-BR") : "—"}/>
                <Linha k="Ambiente" v={ambiente === "producao" ? "Produção" : "Homologação"}/>
                <Linha k="Emite NF-e" v={cfg?.emitir_nfe ? "Sim" : "Não"}/>
                <Linha k="Emite NFS-e" v={cfg?.emitir_nfse ? "Sim" : "Não"}/>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="nfe" className="mt-6"><PainelEmissao tipo="NF-e" certOk={!!certOk}/></TabsContent>
          <TabsContent value="nfse" className="mt-6"><PainelEmissao tipo="NFS-e" certOk={!!certOk}/></TabsContent>
          <TabsContent value="emitidas" className="mt-6"><NotasEmitidasPanel/></TabsContent>
        </Tabs>
      )}

      <Sheet open={configOpen} onOpenChange={setConfigOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Configurações Fiscais</SheetTitle>
            <SheetDescription>Parametrize operações, impostos, certificado e integrações fiscais.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {CONFIG_GROUPS.map((grupo) => (
              <div key={grupo.titulo}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{grupo.titulo}</div>
                <div className="space-y-1">
                  {grupo.itens.map((it) => (
                    <button
                      key={it.key}
                      onClick={() => goConfig(it.key)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm text-left"
                    >
                      <span className="flex items-center gap-2">{it.icon}{it.label}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground"/>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}


function TabT({ v, i, children }: { v: string; i: React.ReactNode; children: React.ReactNode }) {
  return (
    <TabsTrigger value={v} className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
      {i}{children}
    </TabsTrigger>
  );
}

function Stat({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-display">{value}</div>
    </Card>
  );
}

function ResumoTipo({ titulo, notas }: { titulo: string; notas: NF[] }) {
  const aut = notas.filter((n) => n.status === "autorizada");
  const valor = aut.reduce((s, n) => s + Number(n.valor_total || 0), 0);
  return (
    <Card className="p-4">
      <h4 className="text-sm font-medium mb-3">{titulo}</h4>
      <Linha k="Total" v={notas.length}/>
      <Linha k="Autorizadas" v={aut.length}/>
      <Linha k="Rejeitadas" v={notas.filter((n) => n.status === "rejeitada").length}/>
      <Linha k="Canceladas" v={notas.filter((n) => n.status === "cancelada").length}/>
      <Linha k="Valor autorizado" v={BRL(valor)}/>
    </Card>
  );
}

function Linha({ k, v }: { k: string; v: any }) {
  return <div className="flex justify-between text-sm py-1.5 border-b last:border-0"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>;
}

function PainelEmissao({ tipo, certOk }: { tipo: string; certOk: boolean }) {
  const isNfse = tipo === "NFS-e";
  return (
    <Card className="p-6 space-y-3">
      <h2 className="text-lg font-medium">{tipo}</h2>
      {isNfse ? (
        <>
          <p className="text-sm text-muted-foreground">
            <strong>NFS-e</strong> será implementada após a NF-e em homologação concluir o piloto.
            Esta aba permanecerá apenas informativa até lá.
          </p>
          <div className="p-3 rounded-md bg-muted text-xs">
            Emissão de NFS-e desabilitada nesta fase. Use a aba <strong>NF-e</strong> ou abra um pedido
            e use <strong>Fiscal / Emitir nota</strong> para criar pré-nota.
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            A emissão de <strong>NF-e modelo 55</strong> em <strong>HOMOLOGAÇÃO</strong> roda no
            <strong> Backend fiscal próprio Alavanch</strong> (sem APIs terceiras). Abra a aba
            <strong> Notas Emitidas</strong>, selecione uma nota em rascunho e clique em
            <em> Emitir NF-e Homologação</em>.
          </p>
          {!certOk && (
            <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4"/> Certificado digital ausente ou pendente de validação.
            </div>
          )}
          <div className="p-3 rounded-md bg-muted text-xs">
            Endpoints do backend fiscal: <code>POST fiscal-nfe-emitir</code>, <code>POST fiscal-nfe-consultar</code>,
            <code> POST fiscal-nfe-cancelar</code> (cancelamento bloqueado nesta fase).
            <br/>Produção: <strong>bloqueada</strong> até validação completa em homologação.
          </div>
        </>
      )}
    </Card>
  );
}
