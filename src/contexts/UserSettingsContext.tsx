import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface UserSettings {
  enable_budget_module: boolean;
  enable_projects_module: boolean;
  enable_crypto_module: boolean;
  onboarding_completed: boolean;
}

interface UserSettingsContextType {
  settings: UserSettings;
  loading: boolean;
  updateSetting: (key: keyof UserSettings, value: boolean) => Promise<void>;
  refetch: () => void;
}

const defaults: UserSettings = {
  enable_budget_module: true,
  enable_projects_module: true,
  enable_crypto_module: true,
  onboarding_completed: false,
};

const UserSettingsContext = createContext<UserSettingsContextType>({
  settings: defaults,
  loading: true,
  updateSetting: async () => {},
  refetch: () => {},
});

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaults);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_settings')
      .select('enable_budget_module, enable_projects_module, enable_crypto_module, onboarding_completed')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setSettings({
        enable_budget_module: data.enable_budget_module ?? true,
        enable_projects_module: data.enable_projects_module ?? true,
        enable_crypto_module: data.enable_crypto_module ?? true,
        onboarding_completed: data.onboarding_completed ?? false,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateSetting = async (key: keyof UserSettings, value: boolean) => {
    if (!user) return;
    setSettings(prev => ({ ...prev, [key]: value }));
    await supabase
      .from('user_settings')
      .update({ [key]: value, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
  };

  return (
    <UserSettingsContext.Provider value={{ settings, loading, updateSetting, refetch: fetch }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  return useContext(UserSettingsContext);
}
