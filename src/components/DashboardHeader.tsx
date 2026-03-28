import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Menu } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export function DashboardHeader() {
  const { user, signOut } = useAuth();
  const { toggleSidebar } = useSidebar();
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
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
        <NotificationBell />
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 rounded-xl">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}
