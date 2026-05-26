import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { UserThemePicker, useUserThemeBoot } from "@/components/UserThemePicker";
import {
  LayoutDashboard,
  Trophy,
  BarChart3,
  Users,
  Briefcase,
  Clock,
  Wrench,
  Hammer,
  KanbanSquare,
  Settings,
  FileText,
  ListChecks,
  Wallet,
  Folder,
  ClipboardCheck,
  Building2,
  CalendarDays,
  ShieldCheck,
  LifeBuoy,
  Zap,
  PenLine,
  MoreHorizontal,
  X,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ContactRound,
  Truck,
  Banknote,
  Cog,
  Cake,
  Package,
  Shield,
  Tags,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";

import { usePermissions } from "@/hooks/usePermissions";

type Item = { label: string; path: string; icon: React.ComponentType<{ className?: string }>; modulo?: string; roles?: string[] };
type Section = { label: string; items: Item[] };
type Group = { label: string; icon: React.ComponentType<{ className?: string }>; items: Item[] };

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
      { label: "Agenda", path: "/agenda", icon: CalendarDays },
      { label: "Kanbans", path: "/kanbans", icon: KanbanSquare },
      { label: "Comercial", path: "/comercial", icon: Briefcase },
      { label: "Meus Chamados", path: "/meus-chamados", icon: FileText },
      { label: "Autorizações", path: "/autorizacoes", icon: ShieldCheck, roles: ["admin", "diretor"] },
    ],
  },
  {
    label: "Operação",
    items: [
      { label: "Fábrica", path: "/kanban-fabrica", icon: Building2 },
      { label: "Entrega e Montagem", path: "/montagem", icon: Hammer },
      { label: "Assistência Técnica", path: "/assistencia", icon: Wrench },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { label: "Financeiro", path: "/financeiro", icon: Wallet, modulo: "lancamentos" },
      { label: "Notas Fiscais", path: "/notas-fiscais", icon: FileText, modulo: "lancamentos" },
    ],
  },
];

// Configuração do sistema agrupada em sub-menus expansíveis
const moreGroups: Group[] = [
  {
    label: "Cadastros",
    icon: ContactRound,
    items: [
      { label: "Usuários", path: "/administracao?tab=usuarios", icon: Users, roles: ["admin"] },
      { label: "Lojas", path: "/administracao?tab=lojas", icon: Building2, roles: ["admin"] },
      { label: "Etiquetas", path: "/administracao?tab=etiquetas", icon: Tags, roles: ["admin"] },
      { label: "Clientes", path: "/clientes", icon: Users },
      { label: "Parceiros", path: "/parceiros", icon: Building2, modulo: "parceiros" },
      { label: "Origens", path: "/origens", icon: Folder },
      { label: "Fornecedores", path: "/fornecedores", icon: Truck },
      { label: "Aniversariantes do Mês", path: "/aniversariantes", icon: Cake },
      { label: "Cadastro de Produtos", path: "/produtos", icon: Package },
    ],
  },
  {
    label: "Financeiro",
    icon: Banknote,
    items: [
      { label: "Descontos", path: "/administracao?tab=descontos", icon: Folder, roles: ["admin"] },
      
      { label: "Bancos", path: "/administracao?tab=bancos", icon: Banknote, roles: ["admin"] },
      { label: "Pagamentos", path: "/administracao?tab=pagamentos", icon: Wallet, roles: ["admin"] },
      { label: "Categorias", path: "/administracao?tab=categorias", icon: Folder, roles: ["admin"] },
    ],
  },
  {
    label: "Sistema",
    icon: Cog,
    items: [
      { label: "Info Sistema", path: "/sistema/info", icon: Cog, roles: ["admin"] },
      { label: "Cargos", path: "/sistema/cargos", icon: Shield, roles: ["admin"] },
      { label: "Assinaturas Digitais", path: "/assinaturas", icon: PenLine },
      { label: "Configurações", path: "/configuracoes", icon: Settings },
      { label: "Agenda", path: "/administracao?tab=agenda", icon: CalendarDays, roles: ["admin"] },
      
      { label: "Simulador de automações", path: "/administracao/simulador-automacoes", icon: Zap, roles: ["admin"] },
    ],
  },
  {
    label: "Documentos",
    icon: FileText,
    items: [
      { label: "Modelos de Checklist", path: "/administracao/checklist-templates", icon: ListChecks, roles: ["admin"] },
      { label: "Checklist Assistência", path: "/administracao/checklist-assistencia", icon: LifeBuoy, roles: ["admin"] },
      { label: "Contrato", path: "/administracao?tab=contrato", icon: FileText, roles: ["admin"] },
    ],
  },

];



const noScrollbar = "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]";

