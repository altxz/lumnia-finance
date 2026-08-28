import type { Expense } from '../components/ExpenseTable';
import {
  getInvoicePeriod,
  getPaymentDate,
  matchExpensesToInvoice,
  type CreditCard,
  type InvoicePeriod,
} from './invoiceHelpers';
import { getCreditCardPaymentLabelCardName, isCreditCardPaymentLabel } from './creditCardPayments';
import { transactionAmount } from './transactionAmount';

type InvoiceCashExpense = Pick<
  Expense,
  'credit_card_id' | 'date' | 'description' | 'invoice_month' | 'type' | 'value' | 'wallet_id'
>;

export interface InvoiceCashEvent {
  amount: number;
  cardId: string;
  date: string;
  monthLabel: string;
  /** true quando existe um lançamento real de "Pagamento fatura" para esta fatura. */
  paid?: boolean;
}

function toMonthLabel(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseMonthLabel(label: string) {
  const [year, month] = label.split('-').map(Number);
  return { year, month: month - 1 };
}

function normalizeCardName(name?: string | null) {
  return (name ?? '').trim().toLowerCase();
}

function getLegacyPaymentCardName(description?: string | null) {
  return normalizeCardName(getCreditCardPaymentLabelCardName(description));
}

function isInvoicePaymentRecord(expense: InvoiceCashExpense) {
  return (
    expense.type === 'expense' &&
    !!expense.invoice_month &&
    !!expense.wallet_id &&
    isCreditCardPaymentLabel(expense.description)
  );
}

function resolveExpenseMonthLabel(
  expense: InvoiceCashExpense,
  cardsById: Map<string, CreditCard>,
) {
  if (expense.invoice_month) return expense.invoice_month;
  if (!expense.credit_card_id) return null;

  const card = cardsById.get(expense.credit_card_id);
  if (!card) return null;

  const paymentDate = getPaymentDate(expense.date, card);
  return toMonthLabel(paymentDate.getFullYear(), paymentDate.getMonth());
}

export function findInvoicePaymentRecord(
  expenses: InvoiceCashExpense[],
  period: Pick<InvoicePeriod, 'cardId' | 'cardName' | 'monthLabel'>,
) {
  const normalizedCardName = normalizeCardName(period.cardName);

  return expenses
    .filter((expense) => {
      if (!isInvoicePaymentRecord(expense) || expense.invoice_month !== period.monthLabel) return false;
      if (expense.credit_card_id) return expense.credit_card_id === period.cardId;
      return getLegacyPaymentCardName(expense.description) === normalizedCardName;
    })
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

export function buildInvoiceCashEvents(
  creditCards: CreditCard[],
  expenses: InvoiceCashExpense[],
): InvoiceCashEvent[] {
  if (creditCards.length === 0 || expenses.length === 0) return [];

  const cardsById = new Map(creditCards.map((card) => [card.id, card]));
  const cardsByName = new Map(creditCards.map((card) => [normalizeCardName(card.name), card]));
  const labelsByCard = new Map<string, Set<string>>();

  const addLabel = (cardId: string, label: string | null) => {
    if (!label) return;
    if (!labelsByCard.has(cardId)) labelsByCard.set(cardId, new Set());
    labelsByCard.get(cardId)!.add(label);
  };

  expenses.forEach((expense) => {
    if (expense.type !== 'expense') return;

    if (expense.credit_card_id && cardsById.has(expense.credit_card_id)) {
      addLabel(expense.credit_card_id, resolveExpenseMonthLabel(expense, cardsById));
      return;
    }

    if (!isInvoicePaymentRecord(expense)) return;

    const matchedCard = cardsByName.get(getLegacyPaymentCardName(expense.description));
    if (matchedCard) addLabel(matchedCard.id, expense.invoice_month ?? null);
  });

  const typedExpenses = expenses as Expense[];
  const events: InvoiceCashEvent[] = [];

  labelsByCard.forEach((labels, cardId) => {
    const card = cardsById.get(cardId);
    if (!card) return;

    Array.from(labels)
      .sort()
      .forEach((label) => {
        const { year, month } = parseMonthLabel(label);
        const invoice = matchExpensesToInvoice(typedExpenses, getInvoicePeriod(card, year, month));
        const paymentRecord = findInvoicePaymentRecord(expenses, invoice);

        // Regra: quando existe pagamento lançado, o caixa do mês é o valor pago.
        // Sem pagamento, a fatura entra projetada na data de vencimento.
        const amount = paymentRecord ? transactionAmount(paymentRecord.value) : transactionAmount(invoice.total);
        if (amount <= 0) return;

        events.push({
          amount,
          cardId,
          date: paymentRecord?.date ?? toDateKey(invoice.dueDate),
          monthLabel: invoice.monthLabel,
          paid: !!paymentRecord,
        });
      });
  });

  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.cardId.localeCompare(b.cardId) ||
      a.monthLabel.localeCompare(b.monthLabel),
  );
}

export function sumInvoiceCashEventsBeforeDate(events: InvoiceCashEvent[], cutoffDate: string) {
  return events.reduce((sum, event) => (event.date < cutoffDate ? sum + event.amount : sum), 0);
}

export function groupInvoiceCashEventsByDay(
  events: InvoiceCashEvent[],
  startDate: string,
  endDate: string,
) {
  return events.reduce<Record<string, number>>((acc, event) => {
    if (event.date < startDate || event.date > endDate) return acc;
    acc[event.date] = (acc[event.date] || 0) + event.amount;
    return acc;
  }, {});
}
