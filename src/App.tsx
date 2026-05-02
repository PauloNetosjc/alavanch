import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LojaProvider } from "@/contexts/LojaContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { AppLayout } from "@/components/AppLayout";
import Configuracoes from "@/pages/Configuracoes";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Placeholder from "@/pages/Placeholder";
import Dashboard from "@/pages/Dashboard";
import Clientes from "@/pages/Clientes";
import Leads from "@/pages/Leads";
import Comercial from "@/pages/Comercial";
import KanbanComercial from "@/pages/KanbanComercial";
import ComercialNovo from "@/pages/ComercialNovo";
import ComercialNegociacao from "@/pages/ComercialNegociacao";
import Administracao from "@/pages/Administracao";
import RadarPrazos from "@/pages/RadarPrazos";
import Assistencia from "@/pages/Assistencia";
import MeusChamados from "@/pages/MeusChamados";
import MeuChamadoDetalhe from "@/pages/MeuChamadoDetalhe";
import ChecklistTemplates from "@/pages/ChecklistTemplates";
import Montagem from "@/pages/Montagem";
import Ocorrencias from "@/pages/Ocorrencias";
import Ranking from "@/pages/Ranking";
import Relatorios from "@/pages/Relatorios";
import ContratoAssinar from "@/pages/ContratoAssinar";
import ContratoVisualizar from "@/pages/ContratoVisualizar";
import PedidoDetalhe from "@/pages/PedidoDetalhe";
import ContasCorrentes from "@/pages/ContasCorrentes";
import ExtratoConta from "@/pages/ExtratoConta";
import CategoriasFinanceiras from "@/pages/CategoriasFinanceiras";
import AuditoriaParceiros from "@/pages/AuditoriaParceiros";
import Parceiros from "@/pages/Parceiros";
import Financeiro from "@/pages/Financeiro";
import AnaliseFinanceira from "@/pages/AnaliseFinanceira";
import NotasFiscais from "@/pages/NotasFiscais";
import { RequirePermission } from "@/components/RequirePermission";

const queryClient = new QueryClient();

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
        <AuthProvider>
          <LojaProvider>
          <BrandingProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/contrato/:token" element={<ContratoAssinar />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/comercial" element={<Comercial />} />
              <Route path="/comercial/kanban" element={<KanbanComercial />} />
              <Route path="/comercial/novo" element={<ComercialNovo />} />
              <Route path="/comercial/:id" element={<ComercialNovo />} />
              <Route path="/comercial/:id/negociacao" element={<ComercialNegociacao />} />
              <Route path="/contratos/:id" element={<ContratoVisualizar />} />
              <Route path="/pedidos/:id" element={<PedidoDetalhe />} />
              <Route path="/radar" element={<RadarPrazos />} />
              <Route path="/assistencia" element={<Assistencia />} />
              <Route path="/meus-chamados" element={<MeusChamados />} />
              <Route path="/meus-chamados/:id" element={<MeuChamadoDetalhe />} />
              <Route path="/montagem" element={<Montagem />} />
              <Route path="/ocorrencias" element={<Ocorrencias />} />
              <Route path="/administracao" element={<Administracao />} />
              <Route path="/administracao/checklist-templates" element={<ChecklistTemplates />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/financeiro" element={<RequirePermission modulo="lancamentos"><Financeiro /></RequirePermission>} />
              <Route path="/financeiro/analise" element={<RequirePermission modulo="lancamentos"><AnaliseFinanceira /></RequirePermission>} />
              <Route path="/financeiro/analise/:id" element={<RequirePermission modulo="lancamentos"><AnaliseFinanceira /></RequirePermission>} />
              <Route path="/notas-fiscais" element={<RequirePermission modulo="lancamentos"><NotasFiscais /></RequirePermission>} />
              <Route path="/contas" element={<RequirePermission modulo="contas"><ContasCorrentes /></RequirePermission>} />
              <Route path="/contas/:id/extrato" element={<RequirePermission modulo="extrato"><ExtratoConta /></RequirePermission>} />
              <Route path="/categorias-financeiras" element={<RequirePermission modulo="categorias_financeiras"><CategoriasFinanceiras /></RequirePermission>} />
              <Route path="/auditoria-parceiros" element={<RequirePermission modulo="auditoria_parceiros"><AuditoriaParceiros /></RequirePermission>} />
              <Route path="/parceiros" element={<RequirePermission modulo="parceiros"><Parceiros /></RequirePermission>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrandingProvider>
          </LojaProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
