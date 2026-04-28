import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Clientes from "@/pages/Clientes";
import Orcamentos from "@/pages/Orcamentos";
import Pedidos from "@/pages/Pedidos";

import Revisao from "@/pages/Revisao";
import Financeiro from "@/pages/Financeiro";
import FinanceiroKanban from "@/pages/FinanceiroKanban";
import Montagem from "@/pages/Montagem";
import Entrega from "@/pages/Entrega";
import AcompanhamentoProd from "@/pages/AcompanhamentoProd";
import PosMontagem from "@/pages/PosMontagem";
import Ocorrencias from "@/pages/Ocorrencias";
import Relatorios from "@/pages/Relatorios";
import Radar from "@/pages/Radar";
import Configuracoes from "@/pages/Configuracoes";
import Arquivo from "@/pages/Arquivo";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <AppLayout />
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
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
              <Route path="/" element={<Dashboard />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/orcamentos" element={<Orcamentos />} />
              <Route path="/pedidos" element={<Pedidos />} />
              
              <Route path="/revisao" element={<Revisao />} />
              <Route path="/acompanhamento-producao" element={<AcompanhamentoProd />} />
              <Route path="/entrega" element={<Entrega />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/financeiro-kanban" element={<FinanceiroKanban />} />
              <Route path="/montagem" element={<Montagem />} />
              <Route path="/pos-montagem" element={<PosMontagem />} />
              <Route path="/ocorrencias" element={<Ocorrencias />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/radar" element={<Radar />} />
              <Route path="/administracao" element={<Configuracoes />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/arquivo" element={<Arquivo />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
