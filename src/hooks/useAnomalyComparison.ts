import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { FINANCIAL_STALE_TIME } from '@/lib/queryClient';

/**
 * Comparação de gastos por categoria: mês selecionado (até hoje) vs mesmo
 * período do mês anterior.
 *
 * Antes o `useAnomalyAlerts` e o `AnomalyInsights` faziam exatamente as mesmas
 * duas consultas em paralelo (4 requisições para o mesmo resultado). Agora
 * partilham esta chave em cache.
 */

export interface AnomalyRow {
  category: string;
  current: number;
  previous: number;
  pctChange: number;
}

function sumByCategory(rows: any[]) {
  const m: Record<string, number> = {};
  (rows || []).forEach(r => {
    m[r.final_category] = (m[r.final_category] || 0) + r.value;
  });
  return m;
}

export function useAnomalyComparison() {
  const { user } = useAuth();
  const { selectedMonth, selectedYear } = useSelectedDate();
  const dayOfMonth = new Date().getDate();

  const curStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
  const curEnd = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;

  const prevM = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const prevY = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const lastDayOfPrevMonth = new Date(prevY, prevM + 1, 0).getDate();
  const clampedDay = Math.min(dayOfMonth, lastDayOfPrevMonth);
  const prevStart = `${prevY}-${String(prevM + 1).padStart(2, '0')}-01`;
  const prevEnd = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;

  const { data } = useQuery({
    queryKey: ['analytics', 'anomaly', user?.id, curStart, curEnd, prevStart, prevEnd],
    queryFn: async () => {
      const [{ data: curData }, { data: prevData }] = await Promise.all([
        supabase.from('expenses').select('final_category, value, type').eq('user_id', user!.id)
          .neq('type', 'income').neq('type', 'transfer').gte('date', curStart).lte('date', curEnd),
        supabase.from('expenses').select('final_category, value, type').eq('user_id', user!.id)
          .neq('type', 'income').neq('type', 'transfer').gte('date', prevStart).lte('date', prevEnd),
      ]);

      const curSums = sumByCategory(curData || []);
      const prevSums = sumByCategory(prevData || []);
      const allCats = new Set([...Object.keys(curSums), ...Object.keys(prevSums)]);

      const rows: AnomalyRow[] = [];
      allCats.forEach(category => {
        const current = curSums[category] || 0;
        const previous = prevSums[category] || 0;
        if (previous < 10) return; // ignora categorias irrelevantes
        rows.push({
          category,
          current,
          previous,
          pctChange: ((current - previous) / previous) * 100,
        });
      });
      return rows;
    },
    enabled: !!user,
    staleTime: FINANCIAL_STALE_TIME,
  });

  return data ?? [];
}
