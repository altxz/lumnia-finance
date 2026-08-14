import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import { buildInvoiceCashEvents, sumInvoiceCashEventsBeforeDate } from "@/lib/invoiceCashFlow";
import { isTrackedCreditCardPayment } from "@/lib/creditCardPayments";
import { buildDailyBalanceMap, computeProjectedMonthResult } from "@/lib/projectedBalanceMath";
import { computeInvoiceTotalsForCashWindow } from "@/lib/projectedInvoiceTotals";
import {
  buildMaterializedRecurringSignature,
  buildRecurringExceptionSignature,
  buildRecurringLooseSignature,
  buildRecurringSignature,
  hideMaterializedRecurringTemplates,
  shouldProjectRecurringInMonth,
} from "@/lib/recurringProjection";

const EXPENSE_COLS =
  "id, description, value, date, type, final_category, category_ai, credit_card_id, wallet_id, destination_wallet_id, is_paid, is_recurring, frequency, installments, installment_group_id, installment_info, invoice_month, payment_method, notes, tags, project_id, debt_id, created_at";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export default defineTool({
  name: "month_transactions",
  title: "Transações do mês com saldo projetado",
  description:
    "Retorna a mesma visão da página de Transações de um mês (YYYY-MM): todas as transações do mês (incluindo recorrentes projetadas e pagamentos de fatura de cartão), agrupadas por dia, com o saldo projetado acumulado ao final de cada dia, além do saldo inicial e do saldo previsto do fim do mês.",
  inputSchema: {
    month: z.string().describe("Mês no formato YYYY-MM."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ month }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return { content: [{ type: "text", text: "Formato inválido. Use YYYY-MM." }], isError: true };
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const monthIndex = monthNumber - 1;
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${pad(daysInMonth)}`;
    const endExclusive = `${monthNumber === 12 ? year + 1 : year}-${pad(monthNumber === 12 ? 1 : monthNumber + 1)}-01`;

    const sb = supabaseForUser(ctx);
    const [
      monthRes,
      ccRes,
      invoicePaymentsRes,
      historicalRes,
      cardsRes,
      walletsRes,
      exceptionsRes,
      templatesRes,
    ] = await Promise.all([
      sb.from("expenses").select(EXPENSE_COLS).gte("date", startDate).lt("date", endExclusive).order("date"),
      sb.from("expenses").select(EXPENSE_COLS).not("credit_card_id", "is", null),
      sb
        .from("expenses")
        .select(EXPENSE_COLS)
        .is("credit_card_id", null)
        .not("invoice_month", "is", null)
        .like("description", "Pagamento fatura%"),
      sb
        .from("expenses")
        .select(EXPENSE_COLS)
        .lt("date", startDate)
        .is("credit_card_id", null),
      sb.from("credit_cards").select("*"),
      sb.from("wallets").select("id, name, initial_balance"),
      sb.from("recurring_exceptions").select("template_id, occurrence_date"),
      sb.from("expenses").select(EXPENSE_COLS).eq("is_recurring", true),
    ]);

    const firstError = [monthRes, ccRes, invoicePaymentsRes, historicalRes, cardsRes, walletsRes, templatesRes].find(
      (r) => r.error,
    );
    if (firstError?.error) {
      return { content: [{ type: "text", text: firstError.error.message }], isError: true };
    }

    const ccExpenses = (ccRes.data ?? []) as any[];
    const paymentExpenses = (invoicePaymentsRes.data ?? []) as any[];
    const ccIds = new Set(ccExpenses.map((e) => e.id));
    const invoiceExpenses = [...ccExpenses, ...paymentExpenses.filter((p) => !ccIds.has(p.id))];

    const creditCards = (cardsRes.data ?? []) as any[];
    const wallets = (walletsRes.data ?? []) as any[];
    const recurringTemplates = (templatesRes.data ?? []) as any[];
    const exceptionSet = new Set(
      ((exceptionsRes.data ?? []) as any[]).map((e) =>
        buildRecurringExceptionSignature(e.template_id, e.occurrence_date),
      ),
    );

    const visibleMonthExpenses = hideMaterializedRecurringTemplates((monthRes.data ?? []) as any[]);
    const visibleHistorical = hideMaterializedRecurringTemplates((historicalRes.data ?? []) as any[]);
    const isCCPayment = (e: any) => isTrackedCreditCardPayment(e, creditCards);

    // Recorrentes virtuais do mês
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

    // Saldo inicial (fim do mês anterior)
    const walletSum = wallets.reduce((s, w) => s + Number(w.initial_balance ?? 0), 0);
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

    const { balanceMap, nonCcFlowByDay, invoiceTotalByDay } = buildDailyBalanceMap({
      monthExpenses: effectiveMonthExpenses as any[],
      invoiceExpenses: invoiceExpenses as any[],
      creditCards,
      startDate,
      endDate,
      startingBalance,
      isCreditCardPayment: isCCPayment,
    });

    const byDay = new Map<string, any[]>();
    effectiveMonthExpenses.forEach((e: any) => {
      if (!byDay.has(e.date)) byDay.set(e.date, []);
      byDay.get(e.date)!.push({
        id: e.id,
        description: e.description,
        value: Number(e.value),
        type: e.type,
        category: e.final_category,
        is_paid: !!e.is_paid,
        payment_method: e.payment_method,
        credit_card_id: e.credit_card_id ?? null,
        invoice_month: e.invoice_month ?? null,
        is_recurring: !!e.is_recurring,
        is_projected: !!e.is_projected,
        notes: e.notes ?? null,
      });
    });

    let running = startingBalance;
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${month}-${pad(d)}`;
      if (dateKey in balanceMap) running = balanceMap[dateKey];
      days.push({
        date: dateKey,
        transactions: byDay.get(dateKey) ?? [],
        cash_flow: nonCcFlowByDay[dateKey] ?? 0,
        invoice_payments: invoiceTotalByDay[dateKey] ?? 0,
        projected_balance_end_of_day: running,
      });
    }

    const payload = {
      month,
      starting_balance: startingBalance,
      total_income: totals.totalIncome,
      total_expense: totals.totalExpense,
      month_balance: totals.balance,
      projected_end_of_month_balance: totals.projectedBalance,
      invoice_total: invoiceTotals.total,
      largest_category: totals.largestCategory,
      days,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
