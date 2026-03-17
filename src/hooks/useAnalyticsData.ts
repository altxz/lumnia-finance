import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Expense } from '@/components/ExpenseTable';

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
      .select('*')
      .eq('user_id', user.id)
      .gte('date', fromDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    setExpenses(data || []);

    if (filters.compare) {
      const prevFrom = new Date(fromDate);
      prevFrom.setMonth(prevFrom.getMonth() - months);
      const { data: prev } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', prevFrom.toISOString().split('T')[0])
        .lt('date', fromDate.toISOString().split('T')[0])
        .order('date', { ascending: true });
      setPreviousExpenses(prev || []);
    } else {
      setPreviousExpenses([]);
    }

    setLoading(false);
  }, [user, filters]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const monthlyData = useMemo<MonthlyData[]>(() => {
    const map: Record<string, MonthlyData> = {};
    expenses.forEach(e => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) {
        map[key] = { month: key, label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), total: 0, byCategory: {} };
      }
      map[key].total += e.value;
      map[key].byCategory[e.final_category] = (map[key].byCategory[e.final_category] || 0) + e.value;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [expenses]);

  const categoryStats = useMemo<CategoryStats[]>(() => {
    const current: Record<string, { total: number; count: number }> = {};
    const prev: Record<string, { total: number }> = {};

    expenses.forEach(e => {
      if (!current[e.final_category]) current[e.final_category] = { total: 0, count: 0 };
      current[e.final_category].total += e.value;
      current[e.final_category].count += 1;
    });

    previousExpenses.forEach(e => {
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

  const totalCurrentPeriod = useMemo(() => expenses.reduce((s, e) => s + e.value, 0), [expenses]);
  const totalPreviousPeriod = useMemo(() => previousExpenses.reduce((s, e) => s + e.value, 0), [previousExpenses]);

  const avgMonthly = useMemo(() => {
    if (monthlyData.length === 0) return 0;
    return totalCurrentPeriod / monthlyData.length;
  }, [totalCurrentPeriod, monthlyData]);

  const predictedNextMonth = useMemo(() => {
    if (monthlyData.length < 2) return avgMonthly;
    const recent = monthlyData.slice(-3);
    const trend = recent.reduce((s, m) => s + m.total, 0) / recent.length;
    return Math.round(trend * 1.02); // slight uptrend bias
  }, [monthlyData, avgMonthly]);

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
      const day = new Date(e.date).getDay();
      if (!weekday[day]) weekday[day] = [];
      weekday[day].push(e.value);
    });
    const avgByDay = Object.entries(weekday).map(([day, vals]) => ({
      day: parseInt(day),
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
      count: vals.length,
    }));
    return avgByDay;
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
