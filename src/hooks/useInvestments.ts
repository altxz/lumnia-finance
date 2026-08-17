import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Investment, InvestmentMovement } from '@/lib/investmentMath';

export interface InvestmentWithMovements {
  inv: Investment;
  movements: InvestmentMovement[];
}

export function useInvestments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['investments', user?.id],
    queryFn: async (): Promise<InvestmentWithMovements[]> => {
      const [{ data: invData, error: invErr }, { data: movData, error: movErr }] = await Promise.all([
        supabase.from('investments').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
        supabase.from('investment_movements').select('*').eq('user_id', user!.id).order('date'),
      ]);
      if (invErr) throw invErr;
      if (movErr) throw movErr;
      const movements = (movData || []) as unknown as InvestmentMovement[];
      return ((invData || []) as unknown as Investment[]).map(inv => ({
        inv,
        movements: movements.filter(m => m.investment_id === inv.id),
      }));
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['investments', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['wallets', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['projected-totals'] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
  };

  return { ...query, invalidate };
}
