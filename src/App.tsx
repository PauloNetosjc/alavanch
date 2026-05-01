import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Placeholder from "@/pages/Placeholder";
import Dashboard from "@/pages/Dashboard";
import Clientes from "@/pages/Clientes";
import Leads from "@/pages/Leads";
import Comercial from "@/pages/Comercial";
import ComercialNovo from "@/pages/ComercialNovo";
import ComercialDetalhe from "@/pages/ComercialDetalhe";
import ComercialNegociacao from "@/pages/ComercialNegociacao";
import Administracao from "@/pages/Administracao";
import RadarPrazos from "@/pages/RadarPrazos";
import Assistencia from "@/pages/Assistencia";
import Montagem from "@/pages/Montagem";
import Ocorrencias from "@/pages/Ocorrencias";
import Ranking from "@/pages/Ranking";
import Relatorios from "@/pages/Relatorios";
import ContratoAssinar from "@/pages/ContratoAssinar";
import ContratoVisualizar from "@/pages/ContratoVisualizar";

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
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/comercial" element={<Comercial />} />
              <Route path="/comercial/novo" element={<ComercialNovo />} />
             <Route path="/comercial/:id" element={<ComercialDetalhe />} />
             <Route path="/comercial/:id/negociacao" element={<ComercialNegociacao />} />
              <Route path="/radar" element={<RadarPrazos />} />
              <Route path="/assistencia" element={<Assistencia />} />
              <Route path="/montagem" element={<Montagem />} />
              <Route path="/ocorrencias" element={<Ocorrencias />} />
              <Route path="/administracao" element={<Administracao />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
