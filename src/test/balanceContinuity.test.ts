import { describe, it, expect } from 'vitest';
import {
  buildInvoiceCashEvents,
  groupInvoiceCashEventsByDay,
  sumInvoiceCashEventsBeforeDate,
} from '@/lib/invoiceCashFlow';
import { buildDailyBalanceMap, computeProjectedMonthResult } from '@/lib/projectedBalanceMath';
import { computeInvoiceTotalsForCashWindow } from '@/lib/projectedInvoiceTotals';
import {
  buildMonthRecurringSignature,
  buildRecurringExceptionSignature,
  buildRecurringLooseSignature,
  hideMaterializedRecurringTemplates,
  shouldProjectRecurringInMonth,
} from '@/lib/recurringProjection';
import type { CreditCard } from '@/lib/invoiceHelpers';
import type { Expense } from '@/components/ExpenseTable';

/**
 * These tests lock the contract that powers the History page:
 *   "End-of-month balance for month N === Starting balance for month N+1"
 *
 * They reproduce the exact pieces of logic used in:
 *   - useProjectedTotals (starting balance / projected balance)
 *   - TransactionFeed (running balance per day, invoice cash events)
 *
 * Any drift between months (the bug the user reported when going from April
 * to May) must be caught here before it reaches the UI.
 */

const CARD: CreditCard = {
  id: 'card-nubank',
  name: 'Nubank',
  limit_amount: 5000,
  closing_day: 28,
  due_day: 5,
  closing_strategy: 'fixed',
  closing_days_before_due: 7,
};

const isCCPayment = (e: Partial<Expense>) =>
  e.type !== 'income' &&
  !e.credit_card_id &&
  (
    e.description?.toLowerCase().includes('fatura') ||
    e.final_category?.toLowerCase().includes('cartão') ||
    e.final_category?.toLowerCase().includes('cartao')
  );

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: overrides.id ?? `exp-${Math.random().toString(36).slice(2)}`,
    description: overrides.description ?? 'Generic',
    value: overrides.value ?? 0,
    date: overrides.date ?? '2026-04-01',
    type: overrides.type ?? 'expense',
    final_category: overrides.final_category ?? 'outros',
    category_ai: overrides.category_ai ?? null,
    credit_card_id: overrides.credit_card_id ?? null,
    wallet_id: overrides.wallet_id ?? null,
    destination_wallet_id: overrides.destination_wallet_id ?? null,
    is_paid: overrides.is_paid ?? true,
    is_recurring: overrides.is_recurring ?? false,
    frequency: overrides.frequency ?? null,
    installments: overrides.installments ?? 1,
    installment_group_id: overrides.installment_group_id ?? null,
    installment_info: overrides.installment_info ?? null,
    invoice_month: overrides.invoice_month ?? null,
    payment_method: overrides.payment_method ?? null,
    notes: overrides.notes ?? null,
    tags: overrides.tags ?? null,
    project_id: overrides.project_id ?? null,
    debt_id: overrides.debt_id ?? null,
    created_at: overrides.created_at ?? '2026-04-01T00:00:00Z',
  } as Expense;
}

/**
 * Mirrors useProjectedTotals.startingBalance for a given month boundary.
 * Keeping the formula here in plain form lets us assert that the seam between
 * two months always lines up.
 */
