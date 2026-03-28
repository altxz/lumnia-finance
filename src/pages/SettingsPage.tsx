import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { AiSection } from '@/components/settings/AiSection';
import { AutomationSection } from '@/components/settings/AutomationSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { SecuritySection } from '@/components/settings/SecuritySection';
import { PlansSection } from '@/components/settings/PlansSection';
import { CategoriesSection } from '@/components/settings/CategoriesSection';
import { ModulesSection } from '@/components/settings/ModulesSection';
import { getCategoryInfo } from '@/lib/constants';
import { Loader2, Save, User, Sparkles, Zap, Bell, Shield, Crown, Tag, ToggleRight } from 'lucide-react';

const DEFAULT_SETTINGS = {
  full_name: '',
  avatar_url: '',
  bio: '',
  timezone: 'America/Sao_Paulo',
  currency: 'BRL',
  ai_auto_categorize: true,
  ai_min_confidence: 70,
  ai_learn_corrections: true,
  ai_model: 'gemini-flash',
  ai_personal_context: '',
  notify_email_weekly: true,
  notify_email_alerts: true,
  notify_email_news: false,
  notify_app_suggestions: true,
  notify_app_reminders: true,
  notify_app_achievements: true,
  plan: 'free',
};

export default function SettingsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalExpenses: 0, mostActiveMonth: '', favoriteCategory: '' });

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch or create settings
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
    if (data) {
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } else {
      // Create default settings
      await supabase.from('user_settings').insert({
        user_id: user.id,
        full_name: user.user_metadata?.full_name || '',
      });
    }

    // Fetch rules
    const { data: rulesData } = await supabase.from('automation_rules').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setRules(rulesData || []);

    // Fetch stats
    const { data: expenses } = await supabase.from('expenses').select('date, final_category').eq('user_id', user.id);
    if (expenses) {
      const monthCounts: Record<string, number> = {};
      const catCounts: Record<string, number> = {};
      expenses.forEach(e => {
        const month = e.date.slice(0, 7);
        monthCounts[month] = (monthCounts[month] || 0) + 1;
        catCounts[e.final_category] = (catCounts[e.final_category] || 0) + 1;
      });
      const topMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
      const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
      setStats({
        totalExpenses: expenses.length,
        mostActiveMonth: topMonth ? new Date(topMonth[0] + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '',
        favoriteCategory: topCat ? getCategoryInfo(topCat[0]).label : '',
      });
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('user_settings').update({
      full_name: settings.full_name,
      avatar_url: settings.avatar_url,
      bio: settings.bio,
      timezone: settings.timezone,
      currency: settings.currency,
      ai_auto_categorize: settings.ai_auto_categorize,
      ai_min_confidence: settings.ai_min_confidence,
      ai_learn_corrections: settings.ai_learn_corrections,
      ai_model: settings.ai_model,
      ai_personal_context: settings.ai_personal_context,
      notify_email_weekly: settings.notify_email_weekly,
      notify_email_alerts: settings.notify_email_alerts,
      notify_email_news: settings.notify_email_news,
      notify_app_suggestions: settings.notify_app_suggestions,
      notify_app_reminders: settings.notify_app_reminders,
      notify_app_achievements: settings.notify_app_achievements,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    if (error) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Configurações salvas!' }); setDirty(false); }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    // Delete user data then sign out
    if (!user) return;
    await supabase.from('expenses').delete().eq('user_id', user.id);
    await supabase.from('automation_rules').delete().eq('user_id', user.id);
    await supabase.from('user_settings').delete().eq('user_id', user.id);
    await supabase.from('categories').delete().eq('user_id', user.id);
    toast({ title: 'Conta excluída', description: 'Seus dados foram removidos.' });
    signOut();
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 sm:space-y-6 overflow-auto pb-24">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Configurações</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Personalize sua experiência no FinAI</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <Tabs defaultValue="profile" className="space-y-4 sm:space-y-6">
                <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
                  <TabsList className="rounded-xl bg-secondary/50 p-1 h-auto gap-1 w-max sm:w-auto sm:flex-wrap">
                    <TabsTrigger value="profile" className="rounded-lg gap-1 sm:gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm"><User className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Perfil</span><span className="sm:hidden">Perfil</span></TabsTrigger>
                    <TabsTrigger value="ai" className="rounded-lg gap-1 sm:gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm"><Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />IA</TabsTrigger>
                    <TabsTrigger value="automation" className="rounded-lg gap-1 sm:gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm"><Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Automação</span><span className="sm:hidden">Auto</span></TabsTrigger>
                    <TabsTrigger value="notifications" className="rounded-lg gap-1 sm:gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm"><Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Notificações</span><span className="sm:hidden">Notif.</span></TabsTrigger>
                    <TabsTrigger value="security" className="rounded-lg gap-1 sm:gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm"><Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden xs:inline">Segurança</span><span className="xs:hidden">Seg.</span></TabsTrigger>
                    <TabsTrigger value="categories" className="rounded-lg gap-1 sm:gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm"><Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Categorias</span><span className="sm:hidden">Cat.</span></TabsTrigger>
                    <TabsTrigger value="modules" className="rounded-lg gap-1 sm:gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm"><ToggleRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Módulos</span><span className="sm:hidden">Mód.</span></TabsTrigger>
                    <TabsTrigger value="plans" className="rounded-lg gap-1 sm:gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm"><Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />Planos</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="profile">
                  <ProfileSection settings={settings} onChange={handleChange} user={user} stats={stats} />
                </TabsContent>
                <TabsContent value="ai">
                  <AiSection settings={settings} onChange={handleChange} />
                </TabsContent>
                <TabsContent value="automation">
                  <AutomationSection rules={rules} onRulesChange={fetchSettings} userId={user.id} />
                </TabsContent>
                <TabsContent value="notifications">
                  <NotificationsSection settings={settings} onChange={handleChange} />
                </TabsContent>
                <TabsContent value="security">
                  <SecuritySection user={user} onDeleteAccount={handleDeleteAccount} />
                </TabsContent>
                <TabsContent value="categories">
                  <CategoriesSection />
                </TabsContent>
                <TabsContent value="modules">
                  <ModulesSection />
                </TabsContent>
                <TabsContent value="plans">
                  <PlansSection plan={settings.plan} expenseCount={stats.totalExpenses} />
                </TabsContent>
              </Tabs>
            )}
          </main>

          {/* Fixed save footer */}
          {dirty && (
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t p-4 flex items-center justify-end gap-3">
              <p className="text-sm text-muted-foreground mr-auto">Você tem alterações não salvas</p>
              <Button variant="outline" onClick={fetchSettings} className="rounded-xl">Descartar</Button>
              <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
