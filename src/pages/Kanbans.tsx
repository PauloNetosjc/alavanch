import { Navigate } from "react-router-dom";
// Página unificada substituída por rotas dedicadas (otimização). Redireciona para o CRM Comercial.
export default function Kanbans() {
  return <Navigate to="/kanban-comercial" replace />;
}
