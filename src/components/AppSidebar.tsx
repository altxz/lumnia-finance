import { LayoutDashboard, Settings, Wallet, PiggyBank, ArrowLeftRight, FolderKanban, Tag, TrendingUp } from 'lucide-react';
import { NavLink } from '@/components/NavLink';

import { useUserSettings } from '@/contexts/UserSettingsContext';
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
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const { settings } = useUserSettings();

  const items = [
    { title: 'Dashboard', url: '/', icon: LayoutDashboard, visible: true, badge: false },
    { title: 'Transações', url: '/historico', icon: ArrowLeftRight, visible: true, badge: false },
    { title: 'Categorias', url: '/categorias', icon: Tag, visible: true, badge: false },
    { title: 'Orçamento', url: '/orcamento', icon: PiggyBank, visible: settings.enable_budget_module, badge: false },
    { title: 'Projetos', url: '/projetos', icon: FolderKanban, visible: settings.enable_projects_module, badge: false },
    { title: 'Minha Carteira', url: '/wallet', icon: Wallet, visible: true, badge: false },
    { title: 'Investimentos', url: '/investimentos', icon: TrendingUp, visible: true, badge: false },
    { title: 'Configurações', url: '/configuracoes', icon: Settings, visible: true, badge: false },
  ];


  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Remove focus immediately to avoid lingering active/focus highlight
    (e.currentTarget as HTMLAnchorElement).blur();
    if (isMobile) {
      // Close the sidebar without blocking navigation; React Router handles routing via the Link
      setOpenMobile(false);
    }
  };

  const navItems = items.filter((i) => i.visible && i.url !== '/configuracoes');
  const settingsItem = items.find((i) => i.url === '/configuracoes');

  const renderItem = (item: (typeof items)[number]) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild tooltip={item.title}>
        <NavLink
          to={item.url}
          end={item.url === '/'}
          activeClassName="bg-sidebar-primary text-sidebar-primary-foreground shadow-float"
          onClick={handleNavClick}
        >
          <div className="relative">
            <item.icon className="h-[18px] w-[18px]" />
            {item.badge && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-sidebar animate-pulse" />
            )}
          </div>
          {!collapsed && (
            <span className="flex items-center gap-2">
              {item.title}
              {item.badge && <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className={collapsed ? 'p-2' : 'p-4'}>
        <div className="flex items-center justify-center gap-3">
          {collapsed ? (
            <img src="/brand-icon.png" alt="Lumnia" className="h-8 w-8 shrink-0 rounded-lg" />
          ) : (
            <>
              <img src="/brand-logo-color.svg" alt="Lumnia" className="h-10 w-auto shrink-0 dark:hidden" />
              <img src="/brand-logo-white.svg" alt="" aria-hidden className="hidden h-10 w-auto shrink-0 dark:block" />
            </>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-muted uppercase tracking-[0.18em] text-[10px]">
              Navegação
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">{navItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {settingsItem?.visible && (
        <SidebarFooter className="pb-20">
          <SidebarMenu>{renderItem(settingsItem)}</SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

