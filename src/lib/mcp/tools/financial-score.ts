import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import { ok } from "../resolve";
import { computeMonthProjection } from "../monthProjection";
import { getInvoicePeriod, matchExpensesToInvoice } from "../../invoiceHelpers";

/**
 * Mesmos pesos e faixas da página Score Financeiro do app
 * (poupança 30%, orçamento 20%, dívidas 20%, consistência 15%, crédito 15%).
 */
function scoreOf(
  totalIncome: number,
  totalExpense: number,
  totalBudget: number,
  totalSpentInBudget: number,
  hasOverdueCards: boolean,
  debtCount: number,
  prevExpense: number,
  ccUsageRatio: number,
) {
  let savings = 0;
  if (totalIncome > 0) {
    const rate = (totalIncome - totalExpense) / totalIncome;
    savings = rate >= 0.3 ? 100 : rate >= 0.2 ? 85 : rate >= 0.1 ? 70 : rate >= 0 ? 50 : rate >= -0.1 ? 30 : 10;
  }

  let budget = 75;
  if (totalBudget > 0) {
    const ratio = totalSpentInBudget / totalBudget;
    budget = ratio <= 0.8 ? 100 : ratio <= 0.95 ? 85 : ratio <= 1 ? 70 : ratio <= 1.1 ? 50 : 20;
  }

  let debt = 100 - debtCount * 10 - (hasOverdueCards ? 20 : 0);
  debt = Math.max(0, Math.min(100, debt));

  let consistency = 70;
  if (prevExpense > 0 && totalExpense > 0) {
    const variation = Math.abs(totalExpense - prevExpense) / prevExpense;
    consistency = variation <= 0.05 ? 100 : variation <= 0.15 ? 85 : variation <= 0.3 ? 65 : 40;
  }

  let credit = 100;
  if (ccUsageRatio > 0.9) credit = 20;
  else if (ccUsageRatio > 0.7) credit = 50;
  else if (ccUsageRatio > 0.5) credit = 70;
  else if (ccUsageRatio > 0.3) credit = 85;
  if (hasOverdueCards) credit = Math.min(credit, 30);

  const overall = Math.round(savings * 0.3 + budget * 0.2 + debt * 0.2 + consistency * 0.15 + credit * 0.15);
  return { overall, savings, budget, debt, consistency, credit };
}

export default defineTool({
  name: "financial_score",
  title: "Score financeiro do mês",
  description:
    "Calcula o score financeiro de um mês (YYYY-MM) com as mesmas regras da página do app: nota geral de 0 a 100 e as cinco dimensões (poupança, orçamento, dívidas, consistência e crédito), com os números que sustentam cada nota.",
  inputSchema: {
    month: z.string().regex(/^\d{4}-\d{2}$/).describe("Mês no formato YYYY-MM."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: safeHandler("financial_score", async ({ month }: any, ctx) => {
    const sb = supabaseForUser(ctx);
    const [year, monthNumber] = month.split("-").map(Number);
    const previousMonth = `${monthNumber === 1 ? year - 1 : year}-${String(
      monthNumber === 1 ? 12 : monthNumber - 1,
    ).padStart(2, "0")}`;

    const [current, previous, budgetsRes, debtsRes] = await Promise.all([
      computeMonthProjection(sb, month),
      computeMonthProjection(sb, previousMonth),
      sb.from("budgets").select("category, allocated_amount, month_year").eq("month_year", `${month}-01`),
      sb.from("debts").select("id, remaining_amount"),
    ]);

    const budgets = (budgetsRes.data ?? []) as any[];
    const totalBudget = budgets.reduce((s, b) => s + Number(b.allocated_amount ?? 0), 0);
    const budgetCategories = new Set(budgets.map((b) => b.category));
    let spentInBudget = 0;
    for (const expense of current.effectiveMonthExpenses as any[]) {
      if (expense.type !== "expense") continue;
      if (budgetCategories.has(expense.final_category)) spentInBudget += Number(expense.value);
    }

    const debts = ((debtsRes.data ?? []) as any[]).filter((d) => Number(d.remaining_amount ?? 0) > 0);

    let usedLimit = 0;
    let totalLimit = 0;
    let hasOverdue = false;
    const { data: allExpenses } = await sb
      .from("expenses")
      .select("id,date,description,value,type,final_category,credit_card_id,wallet_id,invoice_month,is_paid");
    for (const card of current.creditCards as any[]) {
      totalLimit += Number(card.limit_amount ?? 0);
      const period = getInvoicePeriod(card as any, year, monthNumber - 1);
      const invoice = matchExpensesToInvoice((allExpenses ?? []) as any, period);
      usedLimit += invoice.total;
      if (invoice.status === "overdue") hasOverdue = true;
    }
    const usageRatio = totalLimit > 0 ? usedLimit / totalLimit : 0;

    const scores = scoreOf(
      current.totals.totalIncome,
      current.totals.totalExpense,
      totalBudget,
      spentInBudget,
      hasOverdue,
      debts.length,
      previous.totals.totalExpense,
      usageRatio,
    );

    const payload = {
      month,
      overall_score: scores.overall,
      savings_score: scores.savings,
      budget_score: scores.budget,
      debt_score: scores.debt,
      consistency_score: scores.consistency,
      credit_score: scores.credit,
      total_income: current.totals.totalIncome,
      total_expense: current.totals.totalExpense,
      previous_month_expense: previous.totals.totalExpense,
      total_budget: Number(totalBudget.toFixed(2)),
      spent_in_budget: Number(spentInBudget.toFixed(2)),
      active_debts: debts.length,
      credit_usage_pct: Number((usageRatio * 100).toFixed(1)),
      has_overdue_invoice: hasOverdue,
    };

    const summary = [
      `Score financeiro de ${month}: ${scores.overall}/100`,
      `Poupança ${scores.savings} · Orçamento ${scores.budget} · Dívidas ${scores.debt} · Consistência ${scores.consistency} · Crédito ${scores.credit}`,
      `Receitas R$ ${payload.total_income.toFixed(2)} · Despesas R$ ${payload.total_expense.toFixed(2)} · Uso do crédito ${payload.credit_usage_pct}%`,
    ].join("\n");

    return ok(summary, payload);
  }),
});
