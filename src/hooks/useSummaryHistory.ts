import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FINANCIAL_STALE_TIME } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { normalizeCategoryKey } from '@/lib/categoryMatch';
import { isTrackedCreditCardPayment } from '@/lib/creditCardPayments';
import { computeMonthTotals } from '@/lib/monthCashTotals';
import { buildRecurringExceptionSignature } from '@/lib/recurringProjection';
import type { CreditCard as CreditCardType } from '@/lib/invoiceHelpers';

const MONTHS_BACK = 6;

const ROW_COLS =
  'id, description, value, date, type, final_category, category_ai, credit_card_id, wallet_id, destination_wallet_id, is_paid, is_recurring, frequency, invoice_month, installment_group_id';

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

/**
 * Séries mensais na MESMA base dos cards de resumo:
 * Saídas = despesas em débito do mês + pagamentos de fatura do mês,
 * já incluindo as recorrências projetadas. Assim o último ponto de cada
 * mini-gráfico é exatamente o valor exibido no card.
 */
export function useSummaryHistory(startingBalance?: number): SummaryHistory {
  const { user } = useAuth();
  const { selectedYear, selectedMonth, endDate } = useSelectedDate();

  const windowStart = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth - (MONTHS_BACK - 1), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, [selectedYear, selectedMonth]);

  const months = useMemo(() => {
    const list: { key: string; label: string; year: number; month: number }[] = [];
    for (let i = MONTHS_BACK - 1; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - i, 1);
      list.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('pt-BR', { month: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    return list;
  }, [selectedYear, selectedMonth]);

  const { data, isLoading } = useQuery({
    queryKey: ['summary-history', user?.id, windowStart, endDate],
    enabled: !!user,
    staleTime: FINANCIAL_STALE_TIME,
    queryFn: async () => {
      const [
        { data: rows },
        { data: ccRows },
        { data: paymentRows },
        { data: cards },
        { data: templates },
        { data: exceptions },
      ] = await Promise.all([
        supabase.from('expenses').select(ROW_COLS).eq('user_id', user!.id)
          .gte('date', windowStart).lt('date', endDate),
        supabase.from('expenses').select(ROW_COLS).eq('user_id', user!.id)
          .not('credit_card_id', 'is', null),
        supabase.from('expenses').select(ROW_COLS).eq('user_id', user!.id)
          .is('credit_card_id', null).not('invoice_month', 'is', null)
          .like('description', 'Pagamento fatura%'),
        supabase.from('credit_cards').select('*').eq('user_id', user!.id),
        supabase.from('expenses').select('*').eq('user_id', user!.id).eq('is_recurring', true),
        (supabase.from as any)('recurring_exceptions').select('template_id, occurrence_date')
          .eq('user_id', user!.id),
      ]);

      const cc = (ccRows || []) as any[];
      const ccIds = new Set(cc.map((e) => e.id));
      const invoiceExpenses = [...cc, ...((paymentRows || []) as any[]).filter((p) => !ccIds.has(p.id))];

      return {
        rows: (rows || []) as any[],
        invoiceExpenses,
        creditCards: (cards || []) as CreditCardType[],
        templates: (templates || []) as any[],
        exceptions: ((exceptions as any[]) || []) as { template_id: string; occurrence_date: string }[],
      };
    },
  });

  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const invoiceExpenses = useMemo(() => data?.invoiceExpenses ?? [], [data?.invoiceExpenses]);
  const creditCards = useMemo(() => data?.creditCards ?? [], [data?.creditCards]);
  const templates = useMemo(() => data?.templates ?? [], [data?.templates]);
  const exceptionSet = useMemo(
    () => new Set((data?.exceptions ?? []).map((e) => buildRecurringExceptionSignature(e.template_id, e.occurrence_date))),
    [data?.exceptions],
  );
  const isCCPayment = useCallback((e: any) => isTrackedCreditCardPayment(e, creditCards), [creditCards]);

  const monthly = useMemo(() => {
    return months.map((m) => {
      const monthRows = rows.filter((r) => r.date?.slice(0, 7) === m.key);
      const totals = computeMonthTotals({
        year: m.year,
        month: m.month,
        monthRows,
        recurringTemplates: templates,
        exceptionSet,
        creditCards,
        invoiceExpenses,
        isCreditCardPayment: isCCPayment,
      });
      return { ...m, totals };
    });
  }, [months, rows, templates, exceptionSet, creditCards, invoiceExpenses, isCCPayment]);

  const points = useMemo<SummaryHistoryPoint[]>(() => {
    const base = monthly.map((m) => ({
      key: m.key,
      label: m.label,
      income: m.totals.totalIncome,
      expense: m.totals.totalExpense,
      balance: m.totals.totalIncome - m.totals.totalExpense,
    }));

    // Quando o saldo inicial do mês selecionado é conhecido, a série de saldo passa
    // a ser o saldo projetado acumulado: o último ponto fecha exatamente com o card.
    if (startingBalance !== undefined && base.length > 0) {
      const last = base.length - 1;
      base[last].balance = startingBalance + base[last].income - base[last].expense;
      for (let i = last - 1; i >= 0; i--) {
        base[i].balance = base[i + 1].balance - (base[i + 1].income - base[i + 1].expense);
      }
    }

    return base;
  }, [monthly, startingBalance]);

  const categorySeries = useMemo(() => {
    return (categoryKey?: string | null): SummaryHistoryPoint[] => {
      if (!categoryKey) return [];
      const target = normalizeCategoryKey(categoryKey);
      if (!target) return [];

      return monthly.map((m) => {
        const total = Object.entries(m.totals.byCategory || {}).reduce(
          (sum, [key, value]) => (normalizeCategoryKey(key) === target ? sum + value : sum),
          0,
        );
        return { key: m.key, label: m.label, income: 0, expense: total, balance: -total };
      });
    };
  }, [monthly]);

  return { points, categorySeries, loading: isLoading };
}
