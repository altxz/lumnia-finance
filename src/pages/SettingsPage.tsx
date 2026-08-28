import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useUserSettingsRow, useInvalidateUserSettings } from '@/hooks/useUserSettingsRow';
import { useToast } from '@/hooks/use-toast';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { AutomationSection } from '@/components/settings/AutomationSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { SecuritySection } from '@/components/settings/SecuritySection';
import { CategoriesSection } from '@/components/settings/CategoriesSection';
import { Loader2, Save, User, Zap, Bell, Shield, Tag } from 'lucide-react';
import { PageLoadingSkeleton } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/ui/page-header';

const DEFAULT_SETTINGS = {
  full_name: '',
  avatar_url: '',
  default_wallet_id: null as string | null,
};

type SettingsState = typeof DEFAULT_SETTINGS;

interface AutomationRule {
  id: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  target_category: string;
  active: boolean;
  applied_count: number;
}

export default function SettingsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [rules, setRules] = useState<AutomationRule[]>([]);

  // A linha `user_settings` vem do cache partilhado (mesma chave do cabeçalho,
  // do tour e do contexto de módulos) — sem requisição duplicada.
  const { data: settingsRow, isLoading: settingsRowLoading } = useUserSettingsRow();
  const { invalidate: invalidateSettings } = useInvalidateUserSettings();

  useEffect(() => {
    if (settingsRowLoading || !user) return;
    if (dirty) return; // não sobrescreve edições ainda não salvas
    if (settingsRow) {
      setSettings({ ...DEFAULT_SETTINGS, ...settingsRow });
    } else {
      // Cria o registo padrão na primeira visita
      supabase
        .from('user_settings')
        .insert({ user_id: user.id, full_name: user.user_metadata?.full_name || '' })
        .then(() => invalidateSettings());
    }
  }, [settingsRow, settingsRowLoading, user, dirty, invalidateSettings]);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch rules
    const { data: rulesData } = await supabase.from('automation_rules').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setRules(rulesData || []);

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleChange = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('user_settings').update({
      full_name: settings.full_name,
      avatar_url: settings.avatar_url,
      default_wallet_id: settings.default_wallet_id || null,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    if (error) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    else {
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { ...user.user_metadata, full_name: settings.full_name },
      });
      if (metadataError) {
        toast({ title: 'Perfil salvo parcialmente', description: metadataError.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
      toast({ title: 'Configurações salvas!' });
      setDirty(false);
      invalidateSettings(); // mantém o cache partilhado atualizado (avatar, módulos…)
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) {
      toast({ title: 'Não foi possível excluir a conta', description: error.message, variant: 'destructive' });
      throw error;
    }
    toast({ title: 'Conta excluída', description: 'A conta e os dados associados foram removidos.' });
    await signOut();
  };

  const handleAvatarSaved = (avatarUrl: string) => {
    setSettings(prev => ({ ...prev, avatar_url: avatarUrl }));
    invalidateSettings();
  };

  const handleDiscard = () => {
    setSettings({ ...DEFAULT_SETTINGS, ...(settingsRow || {}) });
    setDirty(false);
  };

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 sm:space-y-6 overflow-auto pb-40 md:pb-24">
            <PageHeader
              eyebrow="Sua conta"
              title="Configurações"
              description="Preferências, automações, notificações e privacidade."
            />

            {(loading || authLoading) ? (
              <PageLoadingSkeleton title="Carregando configurações" compact />
            ) : (
              <Tabs defaultValue="profile" orientation="vertical" className="grid items-start gap-4 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-6">
                <TabsList className="floating-glass grid h-auto grid-cols-2 gap-2 rounded-3xl p-2 md:sticky md:top-24 md:grid-cols-1">
                  <TabsTrigger value="profile" className="min-h-[48px] justify-start gap-2 rounded-full px-4 text-sm"><User className="h-4 w-4" />Conta</TabsTrigger>
                  <TabsTrigger value="automation" className="min-h-[48px] justify-start gap-2 rounded-full px-4 text-sm"><Zap className="h-4 w-4" />Automação</TabsTrigger>
                  <TabsTrigger value="notifications" className="min-h-[48px] justify-start gap-2 rounded-full px-4 text-sm"><Bell className="h-4 w-4" />Notificações</TabsTrigger>
                  <TabsTrigger value="categories" className="min-h-[48px] justify-start gap-2 rounded-full px-4 text-sm"><Tag className="h-4 w-4" />Categorias</TabsTrigger>
                  <TabsTrigger value="security" className="col-span-2 min-h-[48px] justify-start gap-2 rounded-full px-4 text-sm md:col-span-1"><Shield className="h-4 w-4" />Dados e segurança</TabsTrigger>
                </TabsList>

                <div className="min-w-0">
                <TabsContent value="profile" className="settings-pane mt-0">
                  <ProfileSection settings={settings} onChange={handleChange} onAvatarSaved={handleAvatarSaved} user={user} />
                </TabsContent>
                <TabsContent value="automation" className="settings-pane mt-0">
                  <AutomationSection rules={rules} onRulesChange={fetchSettings} userId={user.id} />
                </TabsContent>
                <TabsContent value="notifications" className="settings-pane mt-0">
                  <NotificationsSection />
                </TabsContent>
                <TabsContent value="security" className="settings-pane mt-0">
                  <SecuritySection user={user} onDeleteAccount={handleDeleteAccount} />
                </TabsContent>
                <TabsContent value="categories" className="settings-pane mt-0">
                  <CategoriesSection />
                </TabsContent>
                </div>
              </Tabs>
            )}
          </main>

          {/* Fixed save footer */}
          {dirty && (
            <div className="fixed bottom-[calc(7.2rem+env(safe-area-inset-bottom))] left-3 right-3 z-50 floating-glass rounded-2xl p-3 flex flex-wrap items-center justify-end gap-2 md:bottom-0 md:left-0 md:right-0 md:rounded-none md:border-x-0 md:border-b-0 md:p-4">
              <p className="w-full text-xs text-muted-foreground md:mr-auto md:w-auto md:text-sm">Você tem alterações não salvas</p>
              <Button size="sm" variant="outline" onClick={handleDiscard} className="rounded-xl">Descartar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold gap-2">
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
