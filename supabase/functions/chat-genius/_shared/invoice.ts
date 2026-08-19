/**
 * Porte da lógica de faturas do app (src/lib/invoiceHelpers.ts e
 * src/lib/creditCardPayments.ts) para o runtime Deno da edge function.
 * Mantém exatamente as mesmas regras de fechamento, vencimento e status.
 */

export interface CreditCard {
  id: string;
  name: string;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  closing_strategy?: string;
  closing_days_before_due?: number;
}

export interface ExpenseLike {
  id: string;
  date: string;
  description: string;
  value: number;
  type?: string | null;
  final_category?: string | null;
  credit_card_id?: string | null;
  wallet_id?: string | null;
  invoice_month?: string | null;
  is_paid?: boolean | null;
}

export type InvoiceStatus = "open" | "closed" | "overdue" | "paid";

const PAYMENT_PREFIX_RE = /^pagamento(?: de)? fatura\s*/i;

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export function isCreditCardPaymentLabel(description?: string | null) {
  return PAYMENT_PREFIX_RE.test(description ?? "");
}

export function getCreditCardPaymentLabelCardName(description?: string | null) {
  return normalize(description).replace(PAYMENT_PREFIX_RE, "").split(" - ")[0];
}

function getClosingDay(card: CreditCard): number {
  if (card.closing_strategy === "relative") {
    let cd = (card.due_day ?? 10) - (card.closing_days_before_due ?? 0);
    if (cd <= 0) cd += 30;
    return cd;
  }
  return card.closing_day;
}

function buildClosingDate(year: number, month: number, closingDay: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(closingDay, lastDay));
}

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function toMonthLabel(year: number, month: number): string {
  return `${year}-${pad2(month + 1)}`;
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Data efetiva de pagamento (vencimento da fatura) para uma compra no cartão. */
export function getPaymentDate(purchaseDate: string, card: CreditCard): Date {
  const purchase = new Date(`${purchaseDate}T12:00:00`);
  const dueDay = card.due_day ?? 10;
  const closingDay = getClosingDay(card);

  let cycleYear = purchase.getFullYear();
  let cycleMonth = purchase.getMonth();
  if (purchase.getDate() > closingDay) {
    if (cycleMonth === 11) {
      cycleMonth = 0;
      cycleYear += 1;
    } else {
      cycleMonth += 1;
    }
  }

  const dueYear = cycleMonth === 11 ? cycleYear + 1 : cycleYear;
  const dueMonth = cycleMonth === 11 ? 0 : cycleMonth + 1;
  const dueLastDay = new Date(dueYear, dueMonth + 1, 0).getDate();
  return new Date(dueYear, dueMonth, Math.min(dueDay, dueLastDay));
}

export interface InvoicePeriod {
  cardId: string;
  cardName: string;
  closingDay: number;
  dueDay: number;
  limit: number;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  monthLabel: string;
  status: InvoiceStatus;
}

/** targetMonth (0-11) é o MÊS DE VENCIMENTO da fatura. */
export function getInvoicePeriod(card: CreditCard, targetYear: number, targetMonth: number): InvoicePeriod {
  const closingDay = getClosingDay(card);

  const cycleMonth = targetMonth === 0 ? 11 : targetMonth - 1;
  const cycleYear = targetMonth === 0 ? targetYear - 1 : targetYear;
  const periodEnd = buildClosingDate(cycleYear, cycleMonth, closingDay);

  const prevCycleMonth = cycleMonth === 0 ? 11 : cycleMonth - 1;
  const prevCycleYear = cycleMonth === 0 ? cycleYear - 1 : cycleYear;
  const prevClosing = buildClosingDate(prevCycleYear, prevCycleMonth, closingDay);
  const periodStart = new Date(prevClosing);
  periodStart.setDate(periodStart.getDate() + 1);

  const dueLastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const dueDate = new Date(targetYear, targetMonth, Math.min(card.due_day ?? 10, dueLastDay));

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let status: InvoiceStatus = "open";
  if (today > dueDate) status = "overdue";
  else if (today > periodEnd) status = "closed";

  return {
    cardId: card.id,
    cardName: card.name,
    closingDay,
    dueDay: card.due_day ?? 10,
    limit: Number(card.limit_amount ?? 0),
    periodStart,
    periodEnd,
    dueDate,
    monthLabel: toMonthLabel(targetYear, targetMonth),
    status,
  };
}

export interface MatchedInvoice extends InvoicePeriod {
  transactions: ExpenseLike[];
  total: number;
}

export function matchExpensesToInvoice(expenses: ExpenseLike[], period: InvoicePeriod): MatchedInvoice {
  const dueLabel = period.monthLabel;

  const resolveLabel = (e: ExpenseLike) => {
    if (e.invoice_month) return e.invoice_month;
    const paymentDate = getPaymentDate(e.date, {
      id: period.cardId,
      name: period.cardName,
      limit_amount: period.limit,
      closing_day: period.closingDay,
      due_day: period.dueDay,
    });
    return toMonthLabel(paymentDate.getFullYear(), paymentDate.getMonth());
  };

  const transactions = expenses.filter((e) => {
    if (e.credit_card_id !== period.cardId) return false;
    if (e.type === "income" || e.type === "transfer") return false;
    if (isCreditCardPaymentLabel(e.description)) return false;
    return resolveLabel(e) === dueLabel;
  });

  const total = transactions.reduce((s, e) => s + Number(e.value), 0);

  const normalizedCardName = normalize(period.cardName);
  const isPaid = expenses.some((e) => {
    if (e.type !== "expense" || !e.invoice_month || e.invoice_month !== dueLabel || !e.wallet_id) return false;
    if (!isCreditCardPaymentLabel(e.description)) return false;
    if (e.credit_card_id) return e.credit_card_id === period.cardId;
    return getCreditCardPaymentLabelCardName(e.description) === normalizedCardName;
  });

  let status: InvoiceStatus = isPaid ? "paid" : period.status;
  if (total <= 0 && status === "overdue") status = "closed";

  return { ...period, status, transactions, total };
}

export const INVOICE_EXPENSE_COLS =
  "id,date,description,value,type,final_category,credit_card_id,wallet_id,invoice_month,is_paid";
