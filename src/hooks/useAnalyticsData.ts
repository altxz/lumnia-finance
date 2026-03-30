import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Expense } from '@/components/ExpenseTable';
// Only fetch columns needed for analytics
const ANALYTICS_COLS = 'id, value, date, type, final_category, credit_card_id, is_recurring, is_paid, frequency, installment_group_id';

export interface AnalyticsFilters {
  period: string; // '3', '6', '12', 'all'
  compare: boolean;
}

export interface MonthlyData {
  month: string;
  label: string;
  total: number;
  byCategory: Record<string, number>;
}

export interface CategoryStats {
  category: string;
  total: number;
  count: number;
  previousTotal: number;
  change: number;
}

/**
 * Regime de Competência: agrupa pela data original da transação (e.date).
 * Usado para gráficos analíticos e categorias — NÃO para fluxo de caixa.
 */
function getAnalyticsMonthKey(e: Expense): string {
  const d = new Date(e.date + 'T12:00:00');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function useAnalyticsData(filters: AnalyticsFilters) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [previousExpenses, setPreviousExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const months = filters.period === 'all' ? 120 : parseInt(filters.period);
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - months);

    const { data } = await supabase
      .from('expenses')
      .select(ANALYTICS_COLS)
      .eq('user_id', user.id)
      .gte('date', fromDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    const allExpenses = (data || []) as Expense[];

    const periodStart = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`;
    const now = new Date();
    const periodEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const currentPeriod = allExpenses.filter(e => {
      const key = getAnalyticsMonthKey(e);
      return key >= periodStart && key <= periodEnd;
    });

    setExpenses(currentPeriod);

    if (filters.compare) {
      const prevFrom = new Date(fromDate);
      prevFrom.setMonth(prevFrom.getMonth() - months);
      const prevStart = `${prevFrom.getFullYear()}-${String(prevFrom.getMonth() + 1).padStart(2, '0')}`;
      const prev = allExpenses.filter(e => {
        const key = getAnalyticsMonthKey(e);
        return key >= prevStart && key < periodStart;
      });
      setPreviousExpenses(prev);
    } else {
      setPreviousExpenses([]);
    }

    setLoading(false);
  }, [user, filters]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const monthlyData = useMemo<MonthlyData[]>(() => {
    // Step 1: build raw data
    const map: Record<string, MonthlyData> = {};
    const globalCatTotals: Record<string, number> = {};

    expenses.forEach(e => {
      if (e.type === 'transfer') return;
      const key = getAnalyticsMonthKey(e);
      if (!map[key]) {
        const [y, m] = key.split('-').map(Number);
        const d = new Date(y, m - 1, 1);
        map[key] = {
          month: key,
          label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          total: 0,
          byCategory: {},
        };
      }
      if (e.type !== 'income') {
        map[key].total += e.value;
        map[key].byCategory[e.final_category] = (map[key].byCategory[e.final_category] || 0) + e.value;
        globalCatTotals[e.final_category] = (globalCatTotals[e.final_category] || 0) + e.value;
      }
    });

    // Step 2: identify Top 6 categories, group rest as "Outras"
    const top6 = Object.entries(globalCatTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cat]) => cat);
    const top6Set = new Set(top6);

    // Check if there are categories outside top 6
    const hasOutras = Object.keys(globalCatTotals).some(cat => !top6Set.has(cat));
    // Build the full key list (every month must have ALL keys to avoid stacking gaps)
    const allKeys = [...top6, ...(hasOutras ? ['Outras'] : [])];

    const result = Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
    result.forEach(m => {
      const grouped: Record<string, number> = {};
      // Initialize ALL keys to 0 first
      allKeys.forEach(k => { grouped[k] = 0; });
      let outrasTotal = 0;
      Object.entries(m.byCategory).forEach(([cat, val]) => {
        if (top6Set.has(cat)) {
          grouped[cat] = val;
        } else {
          outrasTotal += val;
        }
      });
      if (hasOutras) grouped['Outras'] = outrasTotal;
      m.byCategory = grouped;
    });

    return result;
  }, [expenses]);

  const categoryStats = useMemo<CategoryStats[]>(() => {
    const current: Record<string, { total: number; count: number }> = {};
    const prev: Record<string, { total: number }> = {};

    expenses.forEach(e => {
      if (e.type === 'income' || e.type === 'transfer') return;
      if (!current[e.final_category]) current[e.final_category] = { total: 0, count: 0 };
      current[e.final_category].total += e.value;
      current[e.final_category].count += 1;
    });

    previousExpenses.forEach(e => {
      if (e.type === 'income' || e.type === 'transfer') return;
      if (!prev[e.final_category]) prev[e.final_category] = { total: 0 };
      prev[e.final_category].total += e.value;
    });

    return Object.entries(current)
      .map(([category, { total, count }]) => {
        const previousTotal = prev[category]?.total || 0;
        const change = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : 0;
        return { category, total, count, previousTotal, change };
      })
      .sort((a, b) => b.total - a.total);
  }, [expenses, previousExpenses]);

  const totalCurrentPeriod = useMemo(() =>
    expenses.filter(e => e.type !== 'income' && e.type !== 'transfer').reduce((s, e) => s + e.value, 0),
    [expenses]);
  const totalPreviousPeriod = useMemo(() =>
    previousExpenses.filter(e => e.type !== 'income' && e.type !== 'transfer').reduce((s, e) => s + e.value, 0),
    [previousExpenses]);

  const avgMonthly = useMemo(() => {
    if (monthlyData.length === 0) return 0;
    return totalCurrentPeriod / monthlyData.length;
  }, [totalCurrentPeriod, monthlyData]);

  const predictedNextMonth = useMemo(() => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;

    const recurringTotal = expenses
      .filter(e => e.is_recurring && e.type !== 'income' && e.type !== 'transfer')
      .reduce((s, e) => s + e.value, 0) / Math.max(monthlyData.length, 1);

    const scheduledInstallments = expenses.filter(e => {
      if (!e.credit_card_id || !e.installment_group_id) return false;
      const key = getAnalyticsMonthKey(e);
      return key === nextKey;
    }).reduce((s, e) => s + e.value, 0);

    const variableTotal = expenses
      .filter(e => !e.is_recurring && !e.installment_group_id && e.type !== 'income' && e.type !== 'transfer')
      .reduce((s, e) => s + e.value, 0);
    const variableAvg = monthlyData.length > 0 ? variableTotal / monthlyData.length : 0;

    const predicted = recurringTotal + scheduledInstallments + variableAvg;
    return predicted > 0 ? Math.round(predicted) : avgMonthly;
  }, [expenses, monthlyData, avgMonthly]);

  const financialScore = useMemo(() => {
    if (expenses.length === 0) return 500;
    const consistency = Math.min(monthlyData.length * 50, 300);
    const savingsRatio = Math.max(0, (5000 - avgMonthly) / 5000) * 400;
    const diversity = Math.min(Object.keys(categoryStats).length * 30, 300);
    return Math.min(1000, Math.round(consistency + savingsRatio + diversity));
  }, [expenses, monthlyData, avgMonthly, categoryStats]);

  const weekdayAnalysis = useMemo(() => {
    const weekday: Record<number, number[]> = {};
    expenses.forEach(e => {
      if (e.type === 'income' || e.type === 'transfer') return;
      const day = new Date(e.date + 'T12:00:00').getDay();
      if (!weekday[day]) weekday[day] = [];
      weekday[day].push(e.value);
    });
    return Object.entries(weekday).map(([day, vals]) => ({
      day: parseInt(day),
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
      count: vals.length,
    }));
  }, [expenses]);

  const biggestSavingOpportunity = useMemo(() => {
    if (categoryStats.length === 0) return null;
    const top = categoryStats[0];
    return { category: top.category, potential: Math.round(top.total * 0.15) };
  }, [categoryStats]);

  return {
    expenses, loading, monthlyData, categoryStats,
    totalCurrentPeriod, totalPreviousPeriod, avgMonthly,
    predictedNextMonth, financialScore, weekdayAnalysis,
    biggestSavingOpportunity, refetch: fetchExpenses,
  };
}
