import { LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
  SidebarHeader, useSidebar,
} from '@/components/ui/sidebar';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Item = { title: string; url: string; adminOnly?: boolean };

const sections: { label: string; items: Item[] }[] = [
  {
    label: 'Principal',
    items: [
      { title: 'Dashboard', url: '/', adminOnly: true },
      { title: 'Orçamentos', url: '/orcamentos' },
      { title: 'Pedidos', url: '/pedidos' },
    ],
  },
  {
    label: 'Operação',
    items: [
      { title: 'Revisão', url: '/revisao' },
      { title: 'Acomp. Produção', url: '/acompanhamento-producao' },
      { title: 'Entrega', url: '/entrega' },
      { title: 'Montagem', url: '/montagem' },
      { title: 'Pós-montagem', url: '/pos-montagem' },
      { title: 'Radar de Prazos', url: '/radar' },
      { title: 'Ocorrências', url: '/ocorrencias' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { title: 'Financeiro', url: '/financeiro' },
      { title: 'Relatórios', url: '/relatorios' },
      { title: 'Arquivo', url: '/arquivo' },
      { title: 'Administração', url: '/administracao', adminOnly: true },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [openOccurrences, setOpenOccurrences] = useState(0);
  const [profileName, setProfileName] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    supabase.from('user_roles').select('role').eq('user_id', user.id).then(({ data }) => {
      setIsAdmin(data?.some(r => r.role === 'admin') ?? false);
    });
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle().then(({ data }) => {
      setProfileName((data as any)?.full_name ?? user.email ?? '');
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

  const isActive = (url: string) =>
    url === '/' ? location.pathname === '/' : location.pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon" style={{ background: '#0F0F0F' }}>
      <SidebarHeader className="px-4 pt-4 pb-3" style={{ background: '#0F0F0F' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{ background: '#1A1A1A', border: '0.5px solid #333' }}
          >
            <span style={{ color: '#C9B99A', fontSize: 11, fontWeight: 500 }}>F</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 500, letterSpacing: '0.02em' }}>
                Forest Decor
              </span>
              <span style={{ color: '#555555', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Sistema
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent style={{ background: '#0F0F0F' }} className="pt-2">
        {sections.map((section) => {
          const visible = section.items.filter((i) => !i.adminOnly || isAdmin);
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={section.label} className="px-0 py-1">
              {!collapsed && (
                <SidebarGroupLabel
                  style={{
                    color: '#444444',
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    padding: '12px 24px 6px',
                    height: 'auto',
                  }}
                >
                  {section.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible.map((item) => {
                    const active = isActive(item.url);
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild tooltip={item.title} className="hover:bg-transparent">
                          <NavLink
                            to={item.url}
                            end={item.url === '/'}
                            className="group flex items-center gap-2.5 rounded-md transition-colors"
                            style={{
                              padding: '7px 16px',
                              margin: '0 8px',
                              fontSize: 12.5,
                              fontWeight: 400,
                              color: active ? '#FFFFFF' : '#888888',
                              background: active ? '#1F1F1F' : 'transparent',
                            }}
                            onMouseEnter={(e) => {
                              if (!active) {
                                (e.currentTarget as HTMLElement).style.background = '#1A1A1A';
                                (e.currentTarget as HTMLElement).style.color = '#CCCCCC';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!active) {
                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                                (e.currentTarget as HTMLElement).style.color = '#888888';
                              }
                            }}
                          >
                            <span
                              className="shrink-0"
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: '50%',
                                background: active ? '#C9B99A' : '#444444',
                              }}
                            />
                            {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
                            {!collapsed && item.url === '/ocorrencias' && openOccurrences > 0 && (
                              <span
                                style={{
                                  background: '#1A1A1A',
                                  color: '#C9B99A',
                                  fontSize: 10,
                                  padding: '1px 6px',
                                  borderRadius: 20,
                                  border: '0.5px solid #333',
                                }}
                              >
                                {openOccurrences}
                              </span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter style={{ background: '#0F0F0F', borderTop: '0.5px solid #222' }} className="p-3">
        {!collapsed && (
          <div className="px-2 pb-2">
            <div style={{ color: '#888888', fontSize: 11 }} className="truncate">{profileName}</div>
            <div style={{ color: '#3A3A3A', fontSize: 10 }}>{isAdmin ? 'Administrador' : 'Usuário'}</div>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors"
          style={{ color: '#555555', fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#CCCCCC')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#555555')}
        >
          <LogOut className="h-3 w-3" />
          {!collapsed && <span>Sair</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
