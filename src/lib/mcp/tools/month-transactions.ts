import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser, toolError } from "../supabaseClient";
import { computeMonthProjection, pad } from "../monthProjection";

export default defineTool({
  name: "month_transactions",
  title: "Transações do mês com saldo projetado",
  description:
    "Retorna a mesma visão da página de Transações de um mês (YYYY-MM): todas as transações do mês (incluindo recorrentes projetadas e pagamentos de fatura de cartão), agrupadas por dia, com o saldo projetado acumulado ao final de cada dia, além do saldo inicial e do saldo previsto do fim do mês.",
  inputSchema: {
    month: z.string().describe("Mês no formato YYYY-MM."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: safeHandler("month_transactions", async ({ month }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return { content: [{ type: "text", text: "Formato inválido. Use YYYY-MM." }], isError: true };
    }

    try {
      const sb = supabaseForUser(ctx);
      const projection = await computeMonthProjection(sb, month);
      const { daysInMonth, startingBalance, effectiveMonthExpenses, invoiceTotals, totals, daily } = projection;
      const { balanceMap, nonCcFlowByDay, invoiceTotalByDay } = daily;

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
    } catch (error) {
      return toolError("Falha ao projetar o mês", error);
    }
  }),
});
