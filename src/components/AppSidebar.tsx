import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Trophy,
  BarChart3,
  Users,
  MessageSquare,
  Briefcase,
  Clock,
  Wrench,
  Hammer,
  AlertTriangle,
  Settings,
  FileText,
  ListChecks,
  Wallet,
  Folder,
  ClipboardCheck,
  Building2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

import { usePermissions } from "@/hooks/usePermissions";

type Item = { label: string; path: string; icon: React.ComponentType<{ className?: string }>; modulo?: string };
type Section = { label: string; items: Item[] };

const sections: Section[] = [
  {
    label: "Visão Geral",
    items: [
      { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { label: "Ranking / Metas", path: "/ranking", icon: Trophy },
      { label: "Relatórios", path: "/relatorios", icon: BarChart3 },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Clientes", path: "/clientes", icon: Users },
      { label: "CRM / Leads", path: "/leads", icon: MessageSquare },
      { label: "Comercial", path: "/comercial", icon: Briefcase },
      { label: "Radar de Prazos", path: "/radar", icon: Clock },
      { label: "Assistência Técnica", path: "/assistencia", icon: Wrench },
      { label: "Meus Chamados", path: "/meus-chamados", icon: FileText },
    ],
  },
  {
    label: "Operação",
    items: [
      { label: "Montagem", path: "/montagem", icon: Hammer },
      { label: "Ocorrências", path: "/ocorrencias", icon: AlertTriangle },
    ],
  },
  {
    label: "Administrativo",
    items: [
      { label: "Financeiro", path: "/financeiro", icon: Wallet, modulo: "lancamentos" },
      { label: "Contas Correntes", path: "/contas", icon: Wallet, modulo: "contas" },
      { label: "Categorias", path: "/categorias-financeiras", icon: Folder, modulo: "categorias_financeiras" },
      { label: "Auditoria de Parceiros", path: "/auditoria-parceiros", icon: ClipboardCheck, modulo: "auditoria_parceiros" },
      { label: "Parceiros", path: "/parceiros", icon: Building2, modulo: "parceiros" },
    ],
  },
  {
    label: "Configuração",
    items: [
      { label: "Administração", path: "/administracao", icon: Settings },
      { label: "Modelos de Checklist", path: "/administracao/checklist-templates", icon: ListChecks },
    ],
  },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { user, signOut, profile, role } = useAuth();
  const { can } = usePermissions();
  const visibleSections = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => !it.modulo || can(it.modulo, "view")),
    }))
    .filter((s) => s.items.length > 0);

  const initials = (profile?.nome_completo || user?.email || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      className="w-[220px] shrink-0 flex flex-col h-screen sticky top-0"
      style={{ background: "#0F0F0F", borderRight: "0.5px solid #222" }}
    >
      {/* Top: brand */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: "#1A1A1A", border: "0.5px solid #333" }}
          >
            <span className="text-[11px] font-medium text-white">P</span>
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-medium text-white tracking-[0.02em]">
              Planejados Pro
            </div>
            <div className="text-[9px] uppercase text-[#555] tracking-[0.12em] mt-0.5">
              Sistema
            </div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto pb-4">
        {visibleSections.map((section) => (
          <div key={section.label} className="mt-2">
            <div
              className="px-6 pt-3 pb-1.5 text-[9px] uppercase"
              style={{ color: "#444", letterSpacing: "0.12em" }}
            >
              {section.label}
            </div>
            <div className="px-2 flex flex-col gap-0.5">
              {section.items.map((it) => {
                const active = pathname.startsWith(it.path);
                return (
                  <NavLink
                    key={it.path}
                    to={it.path}
                    className="group flex items-center gap-2.5 rounded-md transition-colors"
                    style={{
                      padding: "7px 14px",
                      background: active ? "#1F1F1F" : "transparent",
                      color: active ? "#FFFFFF" : "#888888",
                      fontSize: "12.5px",
                    }}
                  >
                    <span
                      className="inline-block rounded-full"
                      style={{
                        width: 4,
                        height: 4,
                        background: active ? "#C9B99A" : "#444",
                      }}
                    />
                    <it.icon className={active ? "w-3.5 h-3.5 text-white" : "w-3.5 h-3.5 text-[#666]"} />
                    <span className="flex-1">{it.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 pt-3 pb-4" style={{ borderTop: "0.5px solid #222" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
            style={{ background: "#C9B99A", color: "#1A1A1A" }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-[#CCC] truncate">
              {profile?.nome_completo || user?.email}
            </div>
            <div className="text-[10px] text-[#555] uppercase tracking-wider">
              {role || "—"}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="text-[10px] uppercase tracking-wider text-[#666] hover:text-white transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
    </aside>
  );
}
