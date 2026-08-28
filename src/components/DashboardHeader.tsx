import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { BarChart3, FolderKanban, LogOut, Menu, Moon, Monitor, Plus, Settings, Sparkles, Sun, TrendingUp, Wallet } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { lazyNamedWithRetry } from '@/lib/lazyWithRetry';

const AddExpenseModal = lazyNamedWithRetry(() => import('@/components/AddExpenseModal'), m => m.AddExpenseModal);
import { NotificationBell } from '@/components/NotificationBell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getAvatarSignedUrl } from '@/lib/avatarUrl';
import { useUserSettingsRow } from '@/hooks/useUserSettingsRow';

import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';

interface ProfileDropdownProps {
  avatarUrl: string | null;
  displayName: string;
  initials: string;
  signOut: () => Promise<void>;
  desktop?: boolean;
}

function ProfileDropdown({ avatarUrl, displayName, initials, signOut, desktop = false }: ProfileDropdownProps) {
  const navigate = useNavigate();
  const destinations = [
    { label: 'Patrimônio', path: '/wallet', icon: Wallet },
    { label: 'Análises', path: '/analytics', icon: BarChart3 },
    { label: 'Projetos', path: '/projetos', icon: FolderKanban },
    { label: 'Investimentos', path: '/investimentos', icon: TrendingUp },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Abrir perfil e configurações">
          <Avatar className={desktop ? 'h-9 w-9 border-2 border-card shadow-soft' : 'h-10 w-10 border border-border/60 shadow-soft'}>
            <AvatarImage src={avatarUrl || undefined} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="floating-glass w-56 rounded-2xl p-2">
        <DropdownMenuLabel className="px-3 py-2">
          <span className="block truncate text-sm text-foreground">{displayName}</span>
          <span className="block text-[11px] font-normal text-muted-foreground">Conta Lumnia</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {destinations.map(item => (
          <DropdownMenuItem key={item.path} onClick={() => navigate(item.path)} className="cursor-pointer gap-2 rounded-xl">
            <item.icon className="h-4 w-4" />{item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/configuracoes')} className="cursor-pointer gap-2 rounded-xl">
          <Settings className="h-4 w-4" />Configurações
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void signOut()} className="cursor-pointer gap-2 rounded-xl text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" />Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardHeader() {
  const { user, signOut } = useAuth();
  const { toggleSidebar } = useSidebar();
  const { setTheme } = useTheme();
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // Avatar vem da linha `user_settings` em cache — sem requisição própria.
  const { data: settingsRow } = useUserSettingsRow();

  useEffect(() => {
    let active = true;
    getAvatarSignedUrl(settingsRow?.avatar_url).then(signed => {
      if (active) setAvatarUrl(signed);
    });
    return () => { active = false; };
  }, [settingsRow?.avatar_url]);


  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 grid h-24 grid-cols-[40px_minmax(0,1fr)_120px] items-center border-b border-border/55 bg-background/88 px-4 pt-6 backdrop-blur-xl md:flex md:h-16 md:justify-between md:pt-0 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hidden rounded-full md:inline-flex">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="md:hidden"><ProfileDropdown avatarUrl={avatarUrl} displayName={displayName} initials={initials} signOut={signOut} /></div>
        <h2 className="hidden text-lg font-medium tracking-tight md:block">Painel de Despesas</h2>
      </div>

      <div className="pointer-events-none flex min-w-0 justify-center px-2 md:hidden" aria-label="Lumnia">
        <img src="/brand-logo-black.svg" alt="Lumnia" className="h-6 max-w-full dark:hidden" />
        <img src="/brand-logo-white.svg" alt="Lumnia" className="hidden h-6 max-w-full dark:block" />
      </div>

      <div className="flex min-w-0 items-center justify-end gap-0 md:gap-2 lg:gap-3">
        <div className="hidden items-center gap-2 md:flex sm:gap-3">
          <ProfileDropdown avatarUrl={avatarUrl} displayName={displayName} initials={initials} signOut={signOut} desktop />
          <span className="hidden sm:inline text-sm text-muted-foreground">
            Olá, <span className="font-semibold text-foreground">{displayName}</span>
          </span>
        </div>

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Alternar tema</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl">
            <DropdownMenuItem onClick={() => setTheme('light')} className="gap-2 cursor-pointer">
              <Sun className="h-4 w-4" /> Claro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')} className="gap-2 cursor-pointer">
              <Moon className="h-4 w-4" /> Escuro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')} className="gap-2 cursor-pointer">
              <Monitor className="h-4 w-4" /> Sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => window.dispatchEvent(new CustomEvent('lumnia:toggle-ai'))}
          aria-label="Abrir inteligência Lumnia"
        >
          <Sparkles className="h-4 w-4" />
        </Button>

        {/* Desktop add button */}
        <Button
          onClick={() => setAddModalOpen(true)}
          size="sm"
          variant="gradient"
          className="hidden md:inline-flex gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova Transação
        </Button>

        <NotificationBell />
      </div>

      {addModalOpen && (
        <Suspense fallback={null}>
          <AddExpenseModal open={addModalOpen} onOpenChange={setAddModalOpen} onExpenseAdded={() => {}} />
        </Suspense>
      )}
    </header>
  );
}