function computeStartingBalance({
  walletInitial,
  historicalNonCc,
  recurringTemplates,
  invoiceExpenses,
  selectedYear,
  selectedMonth,
  exceptionSet,
  cards,
}: {
  walletInitial: number;
  historicalNonCc: Expense[];
  recurringTemplates: Expense[];
  invoiceExpenses: Expense[];
  selectedYear: number;
  selectedMonth: number;
  exceptionSet: Set<string>;
  cards: CreditCard[];
}) {
  const visibleHistorical = hideMaterializedRecurringTemplates(historicalNonCc);
  const nonTransfers = visibleHistorical.filter((e) => e.type !== 'transfer');
  const historicalIncome = nonTransfers
    .filter((e) => e.type === 'income')
    .reduce((s, e) => s + e.value, 0);
  const historicalDebit = nonTransfers
    .filter((e) => e.type !== 'income' && !isCCPayment(e))
    .reduce((s, e) => s + e.value, 0);

  const realByMonthSig = new Set<string>();
  const realByMonthLoose = new Set<string>();
  nonTransfers.forEach((e) => {
    const ym = e.date.substring(0, 7);
    realByMonthSig.add(buildMonthRecurringSignature(ym, e.type, e.value, e.description));
    realByMonthLoose.add(`${ym}|${buildRecurringLooseSignature(e.type, e.description)}`);
  });

  const selectedMonthStart = selectedYear * 12 + selectedMonth;
  let virtualRecurring = 0;

  recurringTemplates.forEach((r) => {
    if (r.type === 'transfer' || r.credit_card_id) return;
    const rDate = new Date(r.date + 'T12:00:00');
    const rStartMonth = rDate.getFullYear() * 12 + rDate.getMonth();
    const origDay = rDate.getDate();
    for (let m = rStartMonth; m < selectedMonthStart; m++) {
      const yr = Math.floor(m / 12);
      const mo = m % 12;
      if (!shouldProjectRecurringInMonth(r.date, yr, mo, r.frequency)) continue;
      const monthKey = `${yr}-${String(mo + 1).padStart(2, '0')}`;
      const sig = buildMonthRecurringSignature(monthKey, r.type, r.value, r.description);
      const looseSig = `${monthKey}|${buildRecurringLooseSignature(r.type, r.description)}`;
      if (realByMonthSig.has(sig) || realByMonthLoose.has(looseSig)) continue;
      const daysInMonth = new Date(yr, mo + 1, 0).getDate();
      const occDate = `${monthKey}-${String(Math.min(origDay, daysInMonth)).padStart(2, '0')}`;
      if (exceptionSet.has(buildRecurringExceptionSignature(r.id, occDate))) continue;
      if (r.type === 'income') virtualRecurring += Number(r.value);
      else virtualRecurring -= Number(r.value);
    }
  });

  const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
  const ccTotal = sumInvoiceCashEventsBeforeDate(
    buildInvoiceCashEvents(cards, invoiceExpenses),
    startDate,
  );

  return walletInitial + historicalIncome - historicalDebit + virtualRecurring - ccTotal;
}

function computeMonthClose({
  startingBalance,
  monthExpenses,
  invoiceTotalForMonth,
}: {
  startingBalance: number;
  monthExpenses: Expense[];
  invoiceTotalForMonth: number;
}) {
  return computeProjectedMonthResult({
    effectiveMonthExpenses: monthExpenses,
    invoiceTotal: invoiceTotalForMonth,
    invoiceByCategory: {},
    startingBalance,
    isCreditCardPayment: isCCPayment,
  }).projectedBalance;
}

