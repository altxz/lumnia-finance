import { buildInvoiceCashEvents, sumInvoiceCashEventsBeforeDate } from "../invoiceCashFlow";
import { isTrackedCreditCardPayment } from "../creditCardPayments";
import { buildDailyBalanceMap, computeProjectedMonthResult } from "../projectedBalanceMath";
import { computeInvoiceTotalsForCashWindow } from "../projectedInvoiceTotals";
import {
  buildMaterializedRecurringSignature,
  buildRecurringExceptionSignature,
  buildRecurringLooseSignature,
  buildRecurringSignature,
  hideMaterializedRecurringTemplates,
  shouldProjectRecurringInMonth,
} from "../recurringProjection";

export const EXPENSE_COLS =
  "id, description, value, date, type, final_category, category_ai, credit_card_id, wallet_id, destination_wallet_id, is_paid, is_recurring, frequency, installments, installment_group_id, installment_info, invoice_month, payment_method, notes, tags, project_id, debt_id, created_at";

export function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function daysInMonthOf(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

/**
 * Motor único de projeção mensal usado pelas ferramentas MCP. Replica a mesma
 * matemática das páginas do app (useProjectedTotals / TransactionFeed) para que
 * o saldo previsto informado ao ChatGPT feche com a interface.
 */
export async function computeMonthProjection(sb: any, month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthIndex = monthNumber - 1;
  const daysInMonth = daysInMonthOf(month);
  const startDate = `${month}-01`;
  const endDate = `${month}-${pad(daysInMonth)}`;
  const endExclusive = `${monthNumber === 12 ? year + 1 : year}-${pad(monthNumber === 12 ? 1 : monthNumber + 1)}-01`;

  const [monthRes, ccRes, invoicePaymentsRes, historicalRes, cardsRes, walletsRes, exceptionsRes, templatesRes] =
    await Promise.all([
      sb.from("expenses").select(EXPENSE_COLS).gte("date", startDate).lt("date", endExclusive).order("date"),
      sb.from("expenses").select(EXPENSE_COLS).not("credit_card_id", "is", null),
      sb
        .from("expenses")
        .select(EXPENSE_COLS)
        .is("credit_card_id", null)
        .not("invoice_month", "is", null)
        .like("description", "Pagamento fatura%"),
      sb.from("expenses").select(EXPENSE_COLS).lt("date", startDate).is("credit_card_id", null),
      sb.from("credit_cards").select("*"),
      sb.from("wallets").select("id, name, initial_balance"),
      sb.from("recurring_exceptions").select("template_id, occurrence_date"),
      sb.from("expenses").select(EXPENSE_COLS).eq("is_recurring", true),
    ]);

  const firstError = [monthRes, ccRes, invoicePaymentsRes, historicalRes, cardsRes, walletsRes, templatesRes].find(
    (r: any) => r.error,
  );
  if (firstError?.error) throw new Error(firstError.error.message ?? JSON.stringify(firstError.error));

  const ccExpenses = (ccRes.data ?? []) as any[];
  const paymentExpenses = (invoicePaymentsRes.data ?? []) as any[];
  const ccIds = new Set(ccExpenses.map((e) => e.id));
  const invoiceExpenses = [...ccExpenses, ...paymentExpenses.filter((p) => !ccIds.has(p.id))];

  const creditCards = (cardsRes.data ?? []) as any[];
  const wallets = (walletsRes.data ?? []) as any[];
  const recurringTemplates = (templatesRes.data ?? []) as any[];
  const exceptionSet = new Set(
    ((exceptionsRes.data ?? []) as any[]).map((e) => buildRecurringExceptionSignature(e.template_id, e.occurrence_date)),
  );

  const visibleMonthExpenses = hideMaterializedRecurringTemplates((monthRes.data ?? []) as any[]);
  const visibleHistorical = hideMaterializedRecurringTemplates((historicalRes.data ?? []) as any[]);
  const isCCPayment = (e: any) => isTrackedCreditCardPayment(e, creditCards);

  const realSignatures = new Set(
    visibleMonthExpenses.map((e: any) => buildRecurringSignature(e.type, e.value, e.description)),
  );
  const realLooseSignatures = new Set(
    visibleMonthExpenses.map((e: any) => buildRecurringLooseSignature(e.type, e.description)),
  );
  const materializedSignatures = new Set(
    visibleMonthExpenses.filter((e: any) => !e.is_recurring).map((e: any) => buildMaterializedRecurringSignature(e)),
  );
  const realIds = new Set(visibleMonthExpenses.map((e: any) => e.id));

  const virtualEntries: any[] = [];
  recurringTemplates.forEach((r) => {
    if (realIds.has(r.id)) return;
    if (!shouldProjectRecurringInMonth(r.date, year, monthIndex, r.frequency)) return;
    if (r.type === "transfer" || r.credit_card_id) return;
    if (
      realSignatures.has(buildRecurringSignature(r.type, r.value, r.description)) ||
      realLooseSignatures.has(buildRecurringLooseSignature(r.type, r.description)) ||
      materializedSignatures.has(buildMaterializedRecurringSignature(r))
    )
      return;
    const origDay = new Date(`${r.date}T12:00:00`).getDate();
    const occurrenceDate = `${month}-${pad(Math.min(origDay, daysInMonth))}`;
    if (exceptionSet.has(buildRecurringExceptionSignature(r.id, occurrenceDate))) return;
    virtualEntries.push({ ...r, date: occurrenceDate, is_paid: false, is_projected: true });
  });

  const effectiveMonthExpenses = [...visibleMonthExpenses, ...virtualEntries];

  const walletSum = wallets.reduce((s: number, w: any) => s + Number(w.initial_balance ?? 0), 0);
  const historicalNonTransfers = visibleHistorical.filter((e: any) => e.type !== "transfer");
  const historicalIncome = historicalNonTransfers
    .filter((e: any) => e.type === "income")
    .reduce((s: number, e: any) => s + Number(e.value), 0);
  const historicalDebit = historicalNonTransfers
    .filter((e: any) => e.type !== "income" && !isCCPayment(e))
    .reduce((s: number, e: any) => s + Number(e.value), 0);
  const invoiceCashEvents = buildInvoiceCashEvents(creditCards, invoiceExpenses as any[]);
  const invoicesBefore = sumInvoiceCashEventsBeforeDate(invoiceCashEvents, startDate);
  const startingBalance = walletSum + historicalIncome - historicalDebit - invoicesBefore;

  const invoiceTotals = computeInvoiceTotalsForCashWindow({
    creditCards,
    expenses: (invoiceExpenses.length > 0 ? invoiceExpenses : effectiveMonthExpenses) as any[],
    startDate,
    endDate: endExclusive,
  });

  const totals = computeProjectedMonthResult({
    effectiveMonthExpenses: effectiveMonthExpenses as any[],
    invoiceTotal: invoiceTotals.total,
    invoiceByCategory: invoiceTotals.byCategory,
    startingBalance,
    isCreditCardPayment: isCCPayment,
  });

  const daily = buildDailyBalanceMap({
    monthExpenses: effectiveMonthExpenses as any[],
    invoiceExpenses: invoiceExpenses as any[],
    creditCards,
    startDate,
    endDate,
    startingBalance,
    isCreditCardPayment: isCCPayment,
  });

  return {
    month,
    year,
    monthNumber,
    daysInMonth,
    startDate,
    endDate,
    startingBalance,
    effectiveMonthExpenses,
    invoiceTotals,
    totals,
    daily,
    creditCards,
  };
}