function SectionFull({ section, pathname, onNavigate }: { section: Section; pathname: string; onNavigate?: () => void }) {
  return (
    <div className="mt-2">
      <div className="px-6 pt-3 pb-1.5 text-[9px] uppercase" style={{ color: "#444", letterSpacing: "0.12em" }}>
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
                background: active ? "var(--user-accent-bg, #1F1F1F)" : "transparent",
                color: active ? "#FFFFFF" : "#888888",
                fontSize: "12.5px",
              }}
            >
              <span className="inline-block rounded-full" style={{ width: 4, height: 4, background: active ? "hsl(var(--user-accent, 38 45% 55%))" : "#444" }} />
              <it.icon className={active ? "w-3.5 h-3.5 text-white" : "w-3.5 h-3.5 text-[#666]"} />
              <span className="flex-1">{it.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

function SectionIcons({ section, pathname, onNavigate }: { section: Section; pathname: string; onNavigate?: () => void }) {
  return (
    <div className="mt-2 flex flex-col items-center gap-1 px-1">
      {section.items.map((it) => {
        const active = pathname.startsWith(it.path);
        return (
          <NavLink
            key={it.path}
            to={it.path}
            onClick={onNavigate}
            title={it.label}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{
              width: 36,
              height: 36,
              background: active ? "var(--user-accent-bg, #1F1F1F)" : "transparent",
              color: active ? "#FFFFFF" : "#888888",
            }}
          >
            <it.icon className="w-4 h-4" />
          </NavLink>
        );
      })}
    </div>
  );
}

