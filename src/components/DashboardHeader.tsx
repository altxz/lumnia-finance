import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, Sun, Moon, Monitor, Plus } from 'lucide-react';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { useSidebar } from '@/components/ui/sidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { useTheme } from 'next-themes';

export function DashboardHeader() {
  const { user, signOut } = useAuth();
  const { toggleSidebar } = useSidebar();
  const { theme, setTheme } = useTheme();
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_settings')
      .select('avatar_url, full_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      });
  }, [user]);

  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-4 lg:px-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="rounded-xl">
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-bold hidden sm:block">Painel de Despesas</h2>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden sm:flex items-center gap-3">
          <Avatar className="h-9 w-9 border-2 border-primary/20">
            <AvatarImage src={avatarUrl || undefined} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">
            Olá, <span className="font-semibold text-foreground">{displayName}</span>
          </span>
        </div>

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Alternar tema</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
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

        {/* Desktop add button */}
        <Button
          onClick={() => setAddModalOpen(true)}
          size="sm"
          className="hidden md:inline-flex gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" />
          Nova Transação
        </Button>

        <NotificationBell />
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 rounded-xl">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>

      <AddExpenseModal open={addModalOpen} onOpenChange={setAddModalOpen} onExpenseAdded={() => {}} />
    </header>
  );
}
