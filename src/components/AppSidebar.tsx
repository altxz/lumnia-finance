import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Settings, Wallet, PiggyBank, ArrowLeftRight, FolderKanban, Calculator, Activity, Sparkles } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useNavigate } from 'react-router-dom';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { LATEST_CHANGELOG_ID } from '@/pages/ChangelogPage';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

function useChangelogUnread() {
  const [hasUnread, setHasUnread] = useState(false);

  const check = useCallback(() => {
    const lastRead = localStorage.getItem('lumnia_changelog_read');
    setHasUnread(lastRead !== LATEST_CHANGELOG_ID);
  }, []);

  useEffect(() => {
    check();
    window.addEventListener('changelog-read', check);
    return () => window.removeEventListener('changelog-read', check);
  }, [check]);

  return hasUnread;
}

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const { settings } = useUserSettings();
  const hasUnread = useChangelogUnread();
  const navigate = useNavigate();

  const items = [
    { title: 'Dashboard', url: '/', icon: LayoutDashboard, visible: true, badge: false },
    { title: 'Transações', url: '/historico', icon: ArrowLeftRight, visible: true, badge: false },
    { title: 'Orçamento', url: '/orcamento', icon: PiggyBank, visible: settings.enable_budget_module, badge: false },
    { title: 'Projetos', url: '/projetos', icon: FolderKanban, visible: settings.enable_projects_module, badge: false },
    { title: 'Minha Carteira', url: '/wallet', icon: Wallet, visible: true, badge: false },
    { title: 'Simulador Dívidas', url: '/simulador-dividas', icon: Calculator, visible: true, badge: false },
    
    { title: 'Novidades', url: '/novidades', icon: Sparkles, visible: true, badge: hasUnread },
    { title: 'Configurações', url: '/configuracoes', icon: Settings, visible: true, badge: false },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    if (isMobile) {
      e.preventDefault();
      setOpenMobile(false);
      // Navigate after sidebar closes to avoid blocking the animation
      setTimeout(() => navigate(url), 150);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src="/logo-sidebar-light.svg" alt="Lumnia" className="shrink-0 dark:hidden" style={{ height: 70 }} />
          <img src="/logo-sidebar.svg" alt="Lumnia" className="shrink-0 hidden dark:block" style={{ height: 70 }} />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted">Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.filter(i => i.visible).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      onClick={(e) => handleNavClick(e, item.url)}
                    >
                      <div className="relative">
                        <item.icon className="h-4 w-4" />
                        {item.badge && (
                          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-sidebar animate-pulse" />
                        )}
                      </div>
                      {!collapsed && (
                        <span className="flex items-center gap-2">
                          {item.title}
                          {item.badge && (
                            <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
