import {
  LayoutDashboard, FileText, ShoppingCart,
  ClipboardCheck, Factory, Truck, Wrench, PackageCheck, DollarSign,
  AlertTriangle, BarChart3, Settings, LogOut, TreePine, Archive, Users, Radar
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
  SidebarHeader, useSidebar,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

const menuItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, adminOnly: true },
  { title: 'Orçamentos', url: '/orcamentos', icon: FileText },
  { title: 'Pedidos', url: '/pedidos', icon: ShoppingCart },
  { title: 'Revisão', url: '/revisao', icon: ClipboardCheck },
  { title: 'Acomp. Produção', url: '/acompanhamento-producao', icon: Factory },
  { title: 'Entrega', url: '/entrega', icon: Truck },
  { title: 'Montagem', url: '/montagem', icon: Wrench },
  { title: 'Pós-montagem', url: '/pos-montagem', icon: PackageCheck },
  { title: 'Financeiro', url: '/financeiro', icon: DollarSign },
  { title: 'Radar de Prazos', url: '/radar', icon: Radar },
  { title: 'Ocorrências', url: '/ocorrencias', icon: AlertTriangle },
  { title: 'Relatórios', url: '/relatorios', icon: BarChart3 },
  { title: 'Arquivo', url: '/arquivo', icon: Archive },
  { title: 'Administração', url: '/administracao', icon: Settings, adminOnly: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [openOccurrences, setOpenOccurrences] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_roles').select('role').eq('user_id', user.id).then(({ data }) => {
      setIsAdmin(data?.some(r => r.role === 'admin') ?? false);
    });
  }, [user]);

  useEffect(() => {
    const loadCount = async () => {
      const { count } = await supabase
        .from('occurrences')
        .select('id', { count: 'exact', head: true })
        .in('status', ['aberta', 'em_analise']);
      setOpenOccurrences(count ?? 0);
    };
    loadCount();
    const ch = supabase
      .channel('sidebar-occurrences')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'occurrences' }, loadCount)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const visibleItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
            <TreePine className="h-5 w-5 text-sidebar-accent-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-sm font-semibold text-sidebar-foreground tracking-wide">
                Forest Decor
              </span>
              <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">
                Sistema
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <Separator className="bg-sidebar-border" />

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="flex-1">{item.title}</span>}
                      {!collapsed && item.url === '/ocorrencias' && openOccurrences > 0 && (
                        <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">{openOccurrences}</Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <Separator className="bg-sidebar-border mb-2" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              tooltip="Sair"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
