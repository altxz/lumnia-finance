import { LayoutDashboard, Settings, BarChart3, Wallet, PiggyBank, ArrowLeftRight, DollarSign, FolderKanban, Calculator, Activity } from 'lucide-react';
import { Logo } from '@/components/Logo';
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
  useSidebar,
} from '@/components/ui/sidebar';

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const { settings } = useUserSettings();

  const items = [
    { title: 'Dashboard', url: '/', icon: LayoutDashboard, visible: true },
    { title: 'Transações', url: '/historico', icon: ArrowLeftRight, visible: true },
    { title: 'Orçamento', url: '/orcamento', icon: PiggyBank, visible: settings.enable_budget_module },
    { title: 'Projetos', url: '/projetos', icon: FolderKanban, visible: settings.enable_projects_module },
    { title: 'Minha Carteira', url: '/wallet', icon: Wallet, visible: true },
    { title: 'Simulador Dívidas', url: '/simulador-dividas', icon: Calculator, visible: true },
    { title: 'Score Financeiro', url: '/score-financeiro', icon: Activity, visible: true },
    { title: 'Configurações', url: '/configuracoes', icon: Settings, visible: true },
  ];

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
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
                      onClick={handleNavClick}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
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