describe('Invoice cash events — single source of truth', () => {
  it('does not invent future invoices from a recurring card transaction', () => {
    const gamePass = makeExpense({
      id: 'game-pass-template',
      description: 'Game Pass',
      value: 76.90,
      date: '2026-08-01',
      credit_card_id: CARD.id,
      invoice_month: '2026-09',
      is_recurring: true,
      frequency: 'monthly',
    });

    const october = computeInvoiceTotalsForCashWindow({
      creditCards: [CARD],
      expenses: [gamePass],
      startDate: '2026-10-01',
      endDate: '2026-11-01',
    });
    const events = buildInvoiceCashEvents([CARD], [gamePass]);

    expect(october.total).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ monthLabel: '2026-09', amount: 76.90 });
  });

  it('uses the actual payment date when the invoice has a payment record', () => {
    const purchase = makeExpense({
      id: 'p1',
      description: 'Mercado',
      value: 200,
      date: '2026-03-15',
      credit_card_id: CARD.id,
      invoice_month: '2026-04',
    });
    const payment = makeExpense({
      id: 'pay1',
      description: 'Pagamento fatura Nubank',
      value: 200,
      date: '2026-04-03',
      wallet_id: 'wallet-1',
      invoice_month: '2026-04',
      credit_card_id: CARD.id,
    });

    const events = buildInvoiceCashEvents([CARD], [purchase, payment]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ amount: 200, date: '2026-04-03', monthLabel: '2026-04' });
  });

  it('falls back to the due date when no payment record exists', () => {
    const purchase = makeExpense({
      id: 'p2',
      description: 'Restaurante',
      value: 80,
      date: '2026-03-20',
      credit_card_id: CARD.id,
      invoice_month: '2026-04',
    });
    const events = buildInvoiceCashEvents([CARD], [purchase]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ amount: 80, date: '2026-04-05', monthLabel: '2026-04' });
  });

  it('groups invoice cash events into the right day inside a window', () => {
    const events = [
      { cardId: CARD.id, amount: 120, date: '2026-04-05', monthLabel: '2026-04' },
      { cardId: CARD.id, amount: 30, date: '2026-04-05', monthLabel: '2026-04' },
      { cardId: CARD.id, amount: 10, date: '2026-05-05', monthLabel: '2026-05' },
    ];
    const grouped = groupInvoiceCashEventsByDay(events, '2026-04-01', '2026-04-30');
    expect(grouped).toEqual({ '2026-04-05': 150 });
  });

  it('counts invoices strictly before a cutoff date (no double counting at boundary)', () => {
    const events = [
      { cardId: CARD.id, amount: 100, date: '2026-04-05', monthLabel: '2026-04' },
      { cardId: CARD.id, amount: 50, date: '2026-05-05', monthLabel: '2026-05' },
    ];
    expect(sumInvoiceCashEventsBeforeDate(events, '2026-05-01')).toBe(100);
    expect(sumInvoiceCashEventsBeforeDate(events, '2026-04-05')).toBe(0);
    expect(sumInvoiceCashEventsBeforeDate(events, '2026-06-01')).toBe(150);
  });
});

