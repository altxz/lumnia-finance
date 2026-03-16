import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Menu } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';

export function DashboardHeader() {
  const { user, signOut } = useAuth();
  const { toggleSidebar } = useSidebar();
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-4 lg:px-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="lg:hidden rounded-xl">
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-bold hidden sm:block">Painel de Despesas</h2>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          Olá, <span className="font-semibold text-foreground">{displayName}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 rounded-xl">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}
