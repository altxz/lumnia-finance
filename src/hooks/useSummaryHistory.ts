import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FINANCIAL_STALE_TIME } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { normalizeCategoryKey } from '@/lib/categoryMatch';

const MONTHS_BACK = 6;

interface HistoryRow {
  date: string;
  value: number;
  type: string;
  final_category: string | null;
  category_ai: string | null;
  description: string | null;
  credit_card_id: string | null;
  invoice_month: string | null;
}

export interface SummaryHistoryPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
}

export interface SummaryHistory {
  points: SummaryHistoryPoint[];
  /** Series of spending for a specific (sub)category key, same months as points */
  categorySeries: (categoryKey?: string | null) => SummaryHistoryPoint[];
  loading: boolean;
}

function monthKeyOf(date: string) {
  return date.slice(0, 7);
}

function isInvoicePayment(r: HistoryRow) {
  return !r.credit_card_id && !!r.invoice_month && (r.description || '').startsWith('Pagamento fatura');
}

export function useSummaryHistory(): SummaryHistory {
  const { user } = useAuth();
  const { selectedYear, selectedMonth, endDate } = useSelectedDate();

  // window: MONTHS_BACK months ending with the selected month (inclusive)
  const windowStart = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth - (MONTHS_BACK - 1), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, [selectedYear, selectedMonth]);

  const monthKeys = useMemo(() => {
    const keys: string[] = [];
    for (let i = MONTHS_BACK - 1; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return keys;
  }, [selectedYear, selectedMonth]);

  const { data, isLoading } = useQuery({
    queryKey: ['summary-history', user?.id, windowStart, endDate],
    enabled: !!user,
    staleTime: FINANCIAL_STALE_TIME,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('expenses')
        .select('date, value, type, final_category, category_ai, description, credit_card_id, invoice_month')
        .eq('user_id', user!.id)
        .gte('date', windowStart)
        .lt('date', endDate);
      return (rows || []) as HistoryRow[];
    },
  });

  const rows = data || [];

  const labelOf = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' });
  };

  const points = useMemo<SummaryHistoryPoint[]>(() => {
    const map = new Map<string, SummaryHistoryPoint>();
    monthKeys.forEach(k => map.set(k, { key: k, label: labelOf(k), income: 0, expense: 0, balance: 0 }));

    rows.forEach(r => {
      const bucket = map.get(monthKeyOf(r.date));
      if (!bucket) return;
      // Invoice payments are the cash counterpart of credit-card expenses.
      // Skip them so the expense total is not double-counted (accrual basis).
      if (isInvoicePayment(r)) return;
      const v = Number(r.value) || 0;
      if (r.type === 'income') bucket.income += v;
      else if (r.type === 'expense') bucket.expense += v;
    });

    map.forEach(p => { p.balance = p.income - p.expense; });
    return monthKeys.map(k => map.get(k)!);
  }, [rows, monthKeys]);

  const categorySeries = useMemo(() => {
    return (categoryKey?: string | null): SummaryHistoryPoint[] => {
      if (!categoryKey) return [];
      const target = normalizeCategoryKey(categoryKey);
      if (!target) return [];
      const map = new Map<string, SummaryHistoryPoint>();
      monthKeys.forEach(k => map.set(k, { key: k, label: labelOf(k), income: 0, expense: 0, balance: 0 }));

      rows.forEach(r => {
        if (r.type !== 'expense') return;
        if (isInvoicePayment(r)) return;
        const key = normalizeCategoryKey(r.final_category) || normalizeCategoryKey(r.category_ai);
        if (key !== target) return;
        const bucket = map.get(monthKeyOf(r.date));
        if (!bucket) return;
        bucket.expense += Number(r.value) || 0;
      });

      map.forEach(p => { p.balance = -p.expense; });
      return monthKeys.map(k => map.get(k)!);
    };
  }, [rows, monthKeys]);

  return { points, categorySeries, loading: isLoading };
}
