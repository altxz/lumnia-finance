import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { STATIC_STALE_TIME } from '@/lib/queryClient';

/**
 * Fonte única da linha `user_settings`.
 *
 * Antes existiam 4 leitores independentes (contexto de módulos, cabeçalho,
 * tour guiado e página de configurações), o que gerava 5-6 requisições
 * idênticas em TODOS os ecrãs. Agora todos partilham esta chave em cache.
 */

export const USER_SETTINGS_QUERY_KEY = 'user-settings';

export interface UserSettingsRow {
  [key: string]: any;
  full_name?: string | null;
  avatar_url?: string | null;
  onboarding_completed?: boolean;
  enable_budget_module?: boolean;
  enable_projects_module?: boolean;
  enable_crypto_module?: boolean;
}

export function useUserSettingsRow() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [USER_SETTINGS_QUERY_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as UserSettingsRow | null;
    },
    enabled: !!user,
    staleTime: STATIC_STALE_TIME,
  });
}

/** Invalida (e opcionalmente atualiza de imediato) a linha em cache. */
export function useInvalidateUserSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return {
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: [USER_SETTINGS_QUERY_KEY, user?.id] }),
    patch: (partial: Partial<UserSettingsRow>) =>
      queryClient.setQueryData(
        [USER_SETTINGS_QUERY_KEY, user?.id],
        (prev: UserSettingsRow | null | undefined) => ({ ...(prev || {}), ...partial }),
      ),
  };
}
