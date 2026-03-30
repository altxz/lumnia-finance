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
  /** Projected starting balance from previous months (paid + pending) */
  startingBalance: number;
  /** Amount of pending (unpaid) expenses included in startingBalance */
  pendingInStartingBalance: number;
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
  wallets: { id: string; name: string; initial_balance: number }[];
}

export function useProjectedTotals(): ProjectedTotals {
  const { user } = useAuth();
  const { startDate, endDate, selectedMonth, selectedYear } = useSelectedDate();
  const [monthExpenses, setMonthExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<Expense[]>([]);
  const [invoiceExpenses, setInvoiceExpenses] = useState<Expense[]>([]);
  const [historicalExpenses, setHistoricalExpenses] = useState<Expense[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardType[]>([]);
  const [wallets, setWallets] = useState<{ id: string; name: string; initial_balance: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [
      { data: expData },
      { data: recurringData },
      { data: ccExpData },
      { data: historicalData },
      { data: cardsData },
      { data: walletsData },
    ] = await Promise.all([
      // Month expenses with specific columns
      supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', user.id)
        .gte('date', startDate).lt('date', endDate).order('date', { ascending: false }),
      // All recurring transactions that started before end of selected month
      supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', user.id)
        .eq('is_recurring', true).lt('date', endDate),
      // CC expenses for invoice matching (only needed cols)
      supabase.from('expenses').select(EXPENSE_COLS).eq('user_id', user.id)
        .not('credit_card_id', 'is', null),
      // All non-CC expenses before startDate (for projected starting balance) — ignoring is_paid
      supabase.from('expenses').select('id, value, type, credit_card_id, is_paid, final_category')
        .eq('user_id', user.id).lt('date', startDate).is('credit_card_id', null),
      supabase.from('credit_cards').select('*').eq('user_id', user.id),
      supabase.from('wallets').select('id, name, initial_balance').eq('user_id', user.id).order('name'),
    ]);

    setMonthExpenses((expData || []) as Expense[]);
    setRecurringExpenses((recurringData || []) as Expense[]);
    setInvoiceExpenses((ccExpData || []) as Expense[]);
    setHistoricalExpenses((historicalData || []) as any[]);
    setCreditCards((cardsData || []) as CreditCardType[]);
    setWallets((walletsData || []).map((w: any) => ({ id: w.id, name: w.name, initial_balance: w.initial_balance ?? 0 })));
    setLoading(false);
  }, [user, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Virtual recurring: inject recurring transactions into monthExpenses if not already present
  const effectiveMonthExpenses = useMemo(() => {
    // Build a set of signatures to detect if a recurring tx already has a real entry this month
    const realSignatures = new Set(
      monthExpenses.map(e => `${e.type}|${e.description.trim().toLowerCase()}|${Number(e.value).toFixed(2)}`)
    );
    const realIds = new Set(monthExpenses.map(e => e.id));
    const virtualEntries: Expense[] = [];

    recurringExpenses.forEach(r => {
      // Skip if already in this month's real data
      if (realIds.has(r.id)) return;
      // Skip if a matching real entry already exists (edge function copy or manual entry)
      const sig = `${r.type}|${r.description.trim().toLowerCase()}|${Number(r.value).toFixed(2)}`;
      if (realSignatures.has(sig)) return;
      // Skip transfers and credit card recurring (handled by invoice logic)
      if (r.type === 'transfer' || r.credit_card_id) return;
      // The recurring tx started on or before this month — project it
      virtualEntries.push({
        ...r,
        // Use a virtual date within the selected month (same day, current month)
        date: (() => {
          const origDay = new Date(r.date + 'T12:00:00').getDate();
          const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
          const day = Math.min(origDay, daysInMonth);
          return `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        })(),
        is_paid: false, // virtual projection
      });
    });

    return [...monthExpenses, ...virtualEntries];
  }, [monthExpenses, recurringExpenses, selectedMonth, selectedYear]);

  // Calculate projected starting balance
  const { startingBalance, pendingInStartingBalance } = useMemo(() => {
    // 1. Sum of all wallet initial balances
    const walletSum = wallets.reduce((s, w) => s + w.initial_balance, 0);

    // 2. All non-CC, non-transfer historical transactions (regardless of is_paid)
    const nonTransfers = historicalExpenses.filter((e: any) => e.type !== 'transfer');
    const historicalIncome = nonTransfers.filter((e: any) => e.type === 'income').reduce((s: number, e: any) => s + e.value, 0);
    const historicalDebit = nonTransfers.filter((e: any) => e.type !== 'income').reduce((s: number, e: any) => s + e.value, 0);

    // Calculate pending amount (unpaid expenses that are being projected)
    const pendingExpenses = nonTransfers.filter((e: any) => e.type !== 'income' && !e.is_paid);
    const pendingIncome = nonTransfers.filter((e: any) => e.type === 'income' && !e.is_paid);
    const pendingAmount = pendingExpenses.reduce((s: number, e: any) => s + e.value, 0)
      - pendingIncome.reduce((s: number, e: any) => s + e.value, 0);

    // 3. Virtual recurring contributions for months BEFORE the selected month
    // For each recurring tx, check every month between its start and selectedMonth.
    // If no real entry exists for that month, add its virtual contribution.
    let virtualRecurringBalance = 0;

    // Build a lookup: for each month + signature, does a real entry exist?
    const realByMonthSig = new Set<string>();
    historicalExpenses.forEach((e: any) => {
      if (e.type === 'transfer') return;
      const ym = e.date ? e.date.substring(0, 7) : '';
      if (ym) realByMonthSig.add(`${ym}|${e.type}|${Number(e.value).toFixed(2)}`);
    });
    // Also include current month real data to avoid double-counting at boundary
    monthExpenses.forEach((e: any) => {
      if (e.type === 'transfer') return;
      const ym = e.date ? e.date.substring(0, 7) : '';
      if (ym) realByMonthSig.add(`${ym}|${e.type}|${Number(e.value).toFixed(2)}`);
    });

    const selectedMonthStart = selectedYear * 12 + selectedMonth; // months since epoch

    recurringExpenses.forEach(r => {
      if (r.type === 'transfer' || r.credit_card_id) return;
      const rDate = new Date(r.date + 'T12:00:00');
      const rStartMonth = rDate.getFullYear() * 12 + rDate.getMonth();

      // For each month from the recurring start up to (but NOT including) the selected month
      for (let m = rStartMonth; m < selectedMonthStart; m++) {
        const yr = Math.floor(m / 12);
        const mo = m % 12;
        const monthKey = `${yr}-${String(mo + 1).padStart(2, '0')}`;
        const sig = `${monthKey}|${r.type}|${Number(r.value).toFixed(2)}`;
        // Skip if a real entry already exists for this month (already counted in historicalIncome/Debit)
        if (realByMonthSig.has(sig)) continue;
        // Add virtual contribution
        if (r.type === 'income') virtualRecurringBalance += Number(r.value);
        else virtualRecurringBalance -= Number(r.value);
      }
    });

    // 4. CC invoice totals for months before the selected month
    // IMPORTANT: Count ALL invoices regardless of paid status for continuity.
    // If we only counted unpaid ones, paying an invoice would shift the starting balance
    // of all future months, breaking the chain (endBalance(N) ≠ startBalance(N+1)).
    let ccInvoiceTotal = 0;
    if (creditCards.length > 0) {
      const ccPool = invoiceExpenses.length > 0 ? invoiceExpenses : [];
      const selectedDate = new Date(selectedYear, selectedMonth, 1);
      
      creditCards.forEach(card => {
        for (let i = 1; i <= 24; i++) {
          const dt = new Date(selectedDate);
          dt.setMonth(dt.getMonth() - i);
          const m = dt.getMonth();
          const y = dt.getFullYear();
          const period = getInvoicePeriod(card, y, m);
          const invoice = matchExpensesToInvoice(ccPool, period);
          if (invoice.total > 0) {
            ccInvoiceTotal += invoice.total;
          }
        }
      });
    }

    const balance = walletSum + historicalIncome - historicalDebit + virtualRecurringBalance - ccInvoiceTotal;
    return { startingBalance: balance, pendingInStartingBalance: pendingAmount };
  }, [wallets, historicalExpenses, monthExpenses, recurringExpenses, creditCards, invoiceExpenses, selectedMonth, selectedYear]);

  // Build invoice periods for the selected month (due month)
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
  }, [effectiveMonthExpenses, invoiceTotals, startingBalance]);

  return {
    ...result,
    startingBalance,
    pendingInStartingBalance,
    loading,
    refetch: fetchData,
    monthExpenses: effectiveMonthExpenses,
    invoiceExpenses,
    creditCards,
    wallets,
  };
}
