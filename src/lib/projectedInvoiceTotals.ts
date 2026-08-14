import type { Expense } from '../components/ExpenseTable';
import {
  getInvoicePeriod,
  matchExpensesToInvoice,
  type CreditCard,
} from './invoiceHelpers';
import { buildInvoiceCashEvents } from './invoiceCashFlow';

interface ComputeInvoiceTotalsParams {
  creditCards: CreditCard[];
  expenses: Expense[];
  startDate: string;
  endDate: string;
}

function parseMonthLabel(label: string) {
  const [year, month] = label.split('-').map(Number);
  return { year, month: month - 1 };
}

export function computeInvoiceTotalsForCashWindow({
  creditCards,
  expenses,
  startDate,
  endDate,
}: ComputeInvoiceTotalsParams) {
  if (creditCards.length === 0 || expenses.length === 0) {
    return { total: 0, byCategory: {} as Record<string, number> };
  }

  const cardsById = new Map(creditCards.map((card) => [card.id, card]));
  const events = buildInvoiceCashEvents(creditCards, expenses).filter(
    (event) => event.date >= startDate && event.date < endDate,
  );

  let total = 0;
  const byCategory: Record<string, number> = {};
  const seenInvoices = new Set<string>();

  events.forEach((event) => {
    const invoiceKey = `${event.cardId}|${event.monthLabel}`;
    if (seenInvoices.has(invoiceKey)) return;
    seenInvoices.add(invoiceKey);

    const card = cardsById.get(event.cardId);
    if (!card) return;

    const { year, month } = parseMonthLabel(event.monthLabel);
    const invoice = matchExpensesToInvoice(expenses, getInvoicePeriod(card, year, month));
    if (invoice.total <= 0) return;

    total += invoice.total;
    invoice.transactions.forEach((tx) => {
      byCategory[tx.final_category] = (byCategory[tx.final_category] || 0) + tx.value;
    });
  });

  return { total, byCategory };
}