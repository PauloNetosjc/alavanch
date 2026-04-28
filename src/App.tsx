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
              <Route path="/ranking" element={<Placeholder title="Ranking / Metas" />} />
              <Route path="/relatorios" element={<Placeholder title="Relatórios" />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/comercial" element={<Placeholder title="Comercial" subtitle="Gestão de orçamentos e vendas" />} />
              <Route path="/comercial/novo" element={<Placeholder title="Novo Orçamento" />} />
              <Route path="/radar" element={<Placeholder title="Radar de Prazos" subtitle="Acompanhamento de datas críticas" />} />
              <Route path="/assistencia" element={<Placeholder title="Assistência Técnica" />} />
              <Route path="/montagem" element={<Placeholder title="Meus Chamados" subtitle="App do montador" />} />
              <Route path="/ocorrencias" element={<Placeholder title="Ocorrências" />} />
              <Route path="/administracao" element={<Placeholder title="Administração" subtitle="Gerenciamento completo do sistema" />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
