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
  KanbanSquare,
  AlertTriangle,
  Settings,
  FileText,
  ListChecks,
  Wallet,
  Folder,
  ClipboardCheck,
  Building2,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";

import { usePermissions } from "@/hooks/usePermissions";

type Item = { label: string; path: string; icon: React.ComponentType<{ className?: string }>; modulo?: string; roles?: string[] };
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
      { label: "Kanbans", path: "/kanbans", icon: KanbanSquare },
      { label: "Radar de Prazos", path: "/radar", icon: Clock },
      { label: "Assistência Técnica", path: "/assistencia", icon: Wrench },
      { label: "Meus Chamados", path: "/meus-chamados", icon: FileText },
    ],
  },
  {
    label: "Operação",
    items: [
      { label: "Agenda", path: "/agenda", icon: CalendarDays },
      { label: "Agenda", path: "/agenda", icon: CalendarDays },
      { label: "Montagem", path: "/montagem", icon: Hammer },
      { label: "Ocorrências", path: "/ocorrencias", icon: AlertTriangle },
    ],
  },
  {
    label: "Administrativo",
    items: [
      { label: "Financeiro", path: "/financeiro", icon: Wallet, modulo: "lancamentos" },
      { label: "Notas Fiscais", path: "/notas-fiscais", icon: FileText, modulo: "lancamentos" },
      { label: "Contas Correntes", path: "/contas", icon: Wallet, modulo: "contas" },
      { label: "Categorias", path: "/categorias-financeiras", icon: Folder, modulo: "categorias_financeiras" },
      { label: "Auditoria de Parceiros", path: "/auditoria-parceiros", icon: ClipboardCheck, modulo: "auditoria_parceiros" },
      { label: "Parceiros", path: "/parceiros", icon: Building2, modulo: "parceiros" },
    ],
  },
  {
    label: "Configuração",
    items: [
      { label: "Configurações", path: "/configuracoes", icon: Settings },
      { label: "Autorizações", path: "/autorizacoes", icon: ShieldCheck, roles: ["admin", "diretor"] },
      { label: "Administração (Usuários)", path: "/administracao", icon: Users },
      { label: "Modelos de Checklist", path: "/administracao/checklist-templates", icon: ListChecks },
    ],
  },
];

export function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { user, signOut, profile, role } = useAuth();
  const { nome: brandNome, logoUrl } = useBranding();
  const { can } = usePermissions();
  const visibleSections = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => {
        if (it.modulo && !can(it.modulo, "view")) return false;
        if (it.roles && !it.roles.includes(role || "")) return false;
        return true;
      }),
    }))
    .filter((s) => s.items.length > 0);

  const initials = (profile?.nome_completo || user?.email || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col h-full" style={{ background: "#0F0F0F" }}>
      {/* Top: brand */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center overflow-hidden shrink-0"
            style={{ background: "#1A1A1A", border: "0.5px solid #333" }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={brandNome} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] font-medium text-white">
                {(brandNome || "P").trim().charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-[13px] font-medium text-white tracking-[0.02em] truncate" title={brandNome}>
              {brandNome}
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
                    onClick={onNavigate}
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
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside
      className="hidden md:flex w-[220px] shrink-0 flex-col h-screen sticky top-0"
      style={{ background: "#0F0F0F", borderRight: "0.5px solid #222" }}
    >
      <SidebarInner />
    </aside>
  );
}
