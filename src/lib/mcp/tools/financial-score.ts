import { defineTool } from "@lovable.dev/mcp-js";
import { safeHandler } from "../safeHandler";
import { z } from "zod";
import { supabaseForUser } from "../supabaseClient";
import { ok } from "../resolve";
import { computeMonthProjection } from "../monthProjection";
import { getInvoicePeriod, matchExpensesToInvoice } from "../../invoiceHelpers";
import { computeFinancialScore } from "../../financialScore";

/**
 * Usa o motor único `computeFinancialScore` — as mesmas regras e pesos da
 * página Score Financeiro do app (poupança 30%, dívidas e crédito 25%,
 * orçamento 20%, reserva 15%, consistência 10%), com redistribuição de peso
 * quando uma dimensão não tem dados.
 */
export default defineTool({
  name: "financial_score",
  title: "Score financeiro do mês",
  description:
    "Calcula o score financeiro de um mês (YYYY-MM) com as mesmas regras da página do app: nota geral de 0 a 100 e as cinco dimensões (poupança, orçamento, dívidas e crédito, reserva e consistência), com os números que sustentam cada nota e o próximo passo recomendado.",
  inputSchema: {
    month: z.string().regex(/^\d{4}-\d{2}$/).describe("Mês no formato YYYY-MM."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: safeHandler("financial_score", async ({ month }: any, ctx) => {
    const sb = supabaseForUser(ctx);
    const [year, monthNumber] = month.split("-").map(Number);
    const monthAt = (offset: number) => {
      const d = new Date(year, monthNumber - 1 + offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    const [current, prev1, prev2, prev3, budgetsRes, debtsRes, walletsRes, investmentsRes] = await Promise.all([
      computeMonthProjection(sb, month),
      computeMonthProjection(sb, monthAt(-1)),
      computeMonthProjection(sb, monthAt(-2)),
      computeMonthProjection(sb, monthAt(-3)),
      sb.from("budgets").select("category, allocated_amount, month_year").eq("month_year", `${month}-01`),
      sb.from("debts").select("id, remaining_amount").eq("type", "i_owe"),
      sb.from("wallets").select("current_balance, asset_type"),
      sb.from("investments").select("principal, status"),
    ]);

    const budgets = (budgetsRes.data ?? []) as any[];
    const spentByCategory: Record<string, number> = {};
    let ccExpenses = 0;
    let committed = 0;
    for (const expense of current.effectiveMonthExpenses as any[]) {
      if (expense.type === "income" || expense.type === "transfer") continue;
      const value = Number(expense.value ?? 0);
      spentByCategory[expense.final_category] = (spentByCategory[expense.final_category] ?? 0) + value;
      if (expense.credit_card_id) {
        ccExpenses += value;
        committed += value;
      } else if (expense.installment_group_id) {
        committed += value;
      }
      if (expense.debt_id) committed += value;
    }

    let totalLimit = 0;
    let hasOverdue = false;
    const { data: allExpenses } = await sb
      .from("expenses")
      .select("id,date,description,value,type,final_category,credit_card_id,wallet_id,invoice_month,is_paid");
    for (const card of current.creditCards as any[]) {
      totalLimit += Number(card.limit_amount ?? 0);
      const period = getInvoicePeriod(card as any, year, monthNumber - 1);
      const invoice = matchExpensesToInvoice((allExpenses ?? []) as any, period);
      if (invoice.status === "overdue") hasOverdue = true;
    }

    const liquid = ((walletsRes.data ?? []) as any[])
      .filter((w) => w.asset_type !== "crypto")
      .reduce((s, w) => s + Number(w.current_balance ?? 0), 0);
    const invested = ((investmentsRes.data ?? []) as any[])
      .filter((i) => i.status === "active")
      .reduce((s, i) => s + Number(i.principal ?? 0), 0);

    const result = computeFinancialScore({
      totalIncome: current.totals.totalIncome,
      totalExpense: current.totals.totalExpense,
      budgets: budgets.map((b) => ({
        category: b.category,
        allocated: Number(b.allocated_amount ?? 0),
        spent: spentByCategory[b.category] ?? 0,
      })),
      committedAmount: committed,
      creditUsageRatio: totalLimit > 0 ? ccExpenses / totalLimit : 0,
      hasOverdueInvoice: hasOverdue,
      liquidReserve: liquid + invested,
      previousExpenses: [prev1, prev2, prev3].map((p) => p.totals.totalExpense),
    });

    const activeDebts = ((debtsRes.data ?? []) as any[]).filter((d) => Number(d.remaining_amount ?? 0) > 0);

    const payload = {
      month,
      overall_score: result.overall,
      rating: result.label,
      headline: result.headline,
      dimensions: result.dimensions.map((d) => ({
        key: d.key,
        label: d.label,
        score: d.score,
        weight_pct: Number((d.weight * 100).toFixed(1)),
        evaluated: d.evaluated,
        detail: d.detail,
        action: d.action,
      })),
      next_step: result.nextStep,
      total_income: current.totals.totalIncome,
      total_expense: current.totals.totalExpense,
      previous_months_expense: [prev1, prev2, prev3].map((p) => p.totals.totalExpense),
      committed_amount: Number(committed.toFixed(2)),
      credit_usage_pct: totalLimit > 0 ? Number(((ccExpenses / totalLimit) * 100).toFixed(1)) : 0,
      liquid_reserve: Number((liquid + invested).toFixed(2)),
      active_debts: activeDebts.length,
      has_overdue_invoice: hasOverdue,
      ...result.persisted,
    };

    const summary = [
      `Score financeiro de ${month}: ${result.overall}/100 (${result.label})`,
      result.headline,
      result.dimensions
        .map((d) => `${d.label} ${d.score ?? "n/d"} — ${d.detail}`)
        .join(" · "),
      result.nextStep ? `Próximo passo: ${result.nextStep.action} (+${result.nextStep.potentialGain} pts)` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return ok(summary, payload);
  }),
});
