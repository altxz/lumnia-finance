import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FINANCIAL_STALE_TIME } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { buildInvoiceCashEvents, sumInvoiceCashEventsBeforeDate } from '@/lib/invoiceCashFlow';
import { isTrackedCreditCardPayment } from '@/lib/creditCardPayments';
import { computeMonthCashFlow, computeProjectedMonthResult } from '@/lib/projectedBalanceMath';
import { computeInvoiceTotalsForCashWindow } from '@/lib/projectedInvoiceTotals';
import { buildEffectiveMonthExpenses, buildRecurringExceptionSignature, hideMaterializedRecurringTemplates } from '@/lib/recurringProjection';
import type { CreditCard as CreditCardType } from '@/lib/invoiceHelpers';
import type { Expense } from '@/components/ExpenseTable';

const EXPENSE_COLS = 'id, description, value, date, type, final_category, category_ai, credit_card_id, wallet_id, destination_wallet_id, is_paid, is_recurring, frequency, installments, installment_group_id, installment_info, invoice_month, payment_method, notes, tags, project_id, debt_id, created_at';

export interface ProjectedTotals {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  startingBalance: number;
  pendingInStartingBalance: number;
  projectedBalance: number;
  largestCategory: { name: string; total: number; categoryKey: string } | null;
  loading: boolean;
  refetch: () => void;
  monthExpenses: Expense[];
  invoiceExpenses: Expense[];
  creditCards: CreditCardType[];
  wallets: { id: string; name: string; initial_balance: number }[];
  effectiveHistoricalExpenses: Expense[];
}

async function fetchProjectedData(userId: string, startDate: string, endDate: string) {
  const [
    { data: expData },
    { data: recurringData },
    { data: ccExpData },
    { data: invoicePaymentsData },
    { data: historicalData },
    { data: cardsData },
    { data: walletsData },
    { data: exceptionsData },
    { data: recurringTemplatesData },
  ] = await Promise.all([
    supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', userId)
      .gte('date', startDate).lt('date', endDate).order('date', { ascending: false }),
    supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', userId)
      .eq('is_recurring', true).lt('date', endDate),
    supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', userId)
      .not('credit_card_id', 'is', null),
    // Also fetch invoice payment records (no credit_card_id but have invoice_month and start with "Pagamento fatura")
    supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', userId)
      .is('credit_card_id', null).not('invoice_month', 'is', null).like('description', 'Pagamento fatura%'),
    supabase.from('expenses').select('id, description, date, value, type, credit_card_id, is_paid, final_category, is_recurring, wallet_id, destination_wallet_id, invoice_month, payment_method, project_id')
      .eq('user_id', userId).lt('date', startDate).is('credit_card_id', null),
    supabase.from('credit_cards').select('*').eq('user_id', userId),
    supabase.from('wallets').select('id, name, initial_balance').eq('user_id', userId).order('name'),
    (supabase.from as any)('recurring_exceptions').select('template_id, occurrence_date').eq('user_id', userId),
    supabase.from('expenses').select('*').eq('user_id', userId).eq('is_recurring', true),
  ]);

  // Merge CC expenses + invoice payment records (deduped)
  const ccExps = (ccExpData || []) as Expense[];
  const paymentExps = (invoicePaymentsData || []) as Expense[];
  const ccIds = new Set(ccExps.map(e => e.id));
  const mergedInvoiceExpenses = [...ccExps, ...paymentExps.filter(p => !ccIds.has(p.id))];

  return {
    monthExpenses: (expData || []) as Expense[],
    recurringExpenses: (recurringData || []) as Expense[],
    invoiceExpenses: mergedInvoiceExpenses,
    historicalExpenses: (historicalData || []) as any[],
    creditCards: (cardsData || []) as CreditCardType[],
    wallets: (walletsData || []).map((w: any) => ({ id: w.id, name: w.name, initial_balance: w.initial_balance ?? 0 })),
    recurringExceptions: ((exceptionsData as any[]) || []) as { template_id: string; occurrence_date: string }[],
    recurringTemplates: (recurringTemplatesData || []) as Expense[],
  };
}

