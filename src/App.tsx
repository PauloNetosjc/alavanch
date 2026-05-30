import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LojaProvider } from "@/contexts/LojaContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
const Dashboard = lazy(() => import("@/pages/Dashboard"));
import { RequirePermission } from "@/components/RequirePermission";
import KanbanGuard from "@/components/KanbanGuard";
import { RequireModulo } from "@/components/RequireModulo";

const GestaoBases = lazy(() => import("@/pages/GestaoBases"));
const PainelMaster = lazy(() => import("@/pages/PainelMaster"));
const CobrancasSaaS = lazy(() => import("@/pages/CobrancasSaaS"));
const ComunicadosSaaS = lazy(() => import("@/pages/ComunicadosSaaS"));
const ModelosContratoSaaS = lazy(() => import("@/pages/ModelosContratoSaaS"));
const EmpresaSaaS = lazy(() => import("@/pages/sistema-saas/EmpresaSaaS"));
const FinanceiroSaaS = lazy(() => import("@/pages/sistema-saas/FinanceiroSaaS"));
const CrmSaaS = lazy(() => import("@/pages/sistema-saas/CrmSaaS"));
const AgendaSaaS = lazy(() => import("@/pages/sistema-saas/AgendaSaaS"));

// Páginas pesadas em lazy load para reduzir bundle inicial e evitar tela branca
const Configuracoes = lazy(() => import("@/pages/Configuracoes"));
const InfoSistema = lazy(() => import("@/pages/InfoSistema"));
const CargosAdmin = lazy(() => import("@/pages/CargosAdmin"));
const Placeholder = lazy(() => import("@/pages/Placeholder"));
const Clientes = lazy(() => import("@/pages/Clientes"));
const Comercial = lazy(() => import("@/pages/Comercial"));
const KanbanComercial = lazy(() => import("@/pages/KanbanComercial"));

const KanbanPosVenda = lazy(() => import("@/pages/KanbanPosVenda"));
const KanbanRevisao = lazy(() => import("@/pages/KanbanRevisao"));
const KanbanMontagem = lazy(() => import("@/pages/KanbanMontagem"));
const KanbanFabrica = lazy(() => import("@/pages/KanbanFabrica"));
const Kanbans = lazy(() => import("@/pages/Kanbans"));
const ComercialNovo = lazy(() => import("@/pages/ComercialNovo"));
const ComercialNegociacao = lazy(() => import("@/pages/ComercialNegociacao"));
const Administracao = lazy(() => import("@/pages/Administracao"));
const TarefasNativasAdmin = lazy(() => import("@/pages/TarefasNativasAdmin"));
const RadarPrazos = lazy(() => import("@/pages/RadarPrazos"));
const Assistencia = lazy(() => import("@/pages/Assistencia"));
const MeusChamados = lazy(() => import("@/pages/MeusChamados"));
const MeuChamadoDetalhe = lazy(() => import("@/pages/MeuChamadoDetalhe"));
const ChecklistTemplates = lazy(() => import("@/pages/ChecklistTemplates"));
const ChecklistAssistencia = lazy(() => import("@/pages/ChecklistAssistencia"));
const SimuladorAutomacoes = lazy(() => import("@/pages/SimuladorAutomacoes"));
const Montagem = lazy(() => import("@/pages/Montagem"));
const Ocorrencias = lazy(() => import("@/pages/Ocorrencias"));
const Ranking = lazy(() => import("@/pages/Ranking"));
const Relatorios = lazy(() => import("@/pages/Relatorios"));
const Comissoes = lazy(() => import("@/pages/Comissoes"));
const ContratoAssinar = lazy(() => import("@/pages/ContratoAssinar"));
const ContratoVisualizar = lazy(() => import("@/pages/ContratoVisualizar"));
const PedidoDetalhe = lazy(() => import("@/pages/PedidoDetalhe"));
const PedidoReceita = lazy(() => import("@/pages/PedidoReceita"));
const ContasCorrentes = lazy(() => import("@/pages/ContasCorrentes"));
const ContasAPagar = lazy(() => import("@/pages/ContasAPagar"));
const ContasAReceber = lazy(() => import("@/pages/ContasAReceber"));
const AprovadorFinanceiro = lazy(() => import("@/pages/AprovadorFinanceiro"));
const ExtratoConta = lazy(() => import("@/pages/ExtratoConta"));
const CategoriasFinanceiras = lazy(() => import("@/pages/CategoriasFinanceiras"));
const CentrosCusto = lazy(() => import("@/pages/CentrosCusto"));
const AuditoriaParceiros = lazy(() => import("@/pages/AuditoriaParceiros"));
const Parceiros = lazy(() => import("@/pages/Parceiros"));
const Financeiro = lazy(() => import("@/pages/Financeiro"));
const AnaliseFinanceira = lazy(() => import("@/pages/AnaliseFinanceira"));
const RelatoriosFinanceiros = lazy(() => import("@/pages/RelatoriosFinanceiros"));
const NotasFiscais = lazy(() => import("@/pages/NotasFiscais"));
const Agenda = lazy(() => import("@/pages/Agenda"));
const Autorizacoes = lazy(() => import("@/pages/Autorizacoes"));
const AssinaturaPublica = lazy(() => import("@/pages/AssinaturaPublica"));
const ValidarContrato = lazy(() => import("@/pages/ValidarContrato"));