describe('Balance continuity — April closes exactly where May opens', () => {
  it('matches end-of-April balance with start-of-May balance (cash flow only)', () => {
    const aprilExpenses: Expense[] = [
      makeExpense({ id: 'sal-apr', description: 'Salário', value: 5000, date: '2026-04-05', type: 'income' }),
      makeExpense({ id: 'rent-apr', description: 'Aluguel', value: 1500, date: '2026-04-10' }),
      makeExpense({ id: 'food-apr', description: 'Mercado', value: 800, date: '2026-04-20' }),
    ];

    const startApril = computeStartingBalance({
      walletInitial: 2000,
      historicalNonCc: [],
      recurringTemplates: [],
      invoiceExpenses: [],
      selectedYear: 2026,
      selectedMonth: 3,
      exceptionSet: new Set(),
      cards: [],
    });

    const endApril = computeMonthClose({
      startingBalance: startApril,
      monthExpenses: aprilExpenses,
      invoiceTotalForMonth: 0,
    });

    const startMay = computeStartingBalance({
      walletInitial: 2000,
      historicalNonCc: aprilExpenses,
      recurringTemplates: [],
      invoiceExpenses: [],
      selectedYear: 2026,
      selectedMonth: 4,
      exceptionSet: new Set(),
      cards: [],
    });

    expect(endApril).toBe(startMay);
    expect(startMay).toBe(2000 + 5000 - 1500 - 800);
  });

  it('reproduces the user bug: invoice paid in April must NOT subtract again in May', () => {
    const aprilPurchase = makeExpense({
      id: 'cc-apr',
      description: 'Compra cartão',
      value: 4062.32,
      date: '2026-03-15',
      credit_card_id: CARD.id,
      invoice_month: '2026-04',
    });
    const aprilPayment = makeExpense({
      id: 'pay-apr',
      description: 'Pagamento fatura Nubank',
      value: 4062.32,
      date: '2026-04-29',
      wallet_id: 'wallet-1',
      invoice_month: '2026-04',
      final_category: 'Cartão de crédito',
    });
    const aprilSalary = makeExpense({
      id: 'sal-apr',
      description: 'Salário',
      value: 6000,
      date: '2026-04-05',
      type: 'income',
    });

    const aprilHistorical = [aprilSalary, aprilPayment];
    const invoiceExpenses = [aprilPurchase, aprilPayment];

    const startApril = computeStartingBalance({
      walletInitial: 1000,
      historicalNonCc: [],
      recurringTemplates: [],
      invoiceExpenses: [],
      selectedYear: 2026,
      selectedMonth: 3,
      exceptionSet: new Set(),
      cards: [CARD],
    });

    const endApril = computeMonthClose({
      startingBalance: startApril,
      monthExpenses: [aprilSalary, aprilPayment],
      invoiceTotalForMonth: 4062.32,
    });

    const startMay = computeStartingBalance({
      walletInitial: 1000,
      historicalNonCc: aprilHistorical,
      recurringTemplates: [],
      invoiceExpenses,
      selectedYear: 2026,
      selectedMonth: 4,
      exceptionSet: new Set(),
      cards: [CARD],
    });

    expect(endApril).toBeCloseTo(startMay, 2);
    expect(startMay).toBeCloseTo(1000 + 6000 - 4062.32, 2);
  });

  it('keeps continuity when a recurring template projects across months', () => {
    const recurringSalary = makeExpense({
      id: 'rec-sal',
      description: 'Salário Fixo',
      value: 4000,
      date: '2026-01-05',
      type: 'income',
      is_recurring: true,
      frequency: 'monthly',
    });

    const startApril = computeStartingBalance({
      walletInitial: 0,
      historicalNonCc: [],
      recurringTemplates: [recurringSalary],
      invoiceExpenses: [],
      selectedYear: 2026,
      selectedMonth: 3,
      exceptionSet: new Set(),
      cards: [],
    });

    // Jan + Feb + Mar virtual occurrences = 3 × 4000
    expect(startApril).toBe(12000);

    // April materializes as a real entry (e.g. user marked as paid)
    const aprilMaterialized = makeExpense({
      id: 'mat-apr',
      description: 'Salário Fixo',
      value: 4000,
      date: '2026-04-05',
      type: 'income',
    });

    const endApril = computeMonthClose({
      startingBalance: startApril,
      monthExpenses: [aprilMaterialized],
      invoiceTotalForMonth: 0,
    });

    const startMay = computeStartingBalance({
      walletInitial: 0,
      historicalNonCc: [aprilMaterialized],
      recurringTemplates: [recurringSalary],
      invoiceExpenses: [],
      selectedYear: 2026,
      selectedMonth: 4,
      exceptionSet: new Set(),
      cards: [],
    });

    expect(endApril).toBe(16000);
    expect(startMay).toBe(endApril);
  });

  it('respects "delete only this occurrence" without breaking the next-month opening', () => {
    const recurring = makeExpense({
      id: 'rec-net',
      description: 'Internet',
      value: 100,
      date: '2026-01-15',
      type: 'expense',
      is_recurring: true,
      frequency: 'monthly',
    });
    const exceptionSet = new Set<string>([
      buildRecurringExceptionSignature(recurring.id, '2026-03-15'),
    ]);

    const startApril = computeStartingBalance({
      walletInitial: 1000,
      historicalNonCc: [],
      recurringTemplates: [recurring],
      invoiceExpenses: [],
      selectedYear: 2026,
      selectedMonth: 3,
      exceptionSet,
      cards: [],
    });

    // Jan and Feb projected (-100 each), March excluded.
    expect(startApril).toBe(1000 - 200);

    const startMay = computeStartingBalance({
      walletInitial: 1000,
      historicalNonCc: [
        makeExpense({ id: 'apr', description: 'Internet', value: 100, date: '2026-04-15', type: 'expense' }),
      ],
      recurringTemplates: [recurring],
      invoiceExpenses: [],
      selectedYear: 2026,
      selectedMonth: 4,
      exceptionSet,
      cards: [],
    });

    // Jan, Feb, April actually counted (-100 each). March still excluded.
    expect(startMay).toBe(1000 - 300);
  });

  it('does not double-count when the user pays an invoice with a different value', () => {
    const purchase = makeExpense({
      id: 'cc-x',
      description: 'Compra',
      value: 500,
      date: '2026-03-10',
      credit_card_id: CARD.id,
      invoice_month: '2026-04',
    });
    const partialPayment = makeExpense({
      id: 'pay-x',
      description: 'Pagamento fatura Nubank',
      value: 500,
      date: '2026-04-05',
      wallet_id: 'w',
      invoice_month: '2026-04',
      final_category: 'Cartão de crédito',
    });

    const events = buildInvoiceCashEvents([CARD], [purchase, partialPayment]);
    expect(events).toHaveLength(1);

    const startMay = computeStartingBalance({
      walletInitial: 1000,
      historicalNonCc: [partialPayment], // payment record sits in April history
      recurringTemplates: [],
      invoiceExpenses: [purchase, partialPayment],
      selectedYear: 2026,
      selectedMonth: 4,
      exceptionSet: new Set(),
      cards: [CARD],
    });

    // Wallet 1000, payment record excluded from historicalDebit (Pagamento fatura),
    // invoice cash event of 500 subtracted exactly once.
    expect(startMay).toBe(1000 - 500);
  });
});

