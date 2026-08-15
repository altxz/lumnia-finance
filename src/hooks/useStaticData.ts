import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { STATIC_STALE_TIME } from '@/lib/queryClient';

/**
 * Dados quase estáticos (categorias, carteiras, cartões).
 * Ficam em cache por 30 min e são compartilhados por todas as telas,
 * evitando que cada componente refaça a mesma busca.
 * O useRealtimeSync invalida estas chaves quando algo muda no banco.
 */

export interface DbCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
  keywords?: string[] | null;
  active?: boolean;
  sort_order?: number;
}

export function useCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, icon, color, parent_id, keywords, active, sort_order')
        .eq('user_id', user!.id)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as DbCategory[];
    },
    enabled: !!user,
    staleTime: STATIC_STALE_TIME,
  });
}

export function useWalletsList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wallets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user!.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: STATIC_STALE_TIME,
  });
}

export function useCreditCardsList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['credit-cards', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user!.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: STATIC_STALE_TIME,
  });
}
