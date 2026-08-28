import { useState, useEffect, useMemo, useCallback } from 'react';
import { isBalanceAdjustment } from '@/lib/balanceAdjustments';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Expense } from '@/components/ExpenseTable';
import { isInvoicePayment } from '@/lib/utils';
import { transactionAmount } from '@/lib/transactionAmount';

const ANALYTICS_COLS = 'id, value, date, type, final_category, credit_card_id, is_recurring, is_paid, frequency, installment_group_id, description';
const MIN_MONTHS_FOR_FORECAST = 2;

export type AnalyticsPeriodKey = '3' | '6' | '12' | 'all';

export interface AnalyticsFilters {
  period: AnalyticsPeriodKey;
  compare: boolean;
}

export interface AnalyticsPeriod {
  key: AnalyticsPeriodKey;
  label: string;
  monthCount: number | null;
  comparisonAvailable: boolean;
  currentStart: string;
  currentEnd: string;
  previousStart: string | null;
  previousEnd: string | null;
  nextMonthStart: string;
  nextMonthEnd: string;
}

export interface MonthlyData {
  month: string;
  label: string;
  income: number;
  total: number;
  net: number;
  byCategory: Record<string, number>;
}

export interface CategoryStats {
  category: string;
  total: number;
  count: number;
  previousTotal: number;
  change: number | null;
}

