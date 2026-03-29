import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { getInvoicePeriod, matchExpensesToInvoice } from '@/lib/invoiceHelpers';
import type { CreditCard as CreditCardType } from '@/lib/invoiceHelpers';
import type { Expense } from '@/components/ExpenseTable';

// Columns needed for month expenses (avoid select('*'))
const EXPENSE_COLS = 'id, description, value, date, type, final_category, category_ai, credit_card_id, wallet_id, destination_wallet_id, is_paid, is_recurring, frequency, installments, installment_group_id, installment_info, invoice_month, payment_method, notes, tags, project_id, debt_id, created_at';

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
      { data: balanceResult },
    ] = await Promise.all([
      // Month expenses with specific columns
      supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', user.id)
        .gte('date', startDate).lt('date', endDate).order('date', { ascending: false }),
      // CC expenses for invoice matching (only needed cols)
      supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', user.id)
        .not('credit_card_id', 'is', null),
      supabase.from('credit_cards').select('*').eq('user_id', user.id),
      supabase.from('wallets').select('id, name, initial_balance').eq('user_id', user.id).order('name'),
      // Use server-side RPC instead of fetching all transactions
      supabase.rpc('get_starting_balance', {
        p_user_id: user.id,
        p_before_date: startDate,
      }),
    ]);

    setMonthExpenses((expData || []) as Expense[]);
    setInvoiceExpenses((ccExpData || []) as Expense[]);
    setCreditCards((cardsData || []) as CreditCardType[]);
    setWallets((walletsData || []).map((w: any) => ({ id: w.id, name: w.name })));

    // Starting balance comes from the RPC now (server-side calculation)
    setStartingBalance(balanceResult ?? 0);
    setLoading(false);
  }, [user, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build invoice periods for the selected month
  const invoiceTotals = useMemo(() => {
    if (creditCards.length === 0) return { total: 0, byCategory: {} as Record<string, number> };

    const targetMonth = selectedMonth;
    const targetYear_ = selectedYear;
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
      largestCategory: largest ? { name: largest[0], total: largest[1], categoryKey: largest[0] } : null,
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
