import type { Expense } from '@/components/ExpenseTable';

export interface CreditCard {
  id: string;
  name: string;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  closing_strategy: string;
  closing_days_before_due: number;
}

export interface InvoicePeriod {
  cardId: string;
  cardName: string;
  closingDay: number;
  dueDay: number;
  limit: number;
  /** Start date of the invoice period (day after previous closing) */
  periodStart: Date;
  /** End date (closing date of the target month) */
  periodEnd: Date;
  /** Due date for the invoice */
  dueDate: Date;
  /** Invoice month label YYYY-MM */
  monthLabel: string;
  status: 'open' | 'closed' | 'overdue';
  transactions: Expense[];
  total: number;
}

/**
 * Get the effective closing day for a card in a given month.
 * If the card uses 'relative' strategy, closing = due_day - closing_days_before_due.
 */
function getClosingDay(card: CreditCard): number {
  if (card.closing_strategy === 'relative') {
    let cd = card.due_day - card.closing_days_before_due;
    if (cd <= 0) cd += 30;
    return cd;
  }
  return card.closing_day;
}

/**
 * Build closing date for a given month/year using the card's closing day.
 */
function buildClosingDate(year: number, month: number, closingDay: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(closingDay, lastDay);
  return new Date(year, month, day);
}

/**
 * Build the invoice period for a specific card and target month.
 * @param card Credit card config
 * @param targetYear Year of the invoice
 * @param targetMonth Month of the invoice (0-indexed)
 */
export function getInvoicePeriod(card: CreditCard, targetYear: number, targetMonth: number): Omit<InvoicePeriod, 'transactions' | 'total'> {
  const closingDay = getClosingDay(card);

  // Period end = closing date of the target month
  const periodEnd = buildClosingDate(targetYear, targetMonth, closingDay);

  // Period start = day after closing date of previous month
  const prevMonth = targetMonth === 0 ? 11 : targetMonth - 1;
  const prevYear = targetMonth === 0 ? targetYear - 1 : targetYear;
  const prevClosing = buildClosingDate(prevYear, prevMonth, closingDay);
  const periodStart = new Date(prevClosing);
  periodStart.setDate(periodStart.getDate() + 1);

  // Due date: due_day of the month AFTER the target month
  const dueMonth = targetMonth === 11 ? 0 : targetMonth + 1;
  const dueYear = targetMonth === 11 ? targetYear + 1 : targetYear;
  const dueLastDay = new Date(dueYear, dueMonth + 1, 0).getDate();
  const dueDate = new Date(dueYear, dueMonth, Math.min(card.due_day, dueLastDay));

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let status: 'open' | 'closed' | 'overdue' = 'open';
  if (today > dueDate) {
    status = 'overdue';
  } else if (today > periodEnd) {
    status = 'closed';
  }

  const monthLabel = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;

  return {
    cardId: card.id,
    cardName: card.name,
    closingDay,
    dueDay: card.due_day,
    limit: card.limit_amount,
    periodStart,
    periodEnd,
    dueDate,
    monthLabel,
    status,
  };
}

/**
 * Match expenses to an invoice period.
 */
export function matchExpensesToInvoice(
  expenses: Expense[],
  period: Omit<InvoicePeriod, 'transactions' | 'total'>
): InvoicePeriod {
  const start = period.periodStart;
  const end = period.periodEnd;

  const matched = expenses.filter(e => {
    if (e.credit_card_id !== period.cardId) return false;
    if (e.type === 'income' || e.type === 'transfer') return false;
    const d = new Date(e.date + 'T12:00:00');
    return d >= start && d <= end;
  });

  const total = matched.reduce((s, e) => s + e.value, 0);

  return { ...period, transactions: matched, total };
}

/**
 * Format a date as "DD de Mês"
 */
export function formatInvoiceDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}