export interface AnalyticsForecast {
  value: number | null;
  status: 'ready' | 'insufficient-history' | 'no-data';
  basisMonths: number;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getAnalyticsMonthKey(expense: Expense): string {
  return expense.date.slice(0, 7);
}

function isAnalyticsExpense(expense: Expense) {
  return expense.type !== 'income' && expense.type !== 'transfer' && !isInvoicePayment(expense);
}

function isAnalyticsIncome(expense: Expense) {
  return expense.type === 'income' && !isInvoicePayment(expense);
}

function getCategoryKey(expense: Expense) {
  return expense.final_category || 'Outras';
}

function createPeriod(filters: AnalyticsFilters): AnalyticsPeriod {
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const monthCount = filters.period === 'all' ? null : Number(filters.period);
  const currentStartDate = monthCount
    ? addMonths(currentMonth, -(monthCount - 1))
    : new Date(2000, 0, 1, 12);
  const comparisonAvailable = Boolean(filters.compare && monthCount);
  const previousStartDate = comparisonAvailable
    ? addMonths(currentStartDate, -(monthCount ?? 0))
    : null;
  const previousEndDate = comparisonAvailable
    ? endOfMonth(addMonths(currentStartDate, -1))
    : null;
  const nextMonth = addMonths(currentMonth, 1);

  return {
    key: filters.period,
    label: monthCount ? `Últimos ${monthCount} meses` : 'Todo o período',
    monthCount,
    comparisonAvailable,
    currentStart: toDateKey(currentStartDate),
    currentEnd: toDateKey(now),
    previousStart: previousStartDate ? toDateKey(previousStartDate) : null,
    previousEnd: previousEndDate ? toDateKey(previousEndDate) : null,
    nextMonthStart: toDateKey(nextMonth),
    nextMonthEnd: toDateKey(endOfMonth(nextMonth)),
  };
}

function isWithinDateRange(expense: Expense, start: string, end: string) {
  return expense.date >= start && expense.date <= end;
}

function monthKeysBetween(startDate: string, endDate: string) {
  const [startYear, startMonth] = startDate.slice(0, 7).split('-').map(Number);
  const [endYear, endMonth] = endDate.slice(0, 7).split('-').map(Number);
  const keys: string[] = [];
  let cursor = new Date(startYear, startMonth - 1, 1, 12);
  const end = new Date(endYear, endMonth - 1, 1, 12);

  while (cursor <= end) {
    keys.push(toMonthKey(cursor));
    cursor = addMonths(cursor, 1);
  }

  return keys;
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

/**
 * Regime de competência: agrupa pela data original da transação.
 * Os dados de fluxo de caixa permanecem sob responsabilidade dos hooks próprios do Dashboard.
 */
export function useAnalyticsData(filters: AnalyticsFilters) {
  const { user } = useAuth();
  const period = useMemo(() => createPeriod(filters), [filters]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [previousExpenses, setPreviousExpenses] = useState<Expense[]>([]);
  const [nextMonthExpenses, setNextMonthExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const fetchStart = period.previousStart || period.currentStart;

    const { data, error: queryError } = await supabase
      .from('expenses')
      .select(ANALYTICS_COLS)
      .eq('user_id', user.id)
      .gte('date', fetchStart)
      .lte('date', period.nextMonthEnd)
      .order('date', { ascending: true });

    if (queryError) {
      setExpenses([]);
      setPreviousExpenses([]);
      setNextMonthExpenses([]);
      setError('Não foi possível carregar suas análises. Tente novamente.');
      setLoading(false);
      return;
    }

    const allExpenses = ((data || []) as Expense[]).filter(expense => !isBalanceAdjustment(expense));
    setExpenses(allExpenses.filter(expense => isWithinDateRange(expense, period.currentStart, period.currentEnd)));
    setPreviousExpenses(
      period.previousStart && period.previousEnd
        ? allExpenses.filter(expense => isWithinDateRange(expense, period.previousStart!, period.previousEnd!))
        : [],
    );
    setNextMonthExpenses(allExpenses.filter(expense => isWithinDateRange(expense, period.nextMonthStart, period.nextMonthEnd)));
    setLoading(false);
  }, [period.currentEnd, period.currentStart, period.nextMonthEnd, period.nextMonthStart, period.previousEnd, period.previousStart, user]);

  useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);

  const currentMonthKeys = useMemo(() => {
    if (period.monthCount) return monthKeysBetween(period.currentStart, period.currentEnd);
    if (expenses.length === 0) return [];
    const firstDate = expenses.reduce((earliest, expense) => expense.date < earliest ? expense.date : earliest, expenses[0].date);
    return monthKeysBetween(firstDate, period.currentEnd);
  }, [expenses, period.currentEnd, period.currentStart, period.monthCount]);

  const monthlyData = useMemo<MonthlyData[]>(() => {
    const map = Object.fromEntries(currentMonthKeys.map(month => [month, {
      month,
      label: formatMonthLabel(month),
      income: 0,
      total: 0,
      net: 0,
      byCategory: {},
    }])) as Record<string, MonthlyData>;
    const globalCategoryTotals: Record<string, number> = {};

    expenses.forEach(expense => {
      const month = getAnalyticsMonthKey(expense);
      if (!map[month]) return;

      if (isAnalyticsIncome(expense)) {
        map[month].income += transactionAmount(expense.value);
        return;
      }
      if (!isAnalyticsExpense(expense)) return;

      const category = getCategoryKey(expense);
      const amount = transactionAmount(expense.value);
      map[month].total += amount;
      map[month].byCategory[category] = (map[month].byCategory[category] || 0) + amount;
      globalCategoryTotals[category] = (globalCategoryTotals[category] || 0) + amount;
    });

    const topCategories = Object.entries(globalCategoryTotals)
      .sort(([, totalA], [, totalB]) => totalB - totalA)
      .slice(0, 6)
      .map(([category]) => category);
    const topCategorySet = new Set(topCategories);
    const hasOtherCategories = Object.keys(globalCategoryTotals).some(category => !topCategorySet.has(category));
    const seriesKeys = [...topCategories, ...(hasOtherCategories ? ['Outras'] : [])];

    return currentMonthKeys.map(month => {
      const row = map[month];
      const grouped: Record<string, number> = Object.fromEntries(seriesKeys.map(key => [key, 0]));
      Object.entries(row.byCategory).forEach(([category, value]) => {
        const targetCategory = topCategorySet.has(category) ? category : 'Outras';
        grouped[targetCategory] = (grouped[targetCategory] || 0) + value;
      });
      return { ...row, net: row.income - row.total, byCategory: grouped };
    });
  }, [currentMonthKeys, expenses]);

  const categoryStats = useMemo<CategoryStats[]>(() => {
    const current: Record<string, { total: number; count: number }> = {};
    const previous: Record<string, number> = {};

    expenses.forEach(expense => {
      if (!isAnalyticsExpense(expense)) return;
      const category = getCategoryKey(expense);
      current[category] = current[category] || { total: 0, count: 0 };
      current[category].total += transactionAmount(expense.value);
      current[category].count += 1;
    });

    previousExpenses.forEach(expense => {
      if (!isAnalyticsExpense(expense)) return;
      const category = getCategoryKey(expense);
      previous[category] = (previous[category] || 0) + transactionAmount(expense.value);
    });

    return Object.entries(current)
      .map(([category, { total, count }]) => {
        const previousTotal = previous[category] || 0;
        const change = period.comparisonAvailable && previousTotal > 0
          ? ((total - previousTotal) / previousTotal) * 100
          : null;
        return { category, total, count, previousTotal, change };
      })
      .sort((a, b) => b.total - a.total);
  }, [expenses, period.comparisonAvailable, previousExpenses]);

  const totalCurrentPeriod = useMemo(
    () => expenses.filter(isAnalyticsExpense).reduce((sum, expense) => sum + transactionAmount(expense.value), 0),
    [expenses],
  );
  const totalPreviousPeriod = useMemo(
    () => previousExpenses.filter(isAnalyticsExpense).reduce((sum, expense) => sum + transactionAmount(expense.value), 0),
    [previousExpenses],
  );
  const totalIncomePeriod = useMemo(
    () => expenses.filter(isAnalyticsIncome).reduce((sum, expense) => sum + transactionAmount(expense.value), 0),
    [expenses],
  );
  const totalPreviousIncomePeriod = useMemo(
    () => previousExpenses.filter(isAnalyticsIncome).reduce((sum, expense) => sum + transactionAmount(expense.value), 0),
    [previousExpenses],
  );
  const avgMonthly = useMemo(
    () => monthlyData.length > 0 ? totalCurrentPeriod / monthlyData.length : 0,
    [monthlyData.length, totalCurrentPeriod],
  );

  const forecast = useMemo<AnalyticsForecast>(() => {
    const monthsWithHistory = monthlyData.filter(month => month.total > 0).length;
    if (monthsWithHistory === 0) return { value: null, status: 'no-data', basisMonths: 0 };
    if (monthsWithHistory < MIN_MONTHS_FOR_FORECAST) {
      return { value: null, status: 'insufficient-history', basisMonths: monthsWithHistory };
    }

    const historicalRecurringAverage = expenses
      .filter(expense => isAnalyticsExpense(expense) && expense.is_recurring)
      .reduce((sum, expense) => sum + transactionAmount(expense.value), 0) / monthlyData.length;
    const scheduledRecurringNextMonth = nextMonthExpenses
      .filter(expense => isAnalyticsExpense(expense) && expense.is_recurring)
      .reduce((sum, expense) => sum + transactionAmount(expense.value), 0);
    const scheduledInstallmentsNextMonth = nextMonthExpenses
      .filter(expense => isAnalyticsExpense(expense) && !expense.is_recurring && Boolean(expense.installment_group_id))
      .reduce((sum, expense) => sum + transactionAmount(expense.value), 0);
    const variableAverage = expenses
      .filter(expense => isAnalyticsExpense(expense) && !expense.is_recurring && !expense.installment_group_id)
      .reduce((sum, expense) => sum + transactionAmount(expense.value), 0) / monthlyData.length;

    return {
      value: Math.round(((scheduledRecurringNextMonth || historicalRecurringAverage) + scheduledInstallmentsNextMonth + variableAverage) * 100) / 100,
      status: 'ready',
      basisMonths: monthsWithHistory,
    };
  }, [expenses, monthlyData, nextMonthExpenses]);

  const weekdayAnalysis = useMemo(() => {
    const weekday: Record<number, number[]> = {};
    expenses.forEach(expense => {
      if (!isAnalyticsExpense(expense)) return;
      const day = new Date(`${expense.date}T12:00:00`).getDay();
      weekday[day] = weekday[day] || [];
      weekday[day].push(transactionAmount(expense.value));
    });
    return Object.entries(weekday).map(([day, values]) => ({
      day: Number(day),
      avg: values.reduce((sum, value) => sum + value, 0) / values.length,
      count: values.length,
    }));
  }, [expenses]);

  const biggestSpendingCategory = useMemo(() => {
    const topCategory = categoryStats[0];
    return topCategory ? { category: topCategory.category, total: topCategory.total } : null;
  }, [categoryStats]);

  return {
    expenses,
    previousExpenses,
    loading,
    error,
    hasData: totalCurrentPeriod > 0 || totalIncomePeriod > 0,
    period,
    monthlyData,
    categoryStats,
    totalCurrentPeriod,
    totalPreviousPeriod,
    totalIncomePeriod,
    totalPreviousIncomePeriod,
    avgMonthly,
    forecast,
    predictedNextMonth: forecast.value,
    weekdayAnalysis,
    biggestSpendingCategory,
    refetch: fetchExpenses,
  };
}