export function useProjectedTotals(): ProjectedTotals {
  const { user } = useAuth();
  const { startDate, endDate, selectedMonth, selectedYear } = useSelectedDate();
  const queryClient = useQueryClient();

  const queryKey = ['projected-totals', user?.id, startDate, endDate];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchProjectedData(user!.id, startDate, endDate),
    enabled: !!user,
    staleTime: FINANCIAL_STALE_TIME,
    gcTime: 1000 * 60 * 30,
  });

  // Prefetch dos meses vizinhos: navegar no tempo fica instantâneo.
  useEffect(() => {
    if (!user || isLoading) return;
    const neighbours = [-1, 1].map(offset => {
      const m = selectedMonth + offset;
      const base = new Date(selectedYear, m, 1);
      const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      return { start: fmt(base), end: fmt(next) };
    });

    neighbours.forEach(({ start, end }) => {
      queryClient.prefetchQuery({
        queryKey: ['projected-totals', user.id, start, end],
        queryFn: () => fetchProjectedData(user.id, start, end),
        staleTime: FINANCIAL_STALE_TIME,
      });
    });
  }, [user, isLoading, selectedMonth, selectedYear, queryClient]);

  const monthExpenses = data?.monthExpenses ?? [];
  const visibleMonthExpenses = useMemo(() => hideMaterializedRecurringTemplates(monthExpenses), [monthExpenses]);
  const recurringExpenses = data?.recurringExpenses ?? [];
  const recurringTemplates = data?.recurringTemplates ?? recurringExpenses;
  const invoiceExpenses = data?.invoiceExpenses ?? [];
  const historicalExpenses = data?.historicalExpenses ?? [];
  const visibleHistoricalExpenses = useMemo(
    () => hideMaterializedRecurringTemplates(historicalExpenses),
    [historicalExpenses],
  );
  const creditCards = data?.creditCards ?? [];
  const wallets = data?.wallets ?? [];
  const recurringExceptions = data?.recurringExceptions ?? [];
  const exceptionSet = useMemo(
    () => new Set(recurringExceptions.map(e => buildRecurringExceptionSignature(e.template_id, e.occurrence_date))),
    [recurringExceptions]
  );
  const isCCPayment = useCallback((e: any) => isTrackedCreditCardPayment(e, creditCards), [creditCards]);

  // Virtual recurring (mês selecionado) — mesmo motor usado nos meses passados
  const effectiveMonthExpenses = useMemo(
    () =>
      buildEffectiveMonthExpenses({
        monthExpenses: monthExpenses as any[],
        recurringTemplates: recurringTemplates as any[],
        year: selectedYear,
        month: selectedMonth,
        exceptionSet,
      }) as Expense[],
    [monthExpenses, recurringTemplates, selectedMonth, selectedYear, exceptionSet],
  );

  // Starting balance: acumula mês a mês o MESMO fluxo que gera o saldo previsto,
  // garantindo que "Saldo Anterior" do mês N = "Saldo Previsto" do mês N-1.
  const { startingBalance, pendingInStartingBalance, effectiveHistoricalExpenses } = useMemo(() => {
    const walletSum = wallets.reduce((s, w) => s + w.initial_balance, 0);

    const nonTransfers = historicalExpenses.filter((e: any) => e.type !== 'transfer');
    const pendingExpenses = nonTransfers.filter((e: any) => e.type !== 'income' && !e.is_paid);
    const pendingIncome = nonTransfers.filter((e: any) => e.type === 'income' && !e.is_paid);
    const pendingAmount = pendingExpenses.reduce((s: number, e: any) => s + e.value, 0)
      - pendingIncome.reduce((s: number, e: any) => s + e.value, 0);

    const selectedMonthIndex = selectedYear * 12 + selectedMonth;

    // Agrupa o histórico real por mês (a deduplicação de recorrências deve ser
    // feita dentro de cada mês, nunca no histórico inteiro).
    const byMonth = new Map<number, any[]>();
    historicalExpenses.forEach((e: any) => {
      if (!e.date) return;
      const [year, month] = e.date.split('-').map(Number);
      const index = year * 12 + (month - 1);
      if (index >= selectedMonthIndex) return;
      if (!byMonth.has(index)) byMonth.set(index, []);
      byMonth.get(index)!.push(e);
    });

    const monthIndexes = new Set<number>(byMonth.keys());
    recurringTemplates.forEach((r: any) => {
      if (r.type === 'transfer' || r.credit_card_id || !r.date) return;
      const date = new Date(`${r.date}T12:00:00`);
      const start = date.getFullYear() * 12 + date.getMonth();
      for (let m = start; m < selectedMonthIndex; m++) monthIndexes.add(m);
    });

    let historicalFlow = 0;
    const effectiveHistorical: Expense[] = [];
    Array.from(monthIndexes)
      .sort((a, b) => a - b)
      .forEach(index => {
        const effective = buildEffectiveMonthExpenses({
          monthExpenses: (byMonth.get(index) ?? []) as any[],
          recurringTemplates: recurringTemplates as any[],
          year: Math.floor(index / 12),
          month: index % 12,
          exceptionSet,
        });
        effectiveHistorical.push(...(effective as Expense[]));
        historicalFlow += computeMonthCashFlow(effective as any[], isCCPayment);
      });

    const invoiceCashEvents = buildInvoiceCashEvents(creditCards, invoiceExpenses);
    const ccInvoiceTotal = sumInvoiceCashEventsBeforeDate(invoiceCashEvents, startDate);

    const balance = walletSum + historicalFlow - ccInvoiceTotal;
    return {
      startingBalance: balance,
      pendingInStartingBalance: pendingAmount,
      effectiveHistoricalExpenses: effectiveHistorical,
    };
  }, [wallets, historicalExpenses, recurringTemplates, creditCards, invoiceExpenses, startDate, selectedMonth, selectedYear, exceptionSet, isCCPayment]);


  // Invoice totals
  const invoiceTotals = useMemo(() => {
    return computeInvoiceTotalsForCashWindow({
      creditCards,
      expenses: invoiceExpenses.length > 0 ? invoiceExpenses : visibleMonthExpenses,
      startDate,
      endDate,
    });
  }, [creditCards, invoiceExpenses, visibleMonthExpenses, startDate, endDate]);

  // Compute totals
  const result = useMemo(() => {
    return computeProjectedMonthResult({
      effectiveMonthExpenses,
      invoiceTotal: invoiceTotals.total,
      invoiceByCategory: invoiceTotals.byCategory,
      startingBalance,
      isCreditCardPayment: isCCPayment,
    });
  }, [effectiveMonthExpenses, invoiceTotals, startingBalance, isCCPayment]);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    ...result,
    startingBalance,
    pendingInStartingBalance,
    loading: isLoading,
    refetch,
    monthExpenses: effectiveMonthExpenses,
    invoiceExpenses,
    creditCards,
    wallets,
    effectiveHistoricalExpenses,
  };
}
