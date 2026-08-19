import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import { fail, ok } from "../resolve";
import { computeMonthProjection } from "../monthProjection";
import { isTrackedCreditCardPayment } from "../../creditCardPayments";

function categoryTotals(projection: Awaited<ReturnType<typeof computeMonthProjection>>) {
  const totals: Record<string, number> = { ...projection.invoiceTotals.byCategory };
  for (const expense of projection.effectiveMonthExpenses as any[]) {
    if (expense.type !== "expense" || expense.credit_card_id) continue;
    if (isTrackedCreditCardPayment(expense, projection.creditCards as any)) continue;
    const key = expense.final_category ?? "outros";
    totals[key] = (totals[key] ?? 0) + Number(expense.value);
  }
  return totals;
}

export default defineTool({
  name: "compare_months",
  title: "Comparar meses",
  description:
    "Compara dois meses (YYYY-MM): receitas, despesas, saldo e a variação por categoria, apontando onde o usuário gastou mais ou menos. Usa o mesmo motor de projeção do app.",
  inputSchema: {
    month: z.string().regex(/^\d{4}-\d{2}$/).describe("Mês analisado (YYYY-MM)."),
    compare_to: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .describe("Mês de comparação. Padrão: mês anterior ao analisado."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: safeHandler("compare_months", async (input: any, ctx) => {
    const sb = supabaseForUser(ctx);
    const [year, monthNumber] = input.month.split("-").map(Number);
    const previous =
      input.compare_to ??
      `${monthNumber === 1 ? year - 1 : year}-${String(monthNumber === 1 ? 12 : monthNumber - 1).padStart(2, "0")}`;
    if (previous === input.month) return fail("Escolha dois meses diferentes.");

    const [current, base] = await Promise.all([
      computeMonthProjection(sb, input.month),
      computeMonthProjection(sb, previous),
    ]);

    const currentCats = categoryTotals(current);
    const baseCats = categoryTotals(base);
    const keys = Array.from(new Set([...Object.keys(currentCats), ...Object.keys(baseCats)]));
    const categories = keys
      .map((key) => {
        const now = Number((currentCats[key] ?? 0).toFixed(2));
        const before = Number((baseCats[key] ?? 0).toFixed(2));
        return {
          category: key,
          current: now,
          previous: before,
          diff: Number((now - before).toFixed(2)),
          diff_pct: before > 0 ? Number((((now - before) / before) * 100).toFixed(1)) : null,
        };
      })
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    const payload = {
      month: input.month,
      compare_to: previous,
      income: { current: current.totals.totalIncome, previous: base.totals.totalIncome },
      expense: { current: current.totals.totalExpense, previous: base.totals.totalExpense },
      balance: { current: current.totals.balance, previous: base.totals.balance },
      end_of_month_balance: {
        current: current.totals.projectedBalance,
        previous: base.totals.projectedBalance,
      },
      categories,
      biggest_increases: categories.filter((c) => c.diff > 0).slice(0, 5),
      biggest_decreases: categories.filter((c) => c.diff < 0).slice(0, 5),
    };

    const summary = [
      `${input.month} vs ${previous}:`,
      `Receitas: R$ ${payload.income.current.toFixed(2)} vs R$ ${payload.income.previous.toFixed(2)}`,
      `Despesas: R$ ${payload.expense.current.toFixed(2)} vs R$ ${payload.expense.previous.toFixed(2)}`,
      `Saldo do mês: R$ ${payload.balance.current.toFixed(2)} vs R$ ${payload.balance.previous.toFixed(2)}`,
      ...categories
        .slice(0, 6)
        .map(
          (c) =>
            `${c.category}: R$ ${c.current.toFixed(2)} (${c.diff >= 0 ? "+" : ""}R$ ${c.diff.toFixed(2)}${
              c.diff_pct !== null ? `, ${c.diff_pct >= 0 ? "+" : ""}${c.diff_pct}%` : ""
            })`,
        ),
    ].join("\n");

    return ok(summary, payload);
  }),
});
