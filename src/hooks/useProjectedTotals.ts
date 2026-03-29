import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { getInvoicePeriod, matchExpensesToInvoice } from '@/lib/invoiceHelpers';
import type { CreditCard as CreditCardType } from '@/lib/invoiceHelpers';
import type { Expense } from '@/components/ExpenseTable';
import { getCategoryInfo } from '@/lib/constants';

export interface ProjectedTotals {
  totalIncome: number;
  /** Debit expenses + CC invoice totals due this month */
  totalExpense: number;
  /** income - expense */
  balance: number;
  /** Starting balance from previous months */
  startingBalance: number;
  /** startingBalance + income - expense */
  projectedBalance: number;
  /** Largest spending category (including CC) */
  largestCategory: { name: string; total: number; categoryKey: string } | null;
  loading: boolean;
  refetch: () => void;
  /** Raw month expenses for other components */
  monthExpenses: Expense[];
  /** All CC expenses for invoice matching */
  invoiceExpenses: Expense[];
  creditCards: CreditCardType[];
  wallets: { id: string; name: string }[];
}

export function useProjectedTotals(): ProjectedTotals {
  const { user } = useAuth();
  const { startDate, endDate, selectedMonth, selectedYear } = useSelectedDate();
  const [monthExpenses, setMonthExpenses] = useState<Expense[]>([]);
  const [invoiceExpenses, setInvoiceExpenses] = useState<Expense[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardType[]>([]);
  const [wallets, setWallets] = useState<{ id: string; name: string }[]>([]);
  const [startingBalance, setStartingBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [
      { data: expData },
      { data: ccExpData },
      { data: cardsData },
      { data: walletsData },
      { data: allTxns },
    ] = await Promise.all([
      supabase.from('expenses').select('*').eq('user_id', user.id)
        .gte('date', startDate).lt('date', endDate).order('date', { ascending: false }),
      supabase.from('expenses').select('*').eq('user_id', user.id)
        .not('credit_card_id', 'is', null),
      supabase.from('credit_cards').select('*').eq('user_id', user.id),
      supabase.from('wallets').select('id, name, initial_balance').eq('user_id', user.id).order('name'),
      supabase.from('expenses').select('value, type, credit_card_id, date')
        .eq('user_id', user.id).eq('is_paid', true),
    ]);

    setMonthExpenses((expData || []) as Expense[]);
    setInvoiceExpenses((ccExpData || []) as Expense[]);
    setCreditCards((cardsData || []) as CreditCardType[]);
    setWallets((walletsData || []).map((w: any) => ({ id: w.id, name: w.name })));

    // Calculate starting balance (all history before this month)
    const walletsTotal = (walletsData || []).reduce((s: number, w: any) => s + (w.initial_balance || 0), 0);
    let prior = walletsTotal;
    (allTxns || []).forEach((t: any) => {
      if (t.type === 'transfer') return;
      if (t.date >= startDate) return;
      if (t.type === 'income') prior += t.value;
      else if (!t.credit_card_id) prior -= t.value;
    });
    setStartingBalance(prior);
    setLoading(false);
  }, [user, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build invoice periods for the selected month
  const invoiceTotals = useMemo(() => {
    if (creditCards.length === 0) return { total: 0, byCategory: {} as Record<string, number> };

    const targetMonth = selectedMonth;
    const targetYear_ = selectedYear;
    // Invoice period from previous month produces dueDate in selectedMonth
    const prevM = targetMonth === 0 ? 11 : targetMonth - 1;
    const prevY = targetMonth === 0 ? targetYear_ - 1 : targetYear_;

    const ccPool = invoiceExpenses.length > 0 ? invoiceExpenses : monthExpenses;
    let total = 0;
    const byCategory: Record<string, number> = {};

    creditCards.forEach(card => {
      const period = getInvoicePeriod(card, prevY, prevM);
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
    const nonTransfers = monthExpenses.filter(e => e.type !== 'transfer');
    const totalIncome = nonTransfers.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);

    // Debit (non-CC) expenses
    const debitExpense = nonTransfers.filter(e => e.type !== 'income' && !e.credit_card_id).reduce((s, e) => s + e.value, 0);

    // Total expense = debit + CC invoices due this month
    const totalExpense = debitExpense + invoiceTotals.total;

    // Category breakdown (debit + CC)
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
      largestCategory: largest ? { name: getCategoryInfo(largest[0]).label, total: largest[1], categoryKey: largest[0] } : null,
    };
  }, [monthExpenses, invoiceTotals, startingBalance]);

  return {
    ...result,
    startingBalance,
    loading,
    refetch: fetchData,
    monthExpenses,
    invoiceExpenses,
    creditCards,
    wallets,
  };
}
