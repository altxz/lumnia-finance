import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Trophy, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { getCategoryInfo, formatCurrency } from '@/lib/constants';

interface Insight {
  category: string;
  label: string;
  currentAmount: number;
  prevAmount: number;
  pctChange: number;
  type: 'alert' | 'celebration';
}

export function AnomalyInsights() {
  const { user } = useAuth();
  const { selectedMonth, selectedYear } = useSelectedDate();
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date();
      const dayOfMonth = today.getDate();

      // Current month range: 1st to today's day
      const curStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const curEnd = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;

      // Previous month same range
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
      const results: Insight[] = [];

      allCats.forEach(cat => {
        const cur = curSums[cat] || 0;
        const prev = prevSums[cat] || 0;
        if (prev < 10) return; // skip negligible categories

        const pct = ((cur - prev) / prev) * 100;
        const label = getCategoryInfo(cat).label;

        if (pct > 30) {
          results.push({ category: cat, label, currentAmount: cur, prevAmount: prev, pctChange: Math.round(pct), type: 'alert' });
        } else if (pct < -20) {
          results.push({ category: cat, label, currentAmount: cur, prevAmount: prev, pctChange: Math.round(pct), type: 'celebration' });
        }
      });

      results.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
      setInsights(results.slice(0, 5));
    })();
  }, [user, selectedMonth, selectedYear]);

  if (insights.length === 0) return null;

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {insights.map(i => (
        <Card
          key={i.category}
          className={`rounded-2xl border-border/50 ${
            i.type === 'alert'
              ? 'bg-destructive/5 border-destructive/20'
              : 'bg-emerald-500/5 border-emerald-500/20'
          }`}
        >
          <CardContent className="flex items-start gap-3 p-4">
            <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
              i.type === 'alert' ? 'bg-destructive/15' : 'bg-emerald-500/15'
            }`}>
              {i.type === 'alert'
                ? <AlertTriangle className="h-4 w-4 text-destructive" />
                : <Trophy className="h-4 w-4 text-emerald-500" />
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">
                {i.type === 'alert' ? (
                  <>
                    <span className="font-bold text-destructive">Aumento atípico:</span>{' '}
                    Você gastou <span className="font-bold">{i.pctChange}%</span> a mais em{' '}
                    <span className="font-semibold">{i.label}</span> comparado ao mês passado.
                  </>
                ) : (
                  <>
                    <span className="font-bold text-emerald-600">Você está economizando!</span>{' '}
                    Gastou <span className="font-bold">{Math.abs(i.pctChange)}%</span> a menos em{' '}
                    <span className="font-semibold">{i.label}</span> este mês.
                  </>
                )}
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                {i.type === 'alert'
                  ? <TrendingUp className="h-3 w-3 text-destructive" />
                  : <TrendingDown className="h-3 w-3 text-emerald-500" />
                }
                <span>{formatCurrency(i.prevAmount)} → {formatCurrency(i.currentAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
