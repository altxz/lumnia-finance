import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { getInvoicePeriod, matchExpensesToInvoice } from '@/lib/invoiceHelpers';
import { buildMonthRecurringSignature, buildRecurringSignature } from '@/lib/recurringProjection';
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
}

async function fetchProjectedData(userId: string, startDate: string, endDate: string) {
  const [
    { data: expData },
    { data: recurringData },
    { data: ccExpData },
    { data: historicalData },
    { data: cardsData },
    { data: walletsData },
  ] = await Promise.all([
    supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', userId)
      .gte('date', startDate).lt('date', endDate).order('date', { ascending: false }),
    supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', userId)
      .eq('is_recurring', true).lt('date', endDate),
    supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', userId)
      .not('credit_card_id', 'is', null),
    supabase.from('expenses').select('id, description, date, value, type, credit_card_id, is_paid, final_category')
      .eq('user_id', userId).lt('date', startDate).is('credit_card_id', null),
    supabase.from('credit_cards').select('*').eq('user_id', userId),
    supabase.from('wallets').select('id, name, initial_balance').eq('user_id', userId).order('name'),
  ]);

  return {
    monthExpenses: (expData || []) as Expense[],
    recurringExpenses: (recurringData || []) as Expense[],
    invoiceExpenses: (ccExpData || []) as Expense[],
    historicalExpenses: (historicalData || []) as any[],
    creditCards: (cardsData || []) as CreditCardType[],
    wallets: (walletsData || []).map((w: any) => ({ id: w.id, name: w.name, initial_balance: w.initial_balance ?? 0 })),
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
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  const monthExpenses = data?.monthExpenses ?? [];
  const recurringExpenses = data?.recurringExpenses ?? [];
  const invoiceExpenses = data?.invoiceExpenses ?? [];
  const historicalExpenses = data?.historicalExpenses ?? [];
  const creditCards = data?.creditCards ?? [];
  const wallets = data?.wallets ?? [];

  // Virtual recurring
  const effectiveMonthExpenses = useMemo(() => {
    const realSignatures = new Set(
      monthExpenses.map(e => buildRecurringSignature(e.type, e.value, e.description))
    );
    const realIds = new Set(monthExpenses.map(e => e.id));
    const virtualEntries: Expense[] = [];

    recurringExpenses.forEach(r => {
      if (realIds.has(r.id)) return;
      const sig = buildRecurringSignature(r.type, r.value, r.description);
      if (realSignatures.has(sig)) return;
      if (r.type === 'transfer' || r.credit_card_id) return;
      virtualEntries.push({
        ...r,
        date: (() => {
          const origDay = new Date(r.date + 'T12:00:00').getDate();
          const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
          const day = Math.min(origDay, daysInMonth);
          return `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        })(),
        is_paid: false,
      });
    });

    return [...monthExpenses, ...virtualEntries];
  }, [monthExpenses, recurringExpenses, selectedMonth, selectedYear]);

  // Starting balance
  const { startingBalance, pendingInStartingBalance } = useMemo(() => {
    const walletSum = wallets.reduce((s, w) => s + w.initial_balance, 0);

    const nonTransfers = historicalExpenses.filter((e: any) => e.type !== 'transfer');
    const historicalIncome = nonTransfers.filter((e: any) => e.type === 'income').reduce((s: number, e: any) => s + e.value, 0);
    const historicalDebit = nonTransfers.filter((e: any) => e.type !== 'income').reduce((s: number, e: any) => s + e.value, 0);

    const pendingExpenses = nonTransfers.filter((e: any) => e.type !== 'income' && !e.is_paid);
    const pendingIncome = nonTransfers.filter((e: any) => e.type === 'income' && !e.is_paid);
    const pendingAmount = pendingExpenses.reduce((s: number, e: any) => s + e.value, 0)
      - pendingIncome.reduce((s: number, e: any) => s + e.value, 0);

    let virtualRecurringBalance = 0;
    const realByMonthSig = new Set<string>();
    historicalExpenses.forEach((e: any) => {
      if (e.type === 'transfer') return;
      const ym = e.date ? e.date.substring(0, 7) : '';
      if (ym) realByMonthSig.add(buildMonthRecurringSignature(ym, e.type, e.value, e.description));
    });
    monthExpenses.forEach((e: any) => {
      if (e.type === 'transfer') return;
      const ym = e.date ? e.date.substring(0, 7) : '';
      if (ym) realByMonthSig.add(buildMonthRecurringSignature(ym, e.type, e.value, e.description));
    });

    const selectedMonthStart = selectedYear * 12 + selectedMonth;

    recurringExpenses.forEach(r => {
      if (r.type === 'transfer' || r.credit_card_id) return;
      const rDate = new Date(r.date + 'T12:00:00');
      const rStartMonth = rDate.getFullYear() * 12 + rDate.getMonth();
      for (let m = rStartMonth; m < selectedMonthStart; m++) {
        const yr = Math.floor(m / 12);
        const mo = m % 12;
        const monthKey = `${yr}-${String(mo + 1).padStart(2, '0')}`;
        const sig = buildMonthRecurringSignature(monthKey, r.type, r.value, r.description);
        if (realByMonthSig.has(sig)) continue;
        if (r.type === 'income') virtualRecurringBalance += Number(r.value);
        else virtualRecurringBalance -= Number(r.value);
      }
    });

    let ccInvoiceTotal = 0;
    if (creditCards.length > 0) {
      const ccPool = invoiceExpenses;
      const selectedDate = new Date(selectedYear, selectedMonth, 1);
      creditCards.forEach(card => {
        for (let i = 1; i <= 24; i++) {
          const dt = new Date(selectedDate);
          dt.setMonth(dt.getMonth() - i);
          const m = dt.getMonth();
          const y = dt.getFullYear();
          const period = getInvoicePeriod(card, y, m);
          const invoice = matchExpensesToInvoice(ccPool, period);
          if (invoice.total > 0) ccInvoiceTotal += invoice.total;
        }
      });
    }

    const balance = walletSum + historicalIncome - historicalDebit + virtualRecurringBalance - ccInvoiceTotal;
    return { startingBalance: balance, pendingInStartingBalance: pendingAmount };
  }, [wallets, historicalExpenses, monthExpenses, recurringExpenses, creditCards, invoiceExpenses, selectedMonth, selectedYear]);

  // Invoice totals
  const invoiceTotals = useMemo(() => {
    if (creditCards.length === 0) return { total: 0, byCategory: {} as Record<string, number> };
    const ccPool = invoiceExpenses.length > 0 ? invoiceExpenses : monthExpenses;
    let total = 0;
    const byCategory: Record<string, number> = {};
    creditCards.forEach(card => {
      const period = getInvoicePeriod(card, selectedYear, selectedMonth);
      const invoice = matchExpensesToInvoice(ccPool, period);
      total += invoice.total;
      invoice.transactions.forEach(tx => {
        byCategory[tx.final_category] = (byCategory[tx.final_category] || 0) + tx.value;
      });
    });
    return { total, byCategory };
  }, [creditCards, invoiceExpenses, monthExpenses, selectedMonth, selectedYear]);

  // Compute totals
  const result = useMemo(() => {
    const nonTransfers = effectiveMonthExpenses.filter(e => e.type !== 'transfer');
    const totalIncome = nonTransfers.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
    const debitExpense = nonTransfers.filter(e => e.type !== 'income' && !e.credit_card_id).reduce((s, e) => s + e.value, 0);
    const totalExpense = debitExpense + invoiceTotals.total;

    const byCategory: Record<string, number> = { ...invoiceTotals.byCategory };
    nonTransfers.filter(e => e.type !== 'income' && !e.credit_card_id).forEach(e => {
      byCategory[e.final_category] = (byCategory[e.final_category] || 0) + e.value;
    });
    const largest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      projectedBalance: startingBalance + totalIncome - totalExpense,
      largestCategory: largest ? { name: largest[0], total: largest[1], categoryKey: largest[0] } : null,
    };
  }, [effectiveMonthExpenses, invoiceTotals, startingBalance]);

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
  };
}