function GroupAccordion({ group, pathname, search, onNavigate }: { group: Group; pathname: string; search: string; onNavigate?: () => void }) {
  const basePath = (p: string) => p.split("?")[0];
  const tabOf = (p: string) => {
    const q = p.split("?")[1];
    if (!q) return null;
    return new URLSearchParams(q).get("tab");
  };
  const currentTab = new URLSearchParams(search).get("tab");
  const isItemActive = (itemPath: string) => {
    const bp = basePath(itemPath);
    if (!pathname.startsWith(bp)) return false;
    const itTab = tabOf(itemPath);
    if (itTab) return currentTab === itTab;
    // Item without tab matches only when no tab is selected (or path is deeper)
    return pathname !== bp ? true : !currentTab;
  };
  const hasActive = group.items.some((it) => isItemActive(it.path));
  const [open, setOpen] = useState(hasActive);
  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 rounded-md transition-colors hover:bg-[#1A1A1A]"
        style={{ color: hasActive ? "#FFFFFF" : "#CCCCCC" }}
      >
        <span style={hasActive ? { color: "hsl(var(--user-accent, 38 45% 55%))" } : { color: "#888" }} className="inline-flex"><group.icon className="w-3.5 h-3.5" /></span>
        <span className="flex-1 text-left text-[12.5px] font-medium">{group.label}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-[#666]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#666]" />}
      </button>
      {open && (
        <div className="px-2 mt-0.5 flex flex-col gap-0.5">
          {group.items.map((it) => {
            const active = isItemActive(it.path);
            return (
              <NavLink
                key={it.path}
                to={it.path}
                onClick={onNavigate}
                className="flex items-center gap-2.5 rounded-md transition-colors"
                style={{
                  padding: "6px 14px 6px 32px",
                  background: active ? "var(--user-accent-bg, #1F1F1F)" : "transparent",
                  color: active ? "#FFFFFF" : "#888888",
                  fontSize: "12px",
                }}
              >
                <span className="inline-block rounded-full" style={{ width: 4, height: 4, background: active ? "hsl(var(--user-accent, 38 45% 55%))" : "#444" }} />
                <it.icon className={active ? "w-3.5 h-3.5 text-white" : "w-3.5 h-3.5 text-[#666]"} />
                <span className="flex-1">{it.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname, search } = useLocation();
  const { user, signOut, profile, role } = useAuth();
  useUserThemeBoot();
  const { nome: brandNome, logoUrl } = useBranding();
  const { can } = usePermissions();
  const [moreOpen, setMoreOpen] = useState(false);
  const [userCollapsed, setUserCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("sidebar_collapsed") === "1"; } catch { return false; }
  });
  const toggleCollapse = () => {
    setUserCollapsed((v) => {
      const nv = !v;
      try { localStorage.setItem("sidebar_collapsed", nv ? "1" : "0"); } catch {}
      return nv;
    });
  };

  const filterItems = (items: Item[]) =>
    items.filter((it) => {
      if (it.modulo && !can(it.modulo, "view")) return false;
      if (it.roles && !it.roles.includes(role || "")) return false;
      return true;
    });
  const filterSection = (s: Section) => ({ ...s, items: filterItems(s.items) });
  const filterGroup = (g: Group) => ({ ...g, items: filterItems(g.items) });
  const visibleSections = sections.map(filterSection).filter((s) => s.items.length > 0);
  const visibleMoreGroups = moreGroups.map(filterGroup).filter((g) => g.items.length > 0);

  const initials = (profile?.nome_completo || user?.email || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const collapsed = moreOpen || userCollapsed;

  return (
    <div className="flex h-full" style={{ background: "#0F0F0F" }}>
      {/* Main sidebar (collapses to icons when more is open) */}
      <div
        className="flex flex-col h-full transition-[width] duration-200"
        style={{ width: collapsed ? 56 : 220, background: "#0F0F0F", borderRight: collapsed ? "0.5px solid #222" : "none" }}
      >
        {/* Top: brand */}
        <div className={collapsed ? "px-2 pt-5 pb-4 flex justify-center" : "px-5 pt-5 pb-4"}>
          {collapsed ? (
            <div className="w-7 h-7 rounded-md flex items-center justify-center overflow-hidden shrink-0" style={{ background: "#1A1A1A", border: "0.5px solid #333" }}>
              {logoUrl ? (
                <img src={logoUrl} alt={brandNome} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[11px] font-medium text-white">{(brandNome || "P").trim().charAt(0).toUpperCase()}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md flex items-center justify-center overflow-hidden shrink-0" style={{ background: "#1A1A1A", border: "0.5px solid #333" }}>
                {logoUrl ? (
                  <img src={logoUrl} alt={brandNome} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[11px] font-medium text-white">{(brandNome || "P").trim().charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="leading-tight min-w-0 flex-1">
                <div className="text-[13px] font-medium text-white tracking-[0.02em] truncate" title={brandNome}>{brandNome}</div>
                <div className="text-[9px] uppercase text-[#555] tracking-[0.12em] mt-0.5">Sistema</div>
              </div>
              {!moreOpen && (
                <button onClick={toggleCollapse} title="Recolher menu" className="text-[#666] hover:text-white transition-colors">
                  <ChevronsLeft className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          {collapsed && !moreOpen && (
            <button onClick={toggleCollapse} title="Expandir menu" className="mt-2 mx-auto block text-[#666] hover:text-white transition-colors">
              <ChevronsRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sections */}
        <nav className={`flex-1 overflow-y-auto pb-4 ${noScrollbar}`}>
          {visibleSections.map((section) => {
            const handleNav = () => { setMoreOpen(false); onNavigate?.(); };
            return collapsed ? (
              <SectionIcons key={section.label} section={section} pathname={pathname} onNavigate={handleNav} />
            ) : (
              <SectionFull key={section.label} section={section} pathname={pathname} onNavigate={handleNav} />
            );
          })}
        </nav>

        {/* More toggle */}
        {visibleMoreGroups.length > 0 && (
          <div className={collapsed ? "px-2 pb-2 flex justify-center" : "px-4 pb-2"}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={
                collapsed
                  ? "flex items-center justify-center rounded-md transition-colors hover:bg-[#1A1A1A]"
                  : "w-full flex items-center justify-center gap-2 rounded-md py-2 transition-colors hover:bg-[#1A1A1A]"
              }
              style={{
                color: moreOpen ? "#FFF" : "#888",
                border: "0.5px solid #222",
                width: collapsed ? 36 : undefined,
                height: collapsed ? 36 : undefined,
                background: moreOpen ? "#1F1F1F" : "transparent",
              }}
              aria-label="Mais opções"
            >
              <MoreHorizontal className="w-4 h-4" />
              {!collapsed && <span className="text-[11px] uppercase tracking-[0.12em]">Mais</span>}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className={collapsed ? "px-2 pt-3 pb-4 flex justify-center" : "px-4 pt-3 pb-4"} style={{ borderTop: "0.5px solid #222" }}>
          {collapsed ? (
            <button
              onClick={() => signOut()}
              title={profile?.nome_completo || user?.email || ""}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium"
              style={{ background: "#C9B99A", color: "#1A1A1A" }}
            >
              {initials}
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium text-white" style={{ background: "#C9B99A", color: "#1A1A1A" }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-[#CCC] truncate">{profile?.nome_completo || user?.email}</div>
                <div className="text-[10px] text-[#555] uppercase tracking-wider">{role || "—"}</div>
              </div>
              <UserThemePicker />
              <button onClick={() => signOut()} className="text-[10px] uppercase tracking-wider text-[#666] hover:text-white transition-colors">
                Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Secondary panel: Configuração Sistema (grupos expansíveis) */}
      {moreOpen && (
        <div
          className="flex flex-col h-full"
          style={{ width: 260, background: "#0F0F0F", borderRight: "0.5px solid #222" }}
        >
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div className="text-[11px] uppercase text-[#CCC] tracking-[0.12em]">Configuração Sistema</div>
            <button
              onClick={() => setMoreOpen(false)}
              className="text-[#666] hover:text-white transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <nav className={`flex-1 overflow-y-auto pb-4 ${noScrollbar}`}>
            {visibleMoreGroups.map((group) => (
              <GroupAccordion key={group.label} group={group} pathname={pathname} search={search} onNavigate={onNavigate} />
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside
      className="hidden md:flex shrink-0 flex-col h-screen sticky top-0"
      style={{ background: "#0F0F0F" }}
    >
      <SidebarInner />
    </aside>
  );
}
