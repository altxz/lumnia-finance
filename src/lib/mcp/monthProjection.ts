import { buildInvoiceCashEvents, sumInvoiceCashEventsBeforeDate } from "../invoiceCashFlow";
import { isTrackedCreditCardPayment } from "../creditCardPayments";
import { buildDailyBalanceMap, computeMonthCashFlow, computeProjectedMonthResult } from "../projectedBalanceMath";
import { computeInvoiceTotalsForCashWindow } from "../projectedInvoiceTotals";
import {
  buildEffectiveMonthExpenses,
  buildRecurringExceptionSignature,
} from "../recurringProjection";

/**
 * Impressão digital do motor publicado. Serve para diagnosticar divergências:
 * se o valor devolvido pelo MCP não bater com a web, este campo mostra qual
 * versão do motor está de facto publicada na função.
 */
export const ENGINE_VERSION = "2026-08-17.1";

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

  const monthRows = (monthRes.data ?? []) as any[];
  const historicalRows = (historicalRes.data ?? []) as any[];
  const isCCPayment = (e: any) => isTrackedCreditCardPayment(e, creditCards);

  // Mesmo motor do app: reais + recorrências virtuais do mês selecionado.
  const effectiveMonthExpenses = buildEffectiveMonthExpenses({
    monthExpenses: monthRows,
    recurringTemplates,
    year,
    month: monthIndex,
    exceptionSet,
  }) as any[];

  // Saldo inicial: acumula mês a mês o MESMO fluxo que gera o saldo previsto,
  // garantindo que "Saldo Anterior" do mês N = "Saldo Previsto" do mês N-1.
  const walletSum = wallets.reduce((s: number, w: any) => s + Number(w.initial_balance ?? 0), 0);
  const selectedMonthIndex = year * 12 + monthIndex;

  const byMonth = new Map<number, any[]>();
  historicalRows.forEach((e: any) => {
    if (!e.date) return;
    const [y, m] = e.date.split("-").map(Number);
    const index = y * 12 + (m - 1);
    if (index >= selectedMonthIndex) return;
    if (!byMonth.has(index)) byMonth.set(index, []);
    byMonth.get(index)!.push(e);
  });

  const monthIndexes = new Set<number>(byMonth.keys());
  recurringTemplates.forEach((r: any) => {
    if (r.type === "transfer" || r.credit_card_id || !r.date) return;
    const d = new Date(`${r.date}T12:00:00`);
    const start = d.getFullYear() * 12 + d.getMonth();
    for (let m = start; m < selectedMonthIndex; m++) monthIndexes.add(m);
  });

  let historicalFlow = 0;
  Array.from(monthIndexes)
    .sort((a, b) => a - b)
    .forEach((index) => {
      const effective = buildEffectiveMonthExpenses({
        monthExpenses: (byMonth.get(index) ?? []) as any[],
        recurringTemplates,
        year: Math.floor(index / 12),
        month: index % 12,
        exceptionSet,
      });
      historicalFlow += computeMonthCashFlow(effective as any[], isCCPayment);
    });

  const invoiceCashEvents = buildInvoiceCashEvents(creditCards, invoiceExpenses as any[]);
  const invoicesBefore = sumInvoiceCashEventsBeforeDate(invoiceCashEvents, startDate);
  const startingBalance = walletSum + historicalFlow - invoicesBefore;

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