const Assinaturas = lazy(() => import("@/pages/Assinaturas"));
const Origens = lazy(() => import("@/pages/Origens"));
const Fornecedores = lazy(() => import("@/pages/Fornecedores"));
const Aniversariantes = lazy(() => import("@/pages/Aniversariantes"));
const Produtos = lazy(() => import("@/pages/Produtos"));
const RH = lazy(() => import("@/pages/RH"));
const BaterPonto = lazy(() => import("@/pages/BaterPonto"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Fallback vazio para evitar flash de "Carregando…" em cada navegação lazy.
// O conteúdo da rota anterior permanece visível até o próximo chunk resolver.
const PageFallback = () => null;

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-[12px] text-muted-foreground animate-pulse">Carregando…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Login />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <LojaProvider>
            <BrandingProvider>
            <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/contrato/:token" element={<ContratoAssinar />} />
              <Route path="/assinatura/:token" element={<AssinaturaPublica />} />
              <Route path="/validar-contrato" element={<ValidarContrato />} />
              <Route path="/validar-contrato/:token" element={<ValidarContrato />} />

              <Route element={<ProtectedRoutes />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/ranking" element={<Ranking />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/comissoes" element={<Comissoes />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/aniversariantes" element={<Aniversariantes />} />
                <Route path="/produtos" element={<Produtos />} />
                <Route path="/comercial" element={<Comercial />} />
                <Route path="/comercial/kanban" element={<Navigate to="/kanban-comercial" replace />} />
                <Route path="/comercial/novo" element={<ComercialNovo />} />
                <Route path="/comercial/:id" element={<ComercialNovo />} />
                <Route path="/comercial/:id/negociacao" element={<ComercialNegociacao />} />
                <Route path="/contratos/:id" element={<ContratoVisualizar />} />
                <Route path="/pedidos/:id" element={<PedidoDetalhe />} />
                <Route path="/pedidos/:id/receita" element={<PedidoReceita />} />
                <Route path="/radar" element={<RadarPrazos />} />
                <Route path="/kanbans" element={<KanbanGuard chave="crm_comercial"><Kanbans /></KanbanGuard>} />
                <Route path="/kanban-comercial" element={<KanbanGuard chave="crm_comercial"><KanbanComercial /></KanbanGuard>} />
                <Route path="/kanban-operacional" element={<Navigate to="/kanbans" replace />} />
                <Route path="/kanban-pos-venda" element={<KanbanGuard chave="pos_venda"><KanbanPosVenda /></KanbanGuard>} />
                <Route path="/kanban-revisao" element={<KanbanGuard chave="revisao"><KanbanRevisao /></KanbanGuard>} />
                <Route path="/kanban-montagem" element={<KanbanGuard chave="montagem"><KanbanMontagem /></KanbanGuard>} />
                <Route path="/kanban-fabrica" element={<RequireModulo modulo="fabrica" nome="Fábrica"><RequirePermission modulo="fabrica_lotes"><KanbanFabrica /></RequirePermission></RequireModulo>} />
                {/* Aliases antigos */}
                <Route path="/operacional/kanban" element={<Navigate to="/kanbans" replace />} />
                <Route path="/operacional/pos-venda" element={<Navigate to="/kanban-pos-venda" replace />} />
                <Route path="/operacional/revisao" element={<Navigate to="/kanban-revisao" replace />} />
                <Route path="/operacional/montagem-kanban" element={<Navigate to="/kanban-montagem" replace />} />
                <Route path="/operacional/fabrica" element={<Navigate to="/kanban-fabrica" replace />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/autorizacoes" element={<Autorizacoes />} />
                <Route path="/assinaturas" element={<Assinaturas />} />
                <Route path="/assistencia" element={<Assistencia />} />
                <Route path="/meus-chamados" element={<MeusChamados />} />
                <Route path="/meus-chamados/:id" element={<MeuChamadoDetalhe />} />
                <Route path="/montagem" element={<Montagem />} />
                <Route path="/ocorrencias" element={<Ocorrencias />} />
                <Route path="/administracao" element={<Administracao />} />
                <Route path="/administracao/checklist-templates" element={<ChecklistTemplates />} />
                <Route path="/administracao/checklist-assistencia" element={<ChecklistAssistencia />} />
                <Route path="/administracao/simulador-automacoes" element={<SimuladorAutomacoes />} />
                <Route path="/administracao/tarefas-nativas" element={<TarefasNativasAdmin />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/sistema/info" element={<InfoSistema />} />
                <Route path="/sistema/cargos" element={<RequirePermission modulo="cargos"><CargosAdmin /></RequirePermission>} />
                <Route path="/financeiro" element={<RequirePermission modulo="lancamentos"><Financeiro /></RequirePermission>} />
                <Route path="/financeiro/analise" element={<RequirePermission modulo="lancamentos"><AnaliseFinanceira /></RequirePermission>} />
                <Route path="/financeiro/analise/:id" element={<RequirePermission modulo="lancamentos"><AnaliseFinanceira /></RequirePermission>} />
                <Route path="/financeiro/relatorios" element={<RequirePermission modulo="relatorios_financeiros"><RelatoriosFinanceiros /></RequirePermission>} />
                <Route path="/financeiro/a-pagar" element={<RequirePermission modulo="lancamentos"><ContasAPagar /></RequirePermission>} />
                <Route path="/financeiro/a-receber" element={<RequirePermission modulo="lancamentos"><ContasAReceber /></RequirePermission>} />
                <Route path="/financeiro/aprovador" element={<RequirePermission modulo="lancamentos"><AprovadorFinanceiro /></RequirePermission>} />
                <Route path="/notas-fiscais" element={<RequireModulo modulo="notas_fiscais" nome="Notas Fiscais"><RequirePermission modulo="notas_fiscais"><NotasFiscais /></RequirePermission></RequireModulo>} />
                <Route path="/rh" element={<RequireModulo modulo="rh" nome="RH"><RequirePermission modulo="rh"><RH /></RequirePermission></RequireModulo>} />
                <Route path="/bater-ponto" element={<RequireModulo modulo="bater_ponto" nome="Bater Ponto"><RequirePermission modulo="bater_ponto"><BaterPonto /></RequirePermission></RequireModulo>} />
                <Route path="/sistema/gestao-modulos" element={<Navigate to="/sistema/gestao-bases" replace />} />
                <Route path="/sistema/gestao-bases" element={<RequirePermission modulo="sistema.gestao_bases"><GestaoBases /></RequirePermission>} />
                <Route path="/sistema/gestao-bases/cobrancas" element={<Navigate to="/sistema-saas/financeiro?aba=receber" replace />} />
                <Route path="/sistema/gestao-bases/comunicados" element={<RequirePermission modulo="sistema.comunicados_saas"><ComunicadosSaaS /></RequirePermission>} />
                <Route path="/sistema/gestao-bases/modelos-contrato" element={<RequirePermission modulo="sistema.modelos_contrato_saas"><ModelosContratoSaaS /></RequirePermission>} />
                <Route path="/sistema-saas/empresa" element={<RequirePermission modulo="sistema.empresa_saas"><EmpresaSaaS /></RequirePermission>} />
                <Route path="/sistema-saas/financeiro" element={<RequirePermission modulo="sistema.financeiro_saas"><FinanceiroSaaS /></RequirePermission>} />
                <Route path="/sistema/painel-master" element={<RequirePermission modulo="sistema.painel_master"><PainelMaster /></RequirePermission>} />
                <Route path="/contas" element={<RequirePermission modulo="contas"><ContasCorrentes /></RequirePermission>} />
                <Route path="/contas/:id/extrato" element={<RequirePermission modulo="extrato"><ExtratoConta /></RequirePermission>} />
                <Route path="/categorias-financeiras" element={<RequirePermission modulo="categorias_financeiras"><CategoriasFinanceiras /></RequirePermission>} />
                <Route path="/centros-custo" element={<RequirePermission modulo="centros_custo"><CentrosCusto /></RequirePermission>} />
                <Route path="/auditoria-parceiros" element={<RequirePermission modulo="auditoria_parceiros"><AuditoriaParceiros /></RequirePermission>} />
                <Route path="/parceiros" element={<RequirePermission modulo="parceiros"><Parceiros /></RequirePermission>} />
                <Route path="/origens" element={<Origens />} />
                <Route path="/fornecedores" element={<Fornecedores />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </BrandingProvider>
            </LojaProvider>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
