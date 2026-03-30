import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { getCategoryLabel, formatCurrency } from '@/lib/constants';
import type { SmartAlert } from '@/components/SmartAlertsCarousel';

export function useAnomalyAlerts(): SmartAlert[] {
  const { user } = useAuth();
  const { selectedMonth, selectedYear } = useSelectedDate();
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date();
      const dayOfMonth = today.getDate();

      const curStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const curEnd = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;

      const prevM = selectedMonth === 0 ? 11 : selectedMonth - 1;
      const prevY = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
      const lastDayOfPrevMonth = new Date(prevY, prevM + 1, 0).getDate();
      const clampedDay = Math.min(dayOfMonth, lastDayOfPrevMonth);
      const prevStart = `${prevY}-${String(prevM + 1).padStart(2, '0')}-01`;
      const prevEnd = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;

      const [{ data: curData }, { data: prevData }] = await Promise.all([
        supabase.from('expenses').select('final_category, value, type').eq('user_id', user.id).neq('type', 'income').neq('type', 'transfer').gte('date', curStart).lte('date', curEnd),
        supabase.from('expenses').select('final_category, value, type').eq('user_id', user.id).neq('type', 'income').neq('type', 'transfer').gte('date', prevStart).lte('date', prevEnd),
      ]);

      const sumByCategory = (rows: any[]) => {
        const m: Record<string, number> = {};
        (rows || []).forEach(r => { m[r.final_category] = (m[r.final_category] || 0) + r.value; });
        return m;
      };

      const curSums = sumByCategory(curData || []);
      const prevSums = sumByCategory(prevData || []);

      const allCats = new Set([...Object.keys(curSums), ...Object.keys(prevSums)]);
      const results: SmartAlert[] = [];

      allCats.forEach(cat => {
        const cur = curSums[cat] || 0;
        const prev = prevSums[cat] || 0;
        if (prev < 10) return;

        const pct = ((cur - prev) / prev) * 100;
        const label = getCategoryLabel(cat);

        if (pct > 30) {
          results.push({
            id: `anomaly-up-${cat}`,
            type: 'critical',
            icon: 'alert',
            title: `Aumento em ${label}`,
            description: `+${Math.round(pct)}% vs mês anterior (${formatCurrency(prev)} → ${formatCurrency(cur)})`,
          });
        } else if (pct < -20) {
          results.push({
            id: `anomaly-down-${cat}`,
            type: 'positive',
            icon: 'trophy',
            title: `Economia em ${label}`,
            description: `${Math.abs(Math.round(pct))}% a menos (${formatCurrency(prev)} → ${formatCurrency(cur)})`,
          });
        }
      });

      results.sort((a, b) => {
        if (a.type === 'critical' && b.type !== 'critical') return -1;
        if (a.type !== 'critical' && b.type === 'critical') return 1;
        return 0;
      });

      setAlerts(results.slice(0, 5));
    })();
  }, [user, selectedMonth, selectedYear]);

  return alerts;
}
