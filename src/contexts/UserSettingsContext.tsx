import React, { createContext, useContext, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettingsRow, useInvalidateUserSettings } from '@/hooks/useUserSettingsRow';
import type { Database } from '@/integrations/supabase/types';

type UserSettingsUpdate = Database['public']['Tables']['user_settings']['Update'];

interface UserSettings {
  enable_budget_module: boolean;
  enable_projects_module: boolean;
  enable_crypto_module: boolean;
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
};

const UserSettingsContext = createContext<UserSettingsContextType>({
  settings: defaults,
  loading: true,
  updateSetting: async () => {},
  refetch: () => {},
});

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Linha `user_settings` vem do cache partilhado — nenhuma requisição extra.
  const { data: row, isLoading } = useUserSettingsRow();
  const { invalidate, patch } = useInvalidateUserSettings();

  const settings = useMemo<UserSettings>(() => ({
    enable_budget_module: row?.enable_budget_module ?? true,
    enable_projects_module: row?.enable_projects_module ?? true,
    enable_crypto_module: row?.enable_crypto_module ?? true,
  }), [row]);

  const updateSetting = async (key: keyof UserSettings, value: boolean) => {
    if (!user) return;
    patch({ [key]: value });
    const update = { [key]: value, updated_at: new Date().toISOString() } as UserSettingsUpdate;
    await supabase
      .from('user_settings')
      .update(update)
      .eq('user_id', user.id);
  };

  return (
    <UserSettingsContext.Provider
      value={{ settings, loading: !!user && isLoading, updateSetting, refetch: invalidate }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  return useContext(UserSettingsContext);
}
