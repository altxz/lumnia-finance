import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser, toolError } from "../supabaseClient";
import { computeMonthProjection, ENGINE_VERSION } from "../monthProjection";

export default defineTool({
  name: "month_summary",
  title: "Resumo do mês",
  description:
    "Resume receitas, despesas e saldo do mês (YYYY-MM) usando exatamente o mesmo motor de projeção das páginas do app: saldo inicial (fim do mês anterior), receitas e despesas previstas (incluindo não pagas, recorrentes projetadas e faturas de cartão) e saldo previsto do fim do mês. Também informa os valores já realizados (pagos).",
  inputSchema: {
    month: z.string().regex(/^\d{4}-\d{2}$/).describe("Mês no formato YYYY-MM."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: safeHandler("month_summary", async ({ month }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    try {
      const sb = supabaseForUser(ctx);
      const { startingBalance, totals, invoiceTotals, effectiveMonthExpenses, daily, endDate } =
        await computeMonthProjection(sb, month);

      // Valores já efetivados (pagos) para comparação com o previsto.
      let paidIncome = 0;
      let paidExpense = 0;
      for (const e of effectiveMonthExpenses as any[]) {
        if (!e.is_paid || e.type === "transfer" || e.credit_card_id) continue;
        if (e.type === "income") paidIncome += Number(e.value);
        else paidExpense += Number(e.value);
      }

      const summary = {
        month,
        engine_version: ENGINE_VERSION,
        generated_at: new Date().toISOString(),
        starting_balance: startingBalance,
        projected_income: totals.totalIncome,
        projected_expense: totals.totalExpense,
        projected_month_balance: totals.balance,
        projected_end_of_month_balance: totals.projectedBalance,
        end_of_month_balance_check: daily.balanceMap[endDate] ?? totals.projectedBalance,
        invoice_total: invoiceTotals.total,
        largest_category: totals.largestCategory,
        realized_income: paidIncome,
        realized_expense: paidExpense,
        realized_balance: paidIncome - paidExpense,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(summary) }],
        structuredContent: summary,
      };
    } catch (error) {
      return toolError("Falha ao resumir o mês", error);
    }
  }),
});