describe('Balance continuity — multiple credit cards', () => {
  const CARD_A: CreditCard = {
    id: 'card-a',
    name: 'Nubank',
    limit_amount: 5000,
    closing_day: 28,
    due_day: 5,
    closing_strategy: 'fixed',
    closing_days_before_due: 7,
  };
  const CARD_B: CreditCard = {
    id: 'card-b',
    name: 'Itaú',
    limit_amount: 8000,
    closing_day: 20,
    due_day: 28,
    closing_strategy: 'fixed',
    closing_days_before_due: 8,
  };

  it('builds one cash event per card per invoice (no cross-card contamination)', () => {
    const purchases = [
      makeExpense({ id: 'a1', description: 'A1', value: 300, date: '2026-03-15', credit_card_id: CARD_A.id, invoice_month: '2026-04' }),
      makeExpense({ id: 'a2', description: 'A2', value: 200, date: '2026-03-18', credit_card_id: CARD_A.id, invoice_month: '2026-04' }),
      makeExpense({ id: 'b1', description: 'B1', value: 700, date: '2026-03-10', credit_card_id: CARD_B.id, invoice_month: '2026-04' }),
    ];
    const payments = [
      makeExpense({ id: 'pa', description: 'Pagamento fatura Nubank', value: 500, date: '2026-04-05', wallet_id: 'w', invoice_month: '2026-04', credit_card_id: CARD_A.id }),
      makeExpense({ id: 'pb', description: 'Pagamento fatura Itaú', value: 700, date: '2026-04-28', wallet_id: 'w', invoice_month: '2026-04', credit_card_id: CARD_B.id }),
    ];

    const events = buildInvoiceCashEvents([CARD_A, CARD_B], [...purchases, ...payments]);
    expect(events).toHaveLength(2);

    const byCard = Object.fromEntries(events.map((e) => [e.cardId, e]));
    expect(byCard[CARD_A.id]).toMatchObject({ amount: 500, date: '2026-04-05', monthLabel: '2026-04' });
    expect(byCard[CARD_B.id]).toMatchObject({ amount: 700, date: '2026-04-28', monthLabel: '2026-04' });
  });

  it('matches legacy payment records to the right card by name (no double counting)', () => {
    const purchases = [
      makeExpense({ id: 'a1', description: 'A1', value: 400, date: '2026-03-15', credit_card_id: CARD_A.id, invoice_month: '2026-04' }),
      makeExpense({ id: 'b1', description: 'B1', value: 900, date: '2026-03-12', credit_card_id: CARD_B.id, invoice_month: '2026-04' }),
    ];
    // Legacy payments: no credit_card_id, identified only by description
    const payments = [
      makeExpense({ id: 'pa', description: 'Pagamento fatura Nubank', value: 400, date: '2026-04-05', wallet_id: 'w', invoice_month: '2026-04' }),
      makeExpense({ id: 'pb', description: 'Pagamento fatura Itaú', value: 900, date: '2026-04-28', wallet_id: 'w', invoice_month: '2026-04' }),
    ];

    const events = buildInvoiceCashEvents([CARD_A, CARD_B], [...purchases, ...payments]);
    expect(events).toHaveLength(2);

    const total = sumInvoiceCashEventsBeforeDate(events, '2026-05-01');
    expect(total).toBe(400 + 900);
  });

  it('keeps April→May continuity with two cards paid in different days of April', () => {
    const purchases = [
      makeExpense({ id: 'a1', description: 'Mercado', value: 1200, date: '2026-03-15', credit_card_id: CARD_A.id, invoice_month: '2026-04' }),
      makeExpense({ id: 'b1', description: 'Viagem', value: 2500, date: '2026-03-08', credit_card_id: CARD_B.id, invoice_month: '2026-04' }),
    ];
    const paymentA = makeExpense({ id: 'pa', description: 'Pagamento fatura Nubank', value: 1200, date: '2026-04-05', wallet_id: 'w', invoice_month: '2026-04', final_category: 'Cartão de crédito' });
    const paymentB = makeExpense({ id: 'pb', description: 'Pagamento fatura Itaú', value: 2500, date: '2026-04-28', wallet_id: 'w', invoice_month: '2026-04', final_category: 'Cartão de crédito' });
    const salary = makeExpense({ id: 'sal', description: 'Salário', value: 8000, date: '2026-04-05', type: 'income' });

    const cards = [CARD_A, CARD_B];
    const invoiceExpenses = [...purchases, paymentA, paymentB];
    const aprilHistorical = [salary, paymentA, paymentB];

    const startApril = computeStartingBalance({
      walletInitial: 3000,
      historicalNonCc: [],
      recurringTemplates: [],
      invoiceExpenses: [],
      selectedYear: 2026,
      selectedMonth: 3,
      exceptionSet: new Set(),
      cards,
    });

    const endApril = computeMonthClose({
      startingBalance: startApril,
      monthExpenses: [salary, paymentA, paymentB],
      invoiceTotalForMonth: 1200 + 2500,
    });

    const startMay = computeStartingBalance({
      walletInitial: 3000,
      historicalNonCc: aprilHistorical,
      recurringTemplates: [],
      invoiceExpenses,
      selectedYear: 2026,
      selectedMonth: 4,
      exceptionSet: new Set(),
      cards,
    });

    expect(endApril).toBeCloseTo(startMay, 2);
    expect(startMay).toBeCloseTo(3000 + 8000 - 1200 - 2500, 2);
  });

  it('handles two cards where only one invoice has been paid (mixed states)', () => {
    const purchases = [
      makeExpense({ id: 'a1', description: 'A1', value: 600, date: '2026-03-15', credit_card_id: CARD_A.id, invoice_month: '2026-04' }),
      makeExpense({ id: 'b1', description: 'B1', value: 1100, date: '2026-03-10', credit_card_id: CARD_B.id, invoice_month: '2026-04' }),
    ];
    // Only card A was paid in April; card B will fall back to its due date.
    const paymentA = makeExpense({ id: 'pa', description: 'Pagamento fatura Nubank', value: 600, date: '2026-04-05', wallet_id: 'w', invoice_month: '2026-04', credit_card_id: CARD_A.id });

    const events = buildInvoiceCashEvents([CARD_A, CARD_B], [...purchases, paymentA]);
    expect(events).toHaveLength(2);
    const byCard = Object.fromEntries(events.map((e) => [e.cardId, e]));
    expect(byCard[CARD_A.id].date).toBe('2026-04-05');
    expect(byCard[CARD_B.id].date).toBe('2026-04-28'); // due_day fallback

    // Both should be subtracted from May's opening balance.
    expect(sumInvoiceCashEventsBeforeDate(events, '2026-05-01')).toBe(600 + 1100);
  });

  it('groups same-day payments from different cards into a single daily bucket', () => {
    const events = [
      { cardId: CARD_A.id, amount: 400, date: '2026-04-05', monthLabel: '2026-04' },
      { cardId: CARD_B.id, amount: 900, date: '2026-04-05', monthLabel: '2026-04' },
      { cardId: CARD_B.id, amount: 200, date: '2026-04-28', monthLabel: '2026-04' },
    ];
    const grouped = groupInvoiceCashEventsByDay(events, '2026-04-01', '2026-04-30');
    expect(grouped).toEqual({ '2026-04-05': 1300, '2026-04-28': 200 });
  });

  it('emits a single cash event per (card, invoice month) even with many purchases', () => {
    // Each card has multiple purchases in the same invoice — we should still
    // see exactly ONE cash event per card (the consolidated invoice total).
    const purchaseA1 = makeExpense({ id: 'a1', description: 'A1', value: 350, date: '2026-03-20', credit_card_id: CARD_A.id, invoice_month: '2026-04' });
    const purchaseA2 = makeExpense({ id: 'a2', description: 'A2', value: 150, date: '2026-03-22', credit_card_id: CARD_A.id, invoice_month: '2026-04' });
    const purchaseB1 = makeExpense({ id: 'b1', description: 'B1', value: 450, date: '2026-03-22', credit_card_id: CARD_B.id, invoice_month: '2026-04' });
    const paymentA = makeExpense({ id: 'pa', description: 'Pagamento fatura Nubank', value: 500, date: '2026-04-05', wallet_id: 'w', invoice_month: '2026-04', credit_card_id: CARD_A.id });
    const paymentB = makeExpense({ id: 'pb', description: 'Pagamento fatura Itaú', value: 450, date: '2026-04-28', wallet_id: 'w', invoice_month: '2026-04', credit_card_id: CARD_B.id });

    const events = buildInvoiceCashEvents(
      [CARD_A, CARD_B],
      [purchaseA1, purchaseA2, purchaseB1, paymentA, paymentB],
    );

    expect(events).toHaveLength(2);
    const byCard = Object.fromEntries(events.map((e) => [e.cardId, e]));
    expect(byCard[CARD_A.id].amount).toBe(500); // 350 + 150
    expect(byCard[CARD_B.id].amount).toBe(450);
    expect(sumInvoiceCashEventsBeforeDate(events, '2026-05-01')).toBe(950);
  });

  it('counts in April the invoice actually paid in April even if its invoice_month is May', () => {
    const earlyPaymentCard: CreditCard = {
      id: 'card-early',
      name: 'Visa',
      limit_amount: 7000,
      closing_day: 25,
      due_day: 8,
      closing_strategy: 'fixed',
      closing_days_before_due: 7,
    };

    const purchase = makeExpense({
      id: 'early-purchase',
      description: 'Notebook',
      value: 1800,
      date: '2026-04-02',
      credit_card_id: earlyPaymentCard.id,
      invoice_month: '2026-05',
      final_category: 'trabalho',
    });
    const payment = makeExpense({
      id: 'early-payment',
      description: 'Pagamento fatura Visa',
      value: 1800,
      date: '2026-04-30',
      wallet_id: 'wallet-1',
      invoice_month: '2026-05',
      credit_card_id: earlyPaymentCard.id,
    });

    const aprilTotals = computeInvoiceTotalsForCashWindow({
      creditCards: [earlyPaymentCard],
      expenses: [purchase, payment],
      startDate: '2026-04-01',
      endDate: '2026-05-01',
    });

    const mayTotals = computeInvoiceTotalsForCashWindow({
      creditCards: [earlyPaymentCard],
      expenses: [purchase, payment],
      startDate: '2026-05-01',
      endDate: '2026-06-01',
    });

    expect(aprilTotals.total).toBe(1800);
    expect(aprilTotals.byCategory).toEqual({ trabalho: 1800 });
    expect(mayTotals.total).toBe(0);
  });

  it('does not double-count a recurring template plus its materialized April payment into May opening', () => {
    const recurringHousing = makeExpense({
      id: 'rec-housing',
      description: 'Habitação Caixa',
      value: 2566.52,
      date: '2026-04-15',
      type: 'expense',
      is_recurring: true,
      is_paid: false,
      frequency: 'monthly',
      wallet_id: 'wallet-1',
    });

    const aprilMaterialized = makeExpense({
      id: 'mat-housing-apr',
      description: 'Habitação Caixa',
      value: 2566.52,
      date: '2026-04-15',
      type: 'expense',
      is_recurring: false,
      is_paid: true,
      wallet_id: 'wallet-1',
    });

    const startMay = computeStartingBalance({
      walletInitial: 0,
      historicalNonCc: [recurringHousing, aprilMaterialized],
      recurringTemplates: [recurringHousing],
      invoiceExpenses: [],
      selectedYear: 2026,
      selectedMonth: 4,
      exceptionSet: new Set(),
      cards: [],
    });

    expect(startMay).toBeCloseTo(-2566.52, 2);
  });

  it('uses the real payment day in the daily balance instead of the invoice due day', () => {
    const visaCard: CreditCard = {
      id: 'card-visa',
      name: 'Visa',
      limit_amount: 7000,
      closing_day: 25,
      due_day: 8,
      closing_strategy: 'fixed',
      closing_days_before_due: 7,
    };

    const purchase = makeExpense({
      id: 'invoice-purchase',
      description: 'Notebook',
      value: 1800,
      date: '2026-04-02',
      credit_card_id: visaCard.id,
      invoice_month: '2026-05',
      final_category: 'trabalho',
      is_paid: false,
    });
    const payment = makeExpense({
      id: 'invoice-payment',
      description: 'Pagamento fatura Visa',
      value: 1800,
      date: '2026-04-30',
      wallet_id: 'wallet-1',
      invoice_month: '2026-05',
      final_category: 'Cartão de crédito',
      is_paid: true,
    });
    const salary = makeExpense({
      id: 'salary-apr',
      description: 'Salário',
      value: 3000,
      date: '2026-04-05',
      type: 'income',
      is_paid: true,
    });

    const { balanceMap, invoiceTotalByDay } = buildDailyBalanceMap({
      monthExpenses: [salary, payment],
      invoiceExpenses: [purchase, payment],
      creditCards: [visaCard],
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      startingBalance: 1000,
      isCreditCardPayment: isCCPayment as (expense: Expense) => boolean,
    });

    expect(invoiceTotalByDay['2026-04-30']).toBe(1800);
    expect(invoiceTotalByDay['2026-04-08']).toBeUndefined();
    expect(balanceMap['2026-04-05']).toBe(4000);
    expect(balanceMap['2026-04-30']).toBe(2200);
  });
});